/* ========================================
   HOME.JS - Logic trang chủ
   Load articles, render cards, stats, XP
   ======================================== */

// ---------- Global State ----------
let allArticles = [];
let currentFilter = 'all';
let currentSort = 'default';
let currentQuery = '';

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', async () => {
  // Kiểm tra user
  const user = Storage.getUser();
  if (!user) {
    showNameModal();
  } else {
    document.getElementById('nameModal').classList.add('hidden');
  }

  // Theme
  initTheme();

  // Load articles
  await loadArticles();

  // Render UI
  renderStats();
  renderXPBar();
  renderContinueLearning();
  renderLessons();
  renderAchievementsMini();

  // Init search & filters
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

  // Kiểm tra achievements
  setTimeout(() => {
    const newAchievements = checkAchievements();
    newAchievements.forEach(ach => {
      showToast(`🏆 Thành tựu mới: ${ach.name}!`, 'achievement');
    });
  }, 1500);
});

// ---------- Load Articles ----------
async function loadArticles() {
  try {
    const response = await fetch('data/articles.json');
    if (!response.ok) throw new Error('Không tải được articles.json');
    const data = await response.json();
    allArticles = data.articles || [];
  } catch (error) {
    console.error('Lỗi load articles:', error);
    showToast('❌ Không tải được danh sách bài học', 'error');
    allArticles = [];
  }
}

// ---------- Render Stats ----------
function renderStats() {
  const totalLessons = allArticles.length;
  const totalWords = allArticles.reduce((sum, a) => sum + (a.vocabCount || 0), 0);
  const completed = Storage.getCompletedCount();
  const progress = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;

  animateCounter('statLessons', totalLessons);
  animateCounter('statWords', totalWords);
  animateCounter('statCompleted', completed);
  document.getElementById('statProgress').textContent = progress + '%';
}

function animateCounter(elementId, target) {
  const el = document.getElementById(elementId);
  if (!el) return;

  let current = 0;
  const duration = 1000;
  const step = target / (duration / 16);

  const timer = setInterval(() => {
    current += step;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    el.textContent = Math.floor(current);
  }, 16);
}

// ---------- Render XP Bar ----------
function renderXPBar() {
  const user = Storage.getUser();
  if (!user) return;

  const level = user.level || 1;
  const xp = user.xp || 0;
  const currentLevelXP = Storage.xpForCurrentLevel(level);
  const nextLevelXP = Storage.xpForNextLevel(level);
  const xpInLevel = xp - currentLevelXP;
  const xpNeeded = nextLevelXP - currentLevelXP;
  const percent = Math.min((xpInLevel / xpNeeded) * 100, 100);

  document.getElementById('currentLevel').textContent = level;
  document.getElementById('currentXP').textContent = xp;
  document.getElementById('nextLevelXP').textContent = nextLevelXP;
  document.getElementById('xpTitle').textContent = Storage.getLevelTitle(level);
  document.getElementById('userLevelBadge').textContent = `Lv.${level}`;
  document.getElementById('userXPBadge').textContent = `${xp} XP`;

  setTimeout(() => {
    document.getElementById('xpFill').style.width = percent + '%';
  }, 200);
}

// ---------- Render Continue Learning ----------
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
  grid.innerHTML = recent.map(item => {
    const article = allArticles.find(a => a.id === item.id);
    if (!article) return '';

    const progress = item.completedExercises ? item.completedExercises.length : 0;
    const percent = Math.round((progress / 8) * 100);

    return `
      <a href="lessons/lesson.html?id=${article.id}" class="continue-card">
        <div class="continue-icon">${article.icon || '📖'}</div>
        <div class="continue-info">
          <div class="continue-title">${article.title}</div>
          <div style="font-size:0.8rem;color:#6b7280;">${progress}/8 bài tập</div>
          <div class="continue-progress">
            <div class="continue-progress-fill" style="width:${percent}%"></div>
          </div>
        </div>
      </a>
    `;
  }).join('');
}

// ---------- Render Lessons Grid ----------
function renderLessons() {
  const grid = document.getElementById('lessonsGrid');
  const emptyState = document.getElementById('emptyState');
  const countEl = document.getElementById('resultsCount');
  if (!grid) return;

  const favorites = Storage.getFavorites();
  const filtered = Filters.applyAll(allArticles, currentFilter, currentSort, currentQuery, favorites);

  countEl.textContent = `${filtered.length} bài học`;

  if (filtered.length === 0) {
    grid.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  grid.innerHTML = filtered.map(article => renderLessonCard(article)).join('');

  // Attach favorite button events
  grid.querySelectorAll('.lesson-favorite').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.dataset.id;
      Storage.toggleFavorite(id);
      btn.classList.toggle('is-favorite');
      btn.textContent = btn.classList.contains('is-favorite') ? '❤️' : '🤍';

      // Nếu đang filter favorites, render lại
      if (currentFilter === 'favorites') {
        renderLessons();
      }
    });
  });
}

