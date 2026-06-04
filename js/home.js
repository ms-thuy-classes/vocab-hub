let allArticles = [];
let currentFilter = 'all';
let currentSort = 'default';
let currentQuery = '';

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Khởi động trang chủ...');
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
    console.error('Không load được articles.json');
    const grid = document.getElementById('lessonsGrid');
    if (grid) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">⚠️</div><h3>Không tải được bài học</h3><p>Kiểm tra file data/articles.json</p></div>';
    }
    return;
  }
  console.log('Đã load ' + allArticles.length + ' bài học (chỉ lesson)');
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

// Lọc chỉ giữ các bài có layout = "lesson" (hoặc không có layout – mặc định coi là lesson)
function filterValidArticles(articles) {
  if (!articles) return [];
  return articles.filter(article => {
    // Chỉ chấp nhận bài có layout là "lesson" hoặc không có layout (coi như lesson)
    const layout = article.layout;
    return !layout || layout === 'lesson';
  });
}

async function loadArticles() {
  const paths = ['data/articles.json', './data/articles.json'];
  for (const path of paths) {
    try {
      console.log('Thử fetch: ' + path);
      const response = await fetch(path, { cache: 'no-cache' });
      console.log('Status: ' + response.status);
      if (!response.ok) continue;
      const data = await response.json();
      // Lọc chỉ giữ bài lesson
      allArticles = filterValidArticles(data.articles || []);
      console.log('Load được ' + allArticles.length + ' bài (đã lọc)');
      return true;
    } catch (error) {
      console.error('Lỗi: ' + error.message);
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
    const page = article.page || 'lessons/lesson.html'; // fallback
    html += '<a href="' + page + '?id=' + article.id + '" class="lesson-card">';
    html += '<div class="continue-icon">' + (article.icon || '📖') + '</div>';
    html += '<div class="continue-info">';
    html += '<div class="continue-title">' + article.title + '</div>';
    html += '<div style="font-size:0.8rem;color:#6b7280;">' + progress + '/8 bài tập</div>';
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
  if (countEl) countEl.textContent = filtered.length + ' bài học';
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
  const completedCount = progress?.completedExercises?.length || 0;
  const percent = Math.round((completedCount / 8) * 100);
  const tags = (article.tags || []).slice(0, 3).map(tag => `<span class="lesson-tag">#${tag}</span>`).join('');

  return `
    <a href="lessons/lesson.html?id=${article.id}" class="lesson-card">
      <button class="lesson-favorite ${isFav ? 'is-favorite' : ''}" data-id="${article.id}">
        ${isFav ? '❤️' : '🤍'}
      </button>
      <div class="lesson-thumbnail">${article.icon || '📖'}</div>
      <div class="lesson-card-body">
        <span class="lesson-level-badge">${article.level}</span>
        <h3 class="lesson-title">${escapeHtml(article.title)}</h3>
        <p class="lesson-description">${escapeHtml(article.description || '')}</p>
        <div class="lesson-meta">
          <span class="lesson-meta-item">💡 ${article.vocabCount || 0} từ</span>
          <span class="lesson-meta-item">📝 ${article.exerciseCount || 8} bài tập</span>
        </div>
        <div class="lesson-tags">${tags}</div>
        ${completedCount > 0 ? `<div class="lesson-progress-bar"><div class="lesson-progress-fill" style="width:${percent}%"></div></div>` : ''}
      </div>
    </a>
  `;
}

// Thêm hàm nhỏ để tránh lỗi XSS
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

function renderAchievementsMini() {
  const container = document.getElementById('achievementsMini');
  if (!container) return;
  const unlocked = ACHIEVEMENTS.filter(a => Storage.hasAchievement(a.id)).slice(0, 5);
  if (unlocked.length === 0) {
    container.innerHTML = '<span style="color:#6b7280;font-size:0.85rem;">Chưa có thành tựu 🌱</span>';
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
    showToast('Xin chào ' + name + '!', 'success');
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
