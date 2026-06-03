const STORAGE_KEYS = {
  USER: 'msthuy_user',
  PROGRESS: 'msthuy_progress',
  FAVORITES: 'msthuy_favorites',
  SCORES: 'msthuy_scores',
  THEME: 'msthuy_theme'
};

const Storage = {
  getUser() {
    const data = localStorage.getItem(STORAGE_KEYS.USER);
    if (!data) return null;
    try { return JSON.parse(data); } catch (e) { return null; }
  },
  saveUser(user) {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  },
  createUser(name) {
    const user = {
      name: name.trim(),
      xp: 0,
      level: 1,
      createdAt: Date.now(),
      lastActive: Date.now()
    };
    this.saveUser(user);
    return user;
  },
  addXP(amount) {
    const user = this.getUser();
    if (!user) return null;
    user.xp += amount;
    user.level = this.calculateLevel(user.xp);
    user.lastActive = Date.now();
    this.saveUser(user);
    return user;
  },
  calculateLevel(xp) {
    let level = Math.floor((Math.sqrt(1 + 8 * xp / 100) - 1) / 2) + 1;
    return Math.min(Math.max(level, 1), 50);
  },
  xpForNextLevel(level) {
    return Math.floor(100 * level * (level + 1) / 2);
  },
  xpForCurrentLevel(level) {
    if (level <= 1) return 0;
    return Math.floor(100 * (level - 1) * level / 2);
  },
  getLevelTitle(level) {
    if (level < 5) return '🌱 Beginner';
    if (level < 10) return '📗 Elementary';
    if (level < 15) return '📘 Pre-Intermediate';
    if (level < 20) return '📙 Intermediate';
    if (level < 25) return '📕 Upper-Intermediate';
    if (level < 30) return '⭐ Advanced';
    if (level < 35) return '🌟 Proficient';
    if (level < 40) return '💎 Expert';
    if (level < 45) return '👑 Master';
    return '🏆 Legend';
  },
  getProgress() {
    const data = localStorage.getItem(STORAGE_KEYS.PROGRESS);
    if (!data) return {};
    try { return JSON.parse(data); } catch (e) { return {}; }
  },
  saveProgress(progress) {
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progress));
  },
  updateLessonProgress(lessonId, data) {
    const progress = this.getProgress();
    if (!progress[lessonId]) {
      progress[lessonId] = {
        openedAt: Date.now(),
        lastAccess: Date.now(),
        completedExercises: [],
        masteredCards: [],
        score: null
      };
    }
    progress[lessonId] = { ...progress[lessonId], ...data, lastAccess: Date.now() };
    this.saveProgress(progress);
    return progress[lessonId];
  },
  getLessonProgress(lessonId) {
    const progress = this.getProgress();
    return progress[lessonId] || null;
  },
  getCompletedCount() {
    const progress = this.getProgress();
    return Object.values(progress).filter(p =>
      p.completedExercises && p.completedExercises.length >= 8
    ).length;
  },
  getRecentLessons(limit = 3) {
    const progress = this.getProgress();
    return Object.entries(progress)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.lastAccess - a.lastAccess)
      .slice(0, limit);
  },
  getFavorites() {
    const data = localStorage.getItem(STORAGE_KEYS.FAVORITES);
    if (!data) return [];
    try { return JSON.parse(data); } catch (e) { return []; }
  },
  saveFavorites(favorites) {
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
  },
  toggleFavorite(lessonId) {
    const favorites = this.getFavorites();
    const idx = favorites.indexOf(lessonId);
    if (idx >= 0) favorites.splice(idx, 1);
    else favorites.push(lessonId);
    this.saveFavorites(favorites);
    return favorites;
  },
  isFavorite(lessonId) {
    return this.getFavorites().includes(lessonId);
  },
  getScores() {
    const data = localStorage.getItem(STORAGE_KEYS.SCORES);
    if (!data) return {};
    try { return JSON.parse(data); } catch (e) { return {}; }
  },
  saveScore(lessonId, exerciseKey, scoreData) {
    const scores = this.getScores();
    if (!scores[lessonId]) scores[lessonId] = {};
    scores[lessonId][exerciseKey] = scoreData;
    localStorage.setItem(STORAGE_KEYS.SCORES, JSON.stringify(scores));
  },
  getLessonScores(lessonId) {
    const scores = this.getScores();
    return scores[lessonId] || {};
  },
  getTheme() {
    return localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
  },
  setTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  },
  getAchievements() {
    const user = this.getUser();
    if (!user) return [];
    return user.achievements || [];
  },
  unlockAchievement(achievementId) {
    const user = this.getUser();
    if (!user) return false;
    if (!user.achievements) user.achievements = [];
    if (user.achievements.includes(achievementId)) return false;
    user.achievements.push(achievementId);
    this.saveUser(user);
    return true;
  },
  hasAchievement(achievementId) {
    return this.getAchievements().includes(achievementId);
  }
};

const ACHIEVEMENTS = [
  { id: 'first_word', name: 'Từ đầu tiên', icon: '🌱', desc: 'Học từ đầu tiên', condition: (s) => s.totalMastered >= 1 },
  { id: 'words_10', name: '10 từ', icon: '📗', desc: '10 từ vựng', condition: (s) => s.totalMastered >= 10 },
  { id: 'words_50', name: '50 từ', icon: '📘', desc: '50 từ vựng', condition: (s) => s.totalMastered >= 50 },
  { id: 'words_100', name: '100 từ', icon: '📙', desc: '100 từ vựng', condition: (s) => s.totalMastered >= 100 },
  { id: 'first_lesson', name: 'Bài đầu tiên', icon: '🎯', desc: 'Hoàn thành bài đầu', condition: (s) => s.completedLessons >= 1 },
  { id: 'lessons_10', name: '10 bài', icon: '🌟', desc: '10 bài học', condition: (s) => s.completedLessons >= 10 },
  { id: 'level_5', name: 'Level 5', icon: '🚀', desc: 'Đạt Level 5', condition: (s) => s.level >= 5 },
  { id: 'level_10', name: 'Level 10', icon: '💎', desc: 'Đạt Level 10', condition: (s) => s.level >= 10 }
];

function checkAchievements() {
  const user = Storage.getUser();
  if (!user) return [];
  const progress = Storage.getProgress();
  let totalMastered = 0, completedLessons = 0;
  Object.values(progress).forEach(p => {
    if (p.masteredCards) totalMastered += p.masteredCards.length;
    if (p.completedExercises && p.completedExercises.length >= 8) completedLessons++;
  });
  const stats = {
    totalMastered,
    completedLessons,
    ieltsCompleted: 0,
    toeicCompleted: 0,
    level: user.level || 1
  };
  const newlyUnlocked = [];
  ACHIEVEMENTS.forEach(ach => {
    if (!Storage.hasAchievement(ach.id) && ach.condition(stats)) {
      Storage.unlockAchievement(ach.id);
      newlyUnlocked.push(ach);
    }
  });
  return newlyUnlocked;
}