function renderLessonCard(article) {
  const isFav = Storage.isFavorite(article.id);
  const progress = Storage.getLessonProgress(article.id);
  const completedCount = progress?.completedExercises?.length || 0;
  const percent = Math.round((completedCount / 8) * 100);

  const tags = (article.tags || []).slice(0, 3).map(tag =>
    `<span class="lesson-tag">#${tag}</span>`
  ).join('');

  return `
    <a href="lessons/lesson.html?id=${article.id}" class="lesson-card">
      <button class="lesson-favorite ${isFav ? 'is-favorite' : ''}" data-id="${article.id}" title="Yêu thích">
        ${isFav ? '❤️' : '🤍'}
      </button>
      <div class="lesson-thumbnail">
        ${article.icon || '📖'}
      </div>
      <div class="lesson-card-body">
        <span class="lesson-level-badge">${article.level}</span>
        <h3 class="lesson-title">${article.title}</h3>
        <p class="lesson-description">${article.description || ''}</p>
        <div class="lesson-meta">
          <span class="lesson-meta-item">💡 ${article.vocabCount || 0} từ</span>
          <span class="lesson-meta-item">📝 ${article.exerciseCount || 8} bài tập</span>
        </div>
        <div class="lesson-tags">${tags}</div>
        ${completedCount > 0 ? `
          <div class="lesson-progress-bar">
            <div class="lesson-progress-fill" style="width:${percent}%"></div>
          </div>
        ` : ''}
      </div>
    </a>
  `;
}

// ---------- Render Achievements Mini ----------
function renderAchievementsMini() {
  const container = document.getElementById('achievementsMini');
  if (!container) return;

  const unlocked = ACHIEVEMENTS.filter(a => Storage.hasAchievement(a.id)).slice(0, 5);
  if (unlocked.length === 0) {
    container.innerHTML = '<span style="color:#6b7280;font-size:0.85rem;">Chưa có thành tựu nào. Bắt đầu học nhé! 🌱</span>';
    return;
  }

  container.innerHTML = unlocked.map(a =>
    `<span class="mini-badge" onclick="openAchievementModal()" title="${a.desc}">${a.icon} ${a.name}</span>`
  ).join('') + (ACHIEVEMENTS.length > 5 ? `<span class="mini-badge" onclick="openAchievementModal()">+${ACHIEVEMENTS.length - 5} nữa</span>` : '');
}

// ---------- Name Modal ----------
function showNameModal() {
  const modal = document.getElementById('nameModal');
  modal.classList.remove('hidden');

  const input = document.getElementById('studentNameInput');
  const btn = document.getElementById('saveNameBtn');

  input.focus();

  const save = () => {
    const name = input.value.trim();
    if (!name) {
      input.style.borderColor = '#ef4444';
      input.focus();
      return;
    }
    Storage.createUser(name);
    modal.classList.add('hidden');
    showToast(`👋 Chào ${name}! Bắt đầu học thôi!`, 'success');
    renderXPBar();
  };

  btn.onclick = save;
  input.onkeypress = (e) => {
    if (e.key === 'Enter') save();
  };
}

// ---------- Theme ----------
function initTheme() {
  const theme = Storage.getTheme();
  if (theme === 'dark') {
    document.body.classList.add('dark-mode');
    document.getElementById('themeToggle').textContent = '☀️';
  }

  document.getElementById('themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    Storage.setTheme(isDark ? 'dark' : 'light');
    document.getElementById('themeToggle').textContent = isDark ? '☀️' : '🌙';
  });
}

// ---------- Achievement Modal ----------
function openAchievementModal() {
  const modal = document.getElementById('achievementModal');
  const list = document.getElementById('achievementsList');
  if (!modal || !list) return;

  list.innerHTML = ACHIEVEMENTS.map(a => {
    const unlocked = Storage.hasAchievement(a.id);
    return `
      <div class="achievement-item ${unlocked ? 'unlocked' : 'locked'}">
        <div class="achievement-icon">${a.icon}</div>
        <div class="achievement-name">${a.name}</div>
        <div style="font-size:0.7rem;color:#6b7280;margin-top:0.3rem;">${a.desc}</div>
      </div>
    `;
  }).join('');

  modal.classList.remove('hidden');
}

function closeAchievementModal() {
  document.getElementById('achievementModal').classList.add('hidden');
}

// ---------- Toast ----------
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = {
    success: '✅',
    error: '❌',
    achievement: '🏆',
    info: 'ℹ️'
  };

  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <span>${message}</span>
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideInRight 0.3s reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
