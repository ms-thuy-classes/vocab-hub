let allArticles = [];
let currentFilter = 'all';
let currentSort = 'default';
let currentQuery = '';

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Khoi dong trang chu...');
  const user = Storage.getUser();
  if (!user) {
    showNameModal();
  } else {
    const nameModal = document.getElementById('nameModal');
    if (nameModal) nameModal.classList.add('hidden');
  }
  initTheme();
  const loaded = await loadArticles();
  if (!loaded) {
    console.error('Khong load duoc articles.json');
    const grid = document.getElementById('lessonsGrid');
    if (grid) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">⚠️</div><h3>Khong tai duoc bai hoc</h3><p>Kiem tra file data/articles.json</p></div>';
    }
    return;
  }
  console.log('Da load ' + allArticles.length + ' bai hoc');
  renderStats();
  renderXPBar();
  renderContinueLearning();
  renderLessons();
  renderAchievementsMini();
  Search.init('searchInput', (query) => {
    currentQuery = query;
    renderLessons();
  });
  Filters.init('filterChips', (filter, sort) => {
    currentFilter = filter;
    currentSort = sort;
    renderLessons();
  });
  Filters.initSort('sortSelect', (filter, sort) => {
    currentFilter = filter;
    currentSort = sort;
    renderLessons();
  });
});

async function loadArticles() {
  const paths = ['data/articles.json', './data/articles.json'];
  for (const path of paths) {
    try {
      console.log('Thu fetch: ' + path);
      const response = await fetch(path, { cache: 'no-cache' });
      console.log('Status: ' + response.status);
      if (!response.ok) continue;
      const data = await response.json();
      allArticles = data.articles || [];
      console.log('Load duoc ' + allArticles.length + ' bai');
      return true;
    } catch (error) {
      console.error('Loi: ' + error.message);
    }
  }
  return false;
}

function renderStats() {
  const totalLessons = allArticles.length;
  const totalWords = allArticles.reduce((sum, a) => sum + (a.vocabCount || 0), 0);
  const completed = Storage.getCompletedCount();
  const progress = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;
  animateCounter('statLessons', totalLessons);
  animateCounter('statWords', totalWords);
  animateCounter('statCompleted', completed);
  const progressEl = document.getElementById('statProgress');
  if (progressEl) progressEl.textContent = progress + '%';
}

function animateCounter(elementId, target) {
  const el = document.getElementById(elementId);
  if (!el) return;
  let current = 0;
  const step = Math.max(target / 60, 1);
  const timer = setInterval(() => {
    current += step;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    el.textContent = Math.floor(current);
  }, 16);
}

function renderXPBar() {
  const user = Storage.getUser();
  if (!user) return;
  const level = user.level || 1;
  const xp = user.xp || 0;
  const currentLevelXP = Storage.xpForCurrentLevel(level);
  const nextLevelXP = Storage.xpForNextLevel(level);
  const xpInLevel = xp - currentLevelXP;
  const xpNeeded = nextLevelXP - currentLevelXP;
  const percent = xpNeeded > 0 ? Math.min((xpInLevel / xpNeeded) * 100, 100) : 0;
  const els = {
    currentLevel: document.getElementById('currentLevel'),
    currentXP: document.getElementById('currentXP'),
    nextLevelXP: document.getElementById('nextLevelXP'),
    xpTitle: document.getElementById('xpTitle'),
    userLevelBadge: document.getElementById('userLevelBadge'),
    userXPBadge: document.getElementById('userXPBadge'),
    xpFill: document.getElementById('xpFill')
  };
  if (els.currentLevel) els.currentLevel.textContent = level;
  if (els.currentXP) els.currentXP.textContent = xp;
  if (els.nextLevelXP) els.nextLevelXP.textContent = nextLevelXP;
  if (els.xpTitle) els.xpTitle.textContent = Storage.getLevelTitle(level);
  if (els.userLevelBadge) els.userLevelBadge.textContent = 'Lv.' + level;
  if (els.userXPBadge) els.userXPBadge.textContent = xp + ' XP';
  setTimeout(() => {
    if (els.xpFill) els.xpFill.style.width = percent + '%';
  }, 200);
}

function renderContinueLearning() {
  const section = document.getElementById('continueSection');
  const grid = document.getElementById('continueGrid');
  if (!section || !grid) return;
  const recent = Storage.getRecentLessons(3);
  if (recent.length === 0) {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';
  let html = '';
  recent.forEach(item => {
    const article = allArticles.find(a => a.id === item.id);
    if (!article) return;
    const progress = item.completedExercises ? item.completedExercises.length : 0;
    const percent = Math.round((progress / 8) * 100);
    html += '<a href="lessons/lesson.html?id=' + article.id + '" class="continue-card">';
    html += '<div class="continue-icon">' + (article.icon || '📖') + '</div>';
    html += '<div class="continue-info">';
    html += '<div class="continue-title">' + article.title + '</div>';
    html += '<div style="font-size:0.8rem;color:#6b7280;">' + progress + '/8 bai tap</div>';
    html += '<div class="continue-progress"><div class="continue-progress-fill" style="width:' + percent + '%"></div></div>';
    html += '</div></a>';
  });
  grid.innerHTML = html;
}

function renderLessons() {
  const grid = document.getElementById('lessonsGrid');
  const emptyState = document.getElementById('emptyState');
  const countEl = document.getElementById('resultsCount');
  if (!grid) return;
  const favorites = Storage.getFavorites();
  const filtered = Filters.applyAll(allArticles, currentFilter, currentSort, currentQuery, favorites);
  if (countEl) countEl.textContent = filtered.length + ' bai hoc';
  if (filtered.length === 0) {
    grid.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }
  if (emptyState) emptyState.classList.add('hidden');
  let html = '';
  filtered.forEach(article => {
    html += renderLessonCard(article);
  });
  grid.innerHTML = html;
  grid.querySelectorAll('.lesson-favorite').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.dataset.id;
      Storage.toggleFavorite(id);
      btn.classList.toggle('is-favorite');
      btn.textContent = btn.classList.contains('is-favorite') ? '❤️' : '🤍';
      if (currentFilter === 'favorites') renderLessons();
    });
  });
}

