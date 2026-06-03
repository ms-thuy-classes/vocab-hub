/* ========================================
   STORAGE.JS - Quản lý LocalStorage
   Lưu trữ: user, XP, level, achievements,
   progress, favorites, scores
   ======================================== */

const STORAGE_KEYS = {
  USER: 'msthuy_user',
  PROGRESS: 'msthuy_progress',
  FAVORITES: 'msthuy_favorites',
  SCORES: 'msthuy_scores',
  THEME: 'msthuy_theme'
};

// ---------- User Management ----------
const Storage = {
  // Lấy thông tin user
  getUser() {
    const data = localStorage.getItem(STORAGE_KEYS.USER);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  },

  // Lưu thông tin user
  saveUser(user) {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  },

  // Tạo user mới
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

  // Cập nhật XP và level
  addXP(amount) {
    const user = this.getUser();
    if (!user) return null;
    user.xp += amount;
    user.level = this.calculateLevel(user.xp);
    user.lastActive = Date.now();
    this.saveUser(user);
    return user;
  },

  // Tính level từ XP
  calculateLevel(xp) {
    // Level 1 = 0 XP, Level 2 = 100 XP, Level 3 = 220 XP...
    // Formula: level = floor((sqrt(1 + 8*xp/100) - 1) / 2) + 1
    let level = Math.floor((Math.sqrt(1 + 8 * xp / 100) - 1) / 2) + 1;
    return Math.min(Math.max(level, 1), 50);
  },

  // XP cần cho level tiếp theo
  xpForNextLevel(level) {
    return Math.floor(100 * level * (level + 1) / 2);
  },

  // XP của level hiện tại
  xpForCurrentLevel(level) {
    if (level <= 1) return 0;
    return Math.floor(100 * (level - 1) * level / 2);
  },

  // Title theo level
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

  // ---------- Progress ----------
  getProgress() {
    const data = localStorage.getItem(STORAGE_KEYS.PROGRESS);
    if (!data) return {};
    try {
      return JSON.parse(data);
    } catch (e) {
      return {};
    }
  },

  saveProgress(progress) {
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progress));
  },

  // Cập nhật tiến độ 1 bài học
  updateLessonProgress(lessonId, data) {
    const progress = this.getProgress();
    if (!progress[lessonId]) {
      progress[lessonId] = {
        openedAt: Date.now(),
        lastAccess: Date.now(),
        completedExercises: [],
        masteredCards: [],
        score: null,
        totalScore: null,
        grade: null
      };
    }
    progress[lessonId] = { ...progress[lessonId], ...data, lastAccess: Date.now() };
    this.saveProgress(progress);
    return progress[lessonId];
  },

  // Lấy tiến độ 1 bài học
  getLessonProgress(lessonId) {
    const progress = this.getProgress();
    return progress[lessonId] || null;
  },

  // Đếm số bài đã hoàn thành
  getCompletedCount() {
    const progress = this.getProgress();
    return Object.values(progress).filter(p =>
      p.completedExercises && p.completedExercises.length >= 8
    ).length;
  },

  // Lấy danh sách bài đang học (để Continue Learning)
  getRecentLessons(limit = 3) {
    const progress = this.getProgress();
    return Object.entries(progress)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.lastAccess - a.lastAccess)
      .slice(0, limit);
  },

  // ---------- Favorites ----------
  getFavorites() {
    const data = localStorage.getItem(STORAGE_KEYS.FAVORITES);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  },

  saveFavorites(favorites) {
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
  },

  toggleFavorite(lessonId) {
    const favorites = this.getFavorites();
    const idx = favorites.indexOf(lessonId);
    if (idx >= 0) {
      favorites.splice(idx, 1);
    } else {
      favorites.push(lessonId);
    }
    this.saveFavorites(favorites);
    return favorites;
  },

  isFavorite(lessonId) {
    return this.getFavorites().includes(lessonId);
  },

  // ---------- Scores ----------
  getScores() {
    const data = localStorage.getItem(STORAGE_KEYS.SCORES);
    if (!data) return {};
    try {
      return JSON.parse(data);
    } catch (e) {
      return {};
    }
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

  // ---------- Theme ----------
  getTheme() {
    return localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
  },

  setTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  },

  // ---------- Achievements ----------
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
  },

  // ---------- Reset ----------
  resetAll() {
    if (confirm('Bạn có chắc muốn xóa toàn bộ dữ liệu?')) {
      Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
      location.reload();
    }
  }
};