function renderLessonCard(article) {
  const isFav = Storage.isFavorite(article.id);
  const progress = Storage.getLessonProgress(article.id);
  const completedCount = progress && progress.completedExercises ? progress.completedExercises.length : 0;
  const percent = Math.round((completedCount / 8) * 100);
  let tagsHtml = '';
  const tags = (article.tags || []).slice(0, 3);
  tags.forEach(tag => {
    tagsHtml += '<span class="lesson-tag">#' + tag + '</span>';
  });
  let progressBar = '';
  if (completedCount > 0) {
    progressBar = '<div class="lesson-progress-bar"><div class="lesson-progress-fill" style="width:' + percent + '%"></div></div>';
  }
  let html = '<a href="lessons/lesson.html?id=' + article.id + '" class="lesson-card">';
  html += '<button class="lesson-favorite ' + (isFav ? 'is-favorite' : '') + '" data-id="' + article.id + '">';
  html += (isFav ? '❤️' : '🤍');
  html += '</button>';
  html += '<div class="lesson-thumbnail">' + (article.icon || '📖') + '</div>';
  html += '<div class="lesson-card-body">';
  html += '<span class="lesson-level-badge">' + article.level + '</span>';
  html += '<h3 class="lesson-title">' + article.title + '</h3>';
  html += '<p class="lesson-description">' + (article.description || '') + '</p>';
  html += '<div class="lesson-meta">';
  html += '<span class="lesson-meta-item">💡 ' + (article.vocabCount || 0) + ' tu</span>';
  html += '<span class="lesson-meta-item">📝 ' + (article.exerciseCount || 8) + ' bai tap</span>';
  html += '</div>';
  html += '<div class="lesson-tags">' + tagsHtml + '</div>';
  html += progressBar;
  html += '</div></a>';
  return html;
}

function renderAchievementsMini() {
  const container = document.getElementById('achievementsMini');
  if (!container) return;
  const unlocked = ACHIEVEMENTS.filter(a => Storage.hasAchievement(a.id)).slice(0, 5);
  if (unlocked.length === 0) {
    container.innerHTML = '<span style="color:#6b7280;font-size:0.85rem;">Chua co thanh tuu 🌱</span>';
    return;
  }
  let html = '';
  unlocked.forEach(a => {
    html += '<span class="mini-badge" onclick="openAchievementModal()" title="' + a.desc + '">' + a.icon + ' ' + a.name + '</span>';
  });
  container.innerHTML = html;
}

function showNameModal() {
  const modal = document.getElementById('nameModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const input = document.getElementById('studentNameInput');
  const btn = document.getElementById('saveNameBtn');
  if (input) input.focus();
  const save = () => {
    const name = input.value.trim();
    if (!name) {
      input.style.borderColor = '#ef4444';
      return;
    }
    Storage.createUser(name);
    modal.classList.add('hidden');
    showToast('Xin chao ' + name + '!', 'success');
    renderXPBar();
  };
  if (btn) btn.onclick = save;
  if (input) input.onkeypress = (e) => { if (e.key === 'Enter') save(); };
}

function initTheme() {
  const theme = Storage.getTheme();
  const toggleBtn = document.getElementById('themeToggle');
  if (!toggleBtn) return;
  if (theme === 'dark') {
    document.body.classList.add('dark-mode');
    toggleBtn.textContent = '☀️';
  }
  toggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    Storage.setTheme(isDark ? 'dark' : 'light');
    toggleBtn.textContent = isDark ? '☀️' : '🌙';
  });
}

function openAchievementModal() {
  const modal = document.getElementById('achievementModal');
  const list = document.getElementById('achievementsList');
  if (!modal || !list) return;
  let html = '';
  ACHIEVEMENTS.forEach(a => {
    const unlocked = Storage.hasAchievement(a.id);
    html += '<div class="achievement-item ' + (unlocked ? 'unlocked' : 'locked') + '">';
    html += '<div class="achievement-icon">' + a.icon + '</div>';
    html += '<div class="achievement-name">' + a.name + '</div>';
    html += '<div style="font-size:0.7rem;color:#6b7280;margin-top:0.3rem;">' + a.desc + '</div>';
    html += '</div>';
  });
  list.innerHTML = html;
  modal.classList.remove('hidden');
}

function closeAchievementModal() {
  const modal = document.getElementById('achievementModal');
  if (modal) modal.classList.add('hidden');
}

function showToast(message, type) {
  type = type || 'info';
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  const icons = { success: '✅', error: '❌', achievement: '🏆', info: 'ℹ️' };
  toast.innerHTML = '<span class="toast-icon">' + (icons[type] || 'ℹ️') + '</span><span>' + message + '</span>';
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