// Định nghĩa các thành tựu
const ACHIEVEMENTS = [
  { id: 'first_word', name: 'Từ đầu tiên', icon: '🌱', desc: 'Học từ vựng đầu tiên', condition: (stats) => stats.totalMastered >= 1 },
  { id: 'words_10', name: '10 từ vựng', icon: '📗', desc: 'Học được 10 từ', condition: (stats) => stats.totalMastered >= 10 },
  { id: 'words_50', name: '50 từ vựng', icon: '📘', desc: 'Học được 50 từ', condition: (stats) => stats.totalMastered >= 50 },
  { id: 'words_100', name: '100 từ vựng', icon: '📙', desc: 'Học được 100 từ', condition: (stats) => stats.totalMastered >= 100 },
  { id: 'words_500', name: '500 từ vựng', icon: '📕', desc: 'Học được 500 từ', condition: (stats) => stats.totalMastered >= 500 },
  { id: 'words_1000', name: '1000 từ vựng', icon: '🏆', desc: 'Học được 1000 từ', condition: (stats) => stats.totalMastered >= 1000 },
  { id: 'first_lesson', name: 'Bài đầu tiên', icon: '🎯', desc: 'Hoàn thành bài học đầu tiên', condition: (stats) => stats.completedLessons >= 1 },
  { id: 'lessons_5', name: '5 bài học', icon: '⭐', desc: 'Hoàn thành 5 bài học', condition: (stats) => stats.completedLessons >= 5 },
  { id: 'lessons_10', name: '10 bài học', icon: '🌟', desc: 'Hoàn thành 10 bài học', condition: (stats) => stats.completedLessons >= 10 },
  { id: 'first_ielts', name: 'IELTS Starter', icon: '🎓', desc: 'Hoàn thành bài IELTS đầu tiên', condition: (stats) => stats.ieltsCompleted >= 1 },
  { id: 'first_toeic', name: 'TOEIC Starter', icon: '💼', desc: 'Hoàn thành bài TOEIC đầu tiên', condition: (stats) => stats.toeicCompleted >= 1 },
  { id: 'level_5', name: 'Level 5', icon: '🚀', desc: 'Đạt Level 5', condition: (stats) => stats.level >= 5 },
  { id: 'level_10', name: 'Level 10', icon: '💎', desc: 'Đạt Level 10', condition: (stats) => stats.level >= 10 },
  { id: 'level_25', name: 'Level 25', icon: '👑', desc: 'Đạt Level 25', condition: (stats) => stats.level >= 25 }
];

// Kiểm tra và mở khóa thành tựu
function checkAchievements() {
  const user = Storage.getUser();
  if (!user) return [];

  const progress = Storage.getProgress();
  const scores = Storage.getScores();

  // Tính thống kê
  let totalMastered = 0;
  let completedLessons = 0;
  let ieltsCompleted = 0;
  let toeicCompleted = 0;

  Object.values(progress).forEach(p => {
    if (p.masteredCards) totalMastered += p.masteredCards.length;
    if (p.completedExercises && p.completedExercises.length >= 8) {
      completedLessons++;
      // Kiểm tra category
      if (p.category === 'ielts') ieltsCompleted++;
      if (p.category === 'toeic') toeicCompleted++;
    }
  });

  const stats = {
    totalMastered,
    completedLessons,
    ieltsCompleted,
    toeicCompleted,
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
