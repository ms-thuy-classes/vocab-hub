
/* ========================================
   LESSON.JS - Logic trang bài học
   Load JSON, flashcard, exercises
   ======================================== */

// ---------- Global ----------
let vocabulary = [];
let lessonData = null;
let lessonId = null;
let currentCardIndex = 0;
let masteredCards = new Set();
let currentFlipped = false;
let exerciseScores = {
  vnToEn: null, enToVn: null, fillBlank: null,
  wordScramble: null, sentenceScramble: null,
  matching: null, listening: null, test: null
};
let activeTab = 'vnToEn';
let totalHintsAllowed = 25;
let usedHints = 0;

// ---------- Định nghĩa hàm initInlineNameEditor (phải trước khi dùng) ----------
function initInlineNameEditor() {
  const nameInput = document.getElementById('studentNameInline');
  const updateBtn = document.getElementById('updateNameInline');
  const feedbackSpan = document.getElementById('nameFeedback');

  if (!nameInput || !updateBtn) return;

  const currentUser = Storage.getUser();
  if (currentUser && currentUser.name) {
    nameInput.value = currentUser.name;
  }

  updateBtn.addEventListener('click', () => {
    const newName = nameInput.value.trim();
    if (newName === '') {
      if (feedbackSpan) {
        feedbackSpan.textContent = '⚠️ Tên không được để trống';
        feedbackSpan.style.color = '#ef4444';
        setTimeout(() => { feedbackSpan.textContent = ''; }, 2000);
      }
      return;
    }

    let user = Storage.getUser();
    if (user) {
      user.name = newName;
      Storage.saveUser(user);
    } else {
      Storage.createUser(newName);
    }

    if (feedbackSpan) {
      feedbackSpan.textContent = '✅ Đã lưu tên!';
      feedbackSpan.style.color = '#10b981';
      setTimeout(() => { feedbackSpan.textContent = ''; }, 2000);
    }

    if (typeof renderXPBar === 'function') renderXPBar();
    if (typeof showToast === 'function') showToast(`👋 Chào ${newName}!`, 'success');
  });

  nameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      updateBtn.click();
    }
  });
}

// ---------- Init (CHỈ MỘT LẦN DUY NHẤT) ----------
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  lessonId = params.get('id');

  if (!lessonId) {
    alert('Không tìm thấy bài học!');
    window.location.href = '../index.html';
    return;
  }

  await loadLessonData();
  renderBanner();
  loadProgress();
  updateFlashcardDisplay();
  initExercise('vnToEn');
  updateCompletedCount();
  updateExerciseTabs();
  initMusic();
  initMascot();
  initFavoriteBtn();

  // GỌI HÀM NHẬP TÊN (sau khi mọi thứ sẵn sàng)
  initInlineNameEditor();
});

// ---------- Các hàm còn lại giữ nguyên (loadLessonData, renderBanner, ...) ----------
// ... (phần code cũ từ dòng ~100 trở đi không thay đổi)
// ---------- Load Lesson Data ----------
async function loadLessonData() {
  try {
    // Tìm file từ articles.json
    const articlesRes = await fetch('../data/articles.json');
    const articlesData = await articlesRes.json();
    const article = articlesData.articles.find(a => a.id === lessonId);

    if (!article) {
      alert('Bài học không tồn tại!');
      window.location.href = '../index.html';
      return;
    }

    // Load vocabulary file
    const vocabRes = await fetch(`../data/${article.file}`);
    lessonData = await vocabRes.json();
    vocabulary = lessonData.vocabulary || [];

    if (vocabulary.length === 0) {
      alert('Bài học chưa có từ vựng!');
    }

    document.title = `${lessonData.title} • Ms. Thúy`;
  } catch (error) {
    console.error('Lỗi load lesson:', error);
    alert('Không tải được bài học!');
    window.location.href = '../index.html';
  }
}

// ---------- Render Banner ----------
function renderBanner() {
  if (!lessonData) return;
  document.getElementById('bannerIcon').textContent = lessonData.icon || '📖';
  document.getElementById('bannerTitle').textContent = lessonData.title;
  document.getElementById('bannerDesc').textContent = lessonData.description || '';
  document.getElementById('bannerVocabCount').textContent = `${vocabulary.length} từ`;

  // Update favorite button
  const favBtn = document.getElementById('favoriteBtn');
  if (Storage.isFavorite(lessonId)) {
    favBtn.classList.add('is-favorite');
    favBtn.textContent = '❤️';
  }
}

function initFavoriteBtn() {
  const btn = document.getElementById('favoriteBtn');
  btn.addEventListener('click', () => {
    Storage.toggleFavorite(lessonId);
    const isFav = Storage.isFavorite(lessonId);
    btn.classList.toggle('is-favorite', isFav);
    btn.textContent = isFav ? '❤️' : '🤍';
    showToast(isFav ? '❤️ Đã thêm vào yêu thích' : '🤍 Đã bỏ yêu thích', 'success');
  });
}

// ---------- Load Progress ----------
function loadProgress() {
  const progress = Storage.getLessonProgress(lessonId);
  if (!progress) return;

  if (progress.masteredCards) {
    masteredCards = new Set(progress.masteredCards);
  }
  if (progress.currentCardIndex !== undefined) {
    currentCardIndex = Math.min(progress.currentCardIndex, vocabulary.length - 1);
  }

  // Load scores
  const scores = Storage.getLessonScores(lessonId);
  Object.keys(exerciseScores).forEach(key => {
    if (scores[key]) exerciseScores[key] = scores[key];
  });

  // Update category cho achievements
  const article = lessonData;
  Storage.updateLessonProgress(lessonId, {
    category: article.category,
    openedAt: progress.openedAt || Date.now()
  });
}

// ---------- Flashcard ----------
function getWordFormColor(wordForm) {
  const form = (wordForm || '').toLowerCase().trim();
  if (form.includes('phrasal')) return 'badge-phr';
  if (form === 'adverb' || form === 'adv') return 'badge-adv';
  if (form === 'adjective' || form === 'adj') return 'badge-adj';
  if (form === 'verb' || form === 'v') return 'badge-v';
  if (form === 'noun' || form === 'n') return 'badge-n';
  if (form.includes('prep')) return 'badge-prep';
  if (form.includes('conj')) return 'badge-conj';
  return 'badge-other';
}

function updateFlashcardDisplay() {
  if (vocabulary.length === 0) return;
  const card = vocabulary[currentCardIndex];
  document.getElementById('front-word').textContent = card.word;

  const wordformEl = document.getElementById('front-wordform');
  wordformEl.textContent = card.wordForm || '';
  wordformEl.className = 'wordform-badge ' + getWordFormColor(card.wordForm);

  document.getElementById('front-ipa').textContent = card.ipa;
  document.getElementById('back-meaning').textContent = card.vietnamese_meaning;
  document.getElementById('back-example').textContent = `"${card.example_sentence}"`;
  document.getElementById('back-translation').textContent = `"${card.example_translation}"`;

  const collEl = document.getElementById('back-collocations');
  if (card.collocations && card.collocations.length > 0) {
    collEl.textContent = '🔗 ' + card.collocations.join(', ');
  } else {
    collEl.textContent = '';
  }

  document.getElementById('flashcard').classList.remove('flipped');
  currentFlipped = false;

  if (masteredCards.has(currentCardIndex)) {
    document.getElementById('flashcard').classList.add('mastered');
  } else {
    document.getElementById('flashcard').classList.remove('mastered');
  }

  updateProgressBar();
  saveProgress();
}

function updateProgressBar() {
  const total = vocabulary.length;
  document.getElementById('progress-fill').style.width = ((currentCardIndex + 1) / total * 100) + '%';
  document.getElementById('progress-text').textContent = `${currentCardIndex + 1}/${total}`;
  document.getElementById('mastered-count').textContent = `Mastered: ${masteredCards.size}`;
}

function flipCard() {
  const container = document.getElementById('flashcard');
  if (currentFlipped) container.classList.remove('flipped');
  else container.classList.add('flipped');
  currentFlipped = !currentFlipped;
}

function speakWord() {
  const word = vocabulary[currentCardIndex].word;
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    speechSynthesis.speak(utterance);
  }
}

function nextCard() {
  currentCardIndex = (currentCardIndex + 1) % vocabulary.length;
  updateFlashcardDisplay();
}

function prevCard() {
  currentCardIndex = (currentCardIndex - 1 + vocabulary.length) % vocabulary.length;
  updateFlashcardDisplay();
}

function markMastered() {
  if (masteredCards.has(currentCardIndex)) {
    masteredCards.delete(currentCardIndex);
  } else {
    masteredCards.add(currentCardIndex);
    // +5 XP cho mỗi từ mastered
    Storage.addXP(5);
    checkAndNotifyAchievements();
  }
  updateFlashcardDisplay();
}

function saveProgress() {
  Storage.updateLessonProgress(lessonId, {
    currentCardIndex: currentCardIndex,
    masteredCards: [...masteredCards],
    category: lessonData?.category
  });
}

// ---------- Tab Switching ----------
function switchTab(tabId) {
  activeTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
    tab.innerHTML = '';
  });
  document.getElementById(tabId).classList.add('active');
  updateExerciseTabs();
  initExercise(tabId);
}

function resetExercise(exKey, tabId) {
  exerciseScores[exKey] = null;
  Storage.saveScore(lessonId, exKey, null);
  const container = document.getElementById(tabId);
  if (container) {
    container.innerHTML = '';
    initExercise(tabId);
  }
  updateCompletedCount();
}

function initExercise(tabId) {
  const container = document.getElementById(tabId);
  if (!container) return;
  if (tabId === 'vnToEn') renderMCQ(container, 'vnToEn');
  else if (tabId === 'enToVn') renderMCQ(container, 'enToVn');
  else if (tabId === 'fillBlank') renderFillBlank(container);
  else if (tabId === 'wordScramble') renderWordScramble(container);
  else if (tabId === 'sentenceScramble') renderSentenceScramble(container);
  else if (tabId === 'matching') renderMatching(container);
  else if (tabId === 'listening') renderListening(container);
  else if (tabId === 'test') renderTest(container);
}

function updateCompletedCount() {
  const done = Object.values(exerciseScores).filter(s => s !== null).length;
  document.getElementById('exercise-progress').innerHTML = `📊 Completed: ${done}/8`;
  updateExerciseTabs();

  // Lưu progress
  const completedExercises = Object.entries(exerciseScores)
    .filter(([_, v]) => v !== null)
    .map(([k, _]) => k);

  Storage.updateLessonProgress(lessonId, {
    completedExercises: completedExercises,
    category: lessonData?.category
  });

  // Nếu hoàn thành tất cả 8 bài
  if (done === 8) {
    Storage.addXP(100);
    checkAndNotifyAchievements();
  }
}

function updateExerciseTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const tabId = btn.dataset.tab;
    btn.classList.remove('active-exercise');
    if (tabId === activeTab) btn.classList.add('active-exercise');
    if (exerciseScores[tabId] !== null) btn.classList.add('done-badge');
    else btn.classList.remove('done-badge');
  });
}

// ---------- Helper Functions ----------
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getShuffledQuestions(dataArray) {
  return shuffleArray([...dataArray]);
}

function playSound(type) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    if (type === 'success') {
      osc.frequency.value = 600;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } else {
      osc.frequency.value = 300;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    }
  } catch (e) {}
}

function showMiniResult(container, { score, total, exKey, tabId }) {
  const grade = (score / total * 10).toFixed(1);
  const percent = (score / total) * 100;
  const circumference = 527;
  const offset = circumference - (percent / 100) * circumference;

  // +10 XP cho mỗi bài tập hoàn thành
  Storage.addXP(10);
  checkAndNotifyAchievements();

  const html = `
    <div class="mini-result">
      <div class="result-badge">🎉 COMPLETED</div>
      <h2 class="result-title">${grade >= 8 ? '🏆 Xuất sắc!' : grade >= 5 ? '✨ Tốt lắm!' : '💪 Cố gắng nhé!'}</h2>
      <p class="result-subtitle">${Storage.getUser()?.name || 'Học viên'}</p>
      <div class="progress-ring-container">
        <svg class="progress-ring" viewBox="0 0 200 200">
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#8B5CF6" />
              <stop offset="50%" stop-color="#EC4899" />
              <stop offset="100%" stop-color="#06B6D4" />
            </linearGradient>
          </defs>
          <circle class="progress-ring__circle-bg" cx="100" cy="100" r="84"></circle>
          <circle class="progress-ring__circle" id="result-circle" cx="100" cy="100" r="84"
            stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}"></circle>
        </svg>
        <div class="progress-ring__text">${grade}</div>
        <div class="progress-ring__label">/10</div>
      </div>
      <div class="stat-grid">
        <div class="stat-item">
          <div class="stat-value">${score}</div>
          <div class="stat-label">Đúng</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${total}</div>
          <div class="stat-label">Tổng</div>
        </div>
      </div>
      <button class="retry-btn" onclick="resetExercise('${exKey}', '${tabId}')">🔄 Làm lại</button>
    </div>
  `;
  container.innerHTML = html;
  setTimeout(() => {
    const circle = document.getElementById('result-circle');
    if (circle) circle.style.strokeDashoffset = offset;
  }, 100);
}

// ---------- MCQ (VN→EN, EN→VN) ----------
function renderMCQ(container, exKey) {
  const total = vocabulary.length;
  let currentQ = 0, score = 0;
  const questions = getShuffledQuestions(vocabulary).map(v => {
    if (exKey === 'vnToEn') {
      const correct = v.word;
      let wrongs = vocabulary.filter(item => item.word !== correct).map(item => item.word);
      wrongs = shuffleArray(wrongs).slice(0, 3);
      const opts = shuffleArray([correct, ...wrongs]);
      return { qText: v.vietnamese_meaning, correct, opts };
    } else {
      const correct = v.vietnamese_meaning;
      let wrongs = vocabulary.filter(item => item.vietnamese_meaning !== correct).map(item => item.vietnamese_meaning);
      wrongs = shuffleArray(wrongs).slice(0, 3);
      const opts = shuffleArray([correct, ...wrongs]);
      return { qText: v.word, correct, opts };
    }
  });

  function renderQuestion() {
    if (currentQ >= total) {
      exerciseScores[exKey] = { score, total, grade: (score / total * 10).toFixed(1) };
      Storage.saveScore(lessonId, exKey, exerciseScores[exKey]);
      updateCompletedCount();
      showMiniResult(container, { score, total, exKey, tabId: exKey });
      return;
    }
    const q = questions[currentQ];
    let html = `
      <div class="quiz-card text-center">
        <div class="mb-2"><span class="text-sm font-bold text-purple-700">Câu ${currentQ + 1}/${total}</span></div>
        <h3 class="text-2xl font-extrabold mb-6 text-gray-800">${q.qText}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl mx-auto">
    `;
    q.opts.forEach(opt => {
      html += `<button class="quiz-option option-btn" data-answer="${opt}">${opt}</button>`;
    });
    html += `</div>
      <div id="feedback-${exKey}" class="mt-4 text-xl font-bold"></div>
      <div id="next-btn-container" class="text-center mt-4" style="display:none;">
        <button class="next-btn" id="next-btn-${exKey}">Next ➡️</button>
      </div>
    </div>`;
    container.innerHTML = html;

    document.querySelectorAll('.option-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const selected = this.dataset.answer;
        const fb = document.getElementById(`feedback-${exKey}`);
        document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
        if (selected === q.correct) {
          score++;
          fb.innerHTML = '<span class="text-green-500">✔ Chính xác!</span>';
          playSound('success');
          this.classList.add('correct-choice');
        } else {
          fb.innerHTML = `<span class="text-red-500">✘ Sai! Đáp án: ${q.correct}</span>`;
          playSound('error');
          this.classList.add('wrong-choice');
          document.querySelectorAll('.option-btn').forEach(b => {
            if (b.dataset.answer === q.correct) b.classList.add('correct-choice');
          });
        }
        document.getElementById(`next-btn-container`).style.display = 'block';
        document.getElementById(`next-btn-${exKey}`).addEventListener('click', () => {
          currentQ++;
          renderQuestion();
        });
      });
    });
  }
  renderQuestion();
}

// ---------- Fill in Blank ----------
// ---------- Fill in Blank (cải tiến: hỗ trợ s/es/ed/ing, viết hoa) ----------
// ---------- Fill in Blank (hỗ trợ biến thể s/es/ies/ed/ing, đáp án đúng là biến thể) ----------
function renderFillBlank(container) {
  const total = vocabulary.length;
  let currentQ = 0, score = 0;

  // Helper escape regex
  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Tạo tất cả biến thể của một từ (dựa trên quy tắc chính tả)
  function getAllVariants(word) {
    const base = word.toLowerCase();
    const variants = new Set();
    variants.add(base);
    // Số nhiều / ngôi ba số ít (s, es, ies)
    if (base.endsWith('y') && !'aeiou'.includes(base[base.length-2])) {
      variants.add(base.slice(0, -1) + 'ies');
      variants.add(base + 's');
    } else if (base.endsWith('s') || base.endsWith('sh') || base.endsWith('ch') || base.endsWith('x') || base.endsWith('z') || base.endsWith('o')) {
      variants.add(base + 'es');
    } else {
      variants.add(base + 's');
    }
    // Quá khứ / phân từ (ed, ing, ied, nhân đôi phụ âm)
    if (base.endsWith('e')) {
      variants.add(base + 'd');
      variants.add(base.slice(0, -1) + 'ing');
    } else if (base.endsWith('y') && !'aeiou'.includes(base[base.length-2])) {
      variants.add(base.slice(0, -1) + 'ied');
      variants.add(base + 'ing');
    } else {
      variants.add(base + 'ed');
      variants.add(base + 'ing');
      // Nhân đôi phụ âm cuối (CVC)
      const last = base[base.length-1];
      const prev = base[base.length-2];
      const vowels = 'aeiou';
      if (base.length >= 3 && !vowels.includes(last) && vowels.includes(prev) && !vowels.includes(base[base.length-3])) {
        variants.add(base + last + 'ed');
        variants.add(base + last + 'ing');
      }
    }
    // Thêm dạng viết hoa chữ cái đầu (cho trường hợp đầu câu)
    const result = new Set();
    variants.forEach(v => {
      result.add(v);
      result.add(v.charAt(0).toUpperCase() + v.slice(1));
    });
    return result;
  }

  // Tạo danh sách câu hỏi
  let questions = [];
  for (let v of vocabulary) {
    const originalSentence = v.example_sentence;
    const originalWord = v.word;
    const variants = getAllVariants(originalWord);
    // Tìm biến thể nào thực sự xuất hiện trong câu gốc
    let correctVariant = null;
    for (let variant of variants) {
      const regex = new RegExp(`\\b${escapeRegex(variant)}\\b`, 'i');
      if (regex.test(originalSentence)) {
        correctVariant = variant;
        break;
      }
    }
    // Nếu không tìm thấy (câu không chứa biến thể nào), dùng từ gốc
    if (!correctVariant) correctVariant = originalWord;

    // Thay thế chính xác biến thể đó bằng _____
    let blankSentence = originalSentence.replace(
      new RegExp(`\\b${escapeRegex(correctVariant)}\\b`, 'i'),
      '_____'
    );

    // Đáp án đúng chính là biến thể đó
    const correct = correctVariant;

    // Đáp án nhiễu: chọn 3 từ gốc từ các từ vựng khác (không biến thể)
    let wrongs = vocabulary.filter(item => item.word !== originalWord).map(item => item.word);
    wrongs = shuffleArray(wrongs).slice(0, 3);
    const opts = shuffleArray([correct, ...wrongs]);

    questions.push({ blankSentence, correct, opts });
  }
  // Trộn thứ tự câu hỏi
  questions = shuffleArray(questions);

  function renderQuestion() {
    if (currentQ >= total) {
      exerciseScores.fillBlank = { score, total, grade: (score / total * 10).toFixed(1) };
      Storage.saveScore(lessonId, 'fillBlank', exerciseScores.fillBlank);
      updateCompletedCount();
      showMiniResult(container, { score, total, exKey: 'fillBlank', tabId: 'fillBlank' });
      return;
    }
    const q = questions[currentQ];
    let html = `
      <div class="quiz-card text-center">
        <div class="mb-2"><span class="text-sm font-bold text-purple-700">Câu ${currentQ + 1}/${total}</span></div>
        <p class="text-2xl italic font-bold text-gray-700 mb-4">"${q.blankSentence}"</p>
        <p class="text-sm text-gray-500 mb-6">(Điền từ còn thiếu)</p>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
    `;
    q.opts.forEach(opt => {
      html += `<button class="quiz-option option-btn" data-answer="${opt}">${opt}</button>`;
    });
    html += `</div>
      <div id="feedback-fillBlank" class="mt-4 text-xl font-bold"></div>
      <div id="next-btn-container" class="text-center mt-4" style="display:none;">
        <button class="next-btn" id="next-btn-fillBlank">Next ➡️</button>
      </div>
    </div>`;
    container.innerHTML = html;

    document.querySelectorAll('.option-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const selected = this.dataset.answer;
        const fb = document.getElementById('feedback-fillBlank');
        document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
        if (selected === q.correct) {
          score++;
          fb.innerHTML = '<span class="text-green-500">✔ Chính xác!</span>';
          playSound('success');
          this.classList.add('correct-choice');
        } else {
          fb.innerHTML = `<span class="text-red-500">✘ Sai! Đáp án: ${q.correct}</span>`;
          playSound('error');
          this.classList.add('wrong-choice');
          document.querySelectorAll('.option-btn').forEach(b => {
            if (b.dataset.answer === q.correct) b.classList.add('correct-choice');
          });
        }
        document.getElementById(`next-btn-container`).style.display = 'block';
        document.getElementById(`next-btn-fillBlank`).addEventListener('click', () => {
          currentQ++;
          renderQuestion();
        });
      });
    });
  }
  renderQuestion();
}
// ---------- Word Scramble ----------
function renderWordScramble(container) {
  const total = vocabulary.length;
  let currentQ = 0, score = 0;
  const questions = getShuffledQuestions(vocabulary).map(v => ({
    original: v.word,
    scrambled: shuffleArray(v.word.split('')),
    meaning: v.vietnamese_meaning
  }));

  function renderQuestion() {
    if (currentQ >= total) {
      exerciseScores.wordScramble = { score, total, grade: (score / total * 10).toFixed(1) };
      Storage.saveScore(lessonId, 'wordScramble', exerciseScores.wordScramble);
      updateCompletedCount();
      showMiniResult(container, { score, total, exKey: 'wordScramble', tabId: 'wordScramble' });
      return;
    }
    const q = questions[currentQ];
    let answerLetters = [];
    const html = `
      <div class="game-container">
        <div class="game-title">🔤 WORD SCRAMBLE</div>
        <div class="text-center"><span class="text-sm font-bold text-gray-600">Câu ${currentQ + 1}/${total}</span></div>
        <div class="text-center mt-2"><span class="game-hint">💡 ${q.meaning}</span></div>
        <div class="game-tiles" id="scrambled-letters"></div>
        <div class="answer-zone" id="answer-area"></div>
        <div class="game-controls">
          <button id="undo-word" class="game-btn game-btn-undo">↶ Undo</button>
          <button id="clear-word" class="game-btn game-btn-clear">🗑️ Clear</button>
          <button id="submit-word" class="game-btn game-btn-submit">✅ Nộp bài</button>
        </div>
        <div class="game-feedback" id="feedback-wordScramble"></div>
        <div id="next-btn-container" class="text-center mt-4" style="display:none;">
          <button class="next-btn" id="next-btn-wordScramble">Next ➡️</button>
        </div>
      </div>
    `;
    container.innerHTML = html;
    const scrambledDiv = document.getElementById('scrambled-letters');
    const answerDiv = document.getElementById('answer-area');
    const fbDiv = document.getElementById('feedback-wordScramble');
    const undoBtn = document.getElementById('undo-word');
    const clearBtn = document.getElementById('clear-word');
    const submitBtn = document.getElementById('submit-word');

    q.scrambled.forEach((letter, idx) => {
      const tile = document.createElement('button');
      tile.className = 'game-tile';
      tile.dataset.letter = letter;
      tile.dataset.index = idx;
      tile.textContent = letter;
      scrambledDiv.appendChild(tile);
    });

    function updateUI() {
      answerDiv.innerHTML = answerLetters.map(l => `<span class="placed-tile">${l}</span>`).join('');
    }

    function lockAll() {
      scrambledDiv.querySelectorAll('.game-tile').forEach(b => b.style.pointerEvents = 'none');
      undoBtn.disabled = true;
      clearBtn.disabled = true;
      submitBtn.disabled = true;
    }

    scrambledDiv.addEventListener('click', (e) => {
      const tile = e.target.closest('.game-tile');
      if (!tile || tile.classList.contains('hidden-tile')) return;
      answerLetters.push(tile.dataset.letter);
      tile.classList.add('hidden-tile');
      updateUI();
    });

    undoBtn.addEventListener('click', () => {
      if (answerLetters.length === 0) return;
      const lastLetter = answerLetters.pop();
      const hiddenTiles = [...scrambledDiv.querySelectorAll('.game-tile.hidden-tile')].reverse();
      const tileToShow = hiddenTiles.find(t => t.dataset.letter === lastLetter);
      if (tileToShow) tileToShow.classList.remove('hidden-tile');
      updateUI();
      fbDiv.innerHTML = '';
    });

    clearBtn.addEventListener('click', () => {
      answerLetters = [];
      scrambledDiv.querySelectorAll('.game-tile').forEach(t => t.classList.remove('hidden-tile'));
      updateUI();
      fbDiv.innerHTML = '';
    });

    submitBtn.addEventListener('click', () => {
      if (answerLetters.length !== q.original.length) {
        fbDiv.innerHTML = '<span style="color:#EF4444;">⚠️ Hãy sắp xếp đủ các chữ cái!</span>';
        return;
      }
      const userWord = answerLetters.join('');
      if (userWord === q.original) {
        score++;
        fbDiv.innerHTML = '<span style="color:#10B981;">✔ Chính xác!</span>';
        playSound('success');
      } else {
        fbDiv.innerHTML = `<span style="color:#EF4444;">✘ Sai! Đáp án: ${q.original}</span>`;
        playSound('error');
      }
      lockAll();
      document.getElementById(`next-btn-container`).style.display = 'block';
      document.getElementById(`next-btn-wordScramble`).addEventListener('click', () => {
        currentQ++;
        renderQuestion();
      });
    });
  }
  renderQuestion();
}

// ---------- Sentence Scramble ----------
function renderSentenceScramble(container) {
  const total = vocabulary.length;
  let currentQ = 0, score = 0;
  const questions = getShuffledQuestions(vocabulary).map(v => ({
    original: v.example_sentence,
    words: v.example_sentence.split(' '),
    scrambled: shuffleArray(v.example_sentence.split(' '))
  }));

  function renderQuestion() {
    if (currentQ >= total) {
      exerciseScores.sentenceScramble = { score, total, grade: (score / total * 10).toFixed(1) };
      Storage.saveScore(lessonId, 'sentenceScramble', exerciseScores.sentenceScramble);
      updateCompletedCount();
      showMiniResult(container, { score, total, exKey: 'sentenceScramble', tabId: 'sentenceScramble' });
      return;
    }
    const q = questions[currentQ];
    let answerWords = [];
    const html = `
      <div class="game-container">
        <div class="game-title">📝 SENTENCE SCRAMBLE</div>
        <div class="text-center"><span class="text-sm font-bold text-gray-600">Câu ${currentQ + 1}/${total}</span></div>
        <div class="game-tiles" id="scrambled-words"></div>
        <div class="answer-zone" id="answer-area-sentence"></div>
        <div class="game-controls">
          <button id="undo-sentence" class="game-btn game-btn-undo">↶ Undo</button>
          <button id="clear-sentence" class="game-btn game-btn-clear">🗑️ Clear</button>
          <button id="submit-sentence" class="game-btn game-btn-submit">✅ Nộp bài</button>
        </div>
        <div class="game-feedback" id="feedback-sentenceScramble"></div>
        <div id="next-btn-container" class="text-center mt-4" style="display:none;">
          <button class="next-btn" id="next-btn-sentenceScramble">Next ➡️</button>
        </div>
      </div>
    `;
    container.innerHTML = html;
    const scrambledDiv = document.getElementById('scrambled-words');
    const answerDiv = document.getElementById('answer-area-sentence');
    const fbDiv = document.getElementById('feedback-sentenceScramble');
    const undoBtn = document.getElementById('undo-sentence');
    const clearBtn = document.getElementById('clear-sentence');
    const submitBtn = document.getElementById('submit-sentence');

    q.scrambled.forEach((word, idx) => {
      const tile = document.createElement('button');
      tile.className = 'game-tile';
      tile.dataset.word = word;
      tile.dataset.index = idx;
      tile.textContent = word;
      scrambledDiv.appendChild(tile);
    });

    function updateUI() {
      answerDiv.innerHTML = answerWords.map(w => `<span class="placed-tile">${w}</span>`).join(' ');
    }

    function lockAll() {
      scrambledDiv.querySelectorAll('.game-tile').forEach(b => b.style.pointerEvents = 'none');
      undoBtn.disabled = true;
      clearBtn.disabled = true;
      submitBtn.disabled = true;
    }

    scrambledDiv.addEventListener('click', (e) => {
      const tile = e.target.closest('.game-tile');
      if (!tile || tile.classList.contains('hidden-tile')) return;
      answerWords.push(tile.dataset.word);
      tile.classList.add('hidden-tile');
      updateUI();
    });

    undoBtn.addEventListener('click', () => {
      if (answerWords.length === 0) return;
      const lastWord = answerWords.pop();
      const hiddenTiles = [...scrambledDiv.querySelectorAll('.game-tile.hidden-tile')].reverse();
      const tileToShow = hiddenTiles.find(t => t.dataset.word === lastWord);
      if (tileToShow) tileToShow.classList.remove('hidden-tile');
      updateUI();
      fbDiv.innerHTML = '';
    });

    clearBtn.addEventListener('click', () => {
      answerWords = [];
      scrambledDiv.querySelectorAll('.game-tile').forEach(t => t.classList.remove('hidden-tile'));
      updateUI();
      fbDiv.innerHTML = '';
    });

    submitBtn.addEventListener('click', () => {
      if (answerWords.length !== q.words.length) {
        fbDiv.innerHTML = '<span style="color:#EF4444;">⚠️ Hãy sắp xếp đủ các từ!</span>';
        return;
      }
      const userSentence = answerWords.join(' ');
      if (userSentence === q.original) {
        score++;
        fbDiv.innerHTML = '<span style="color:#10B981;">✔ Chính xác!</span>';
        playSound('success');
      } else {
        fbDiv.innerHTML = `<span style="color:#EF4444;">✘ Sai! Đáp án: ${q.original}</span>`;
        playSound('error');
      }
      lockAll();
      document.getElementById(`next-btn-container`).style.display = 'block';
      document.getElementById(`next-btn-sentenceScramble`).addEventListener('click', () => {
        currentQ++;
        renderQuestion();
      });
    });
  }
  renderQuestion();
}

// ---------- Matching (8 từ/trang) ----------
function renderMatching(container) {
  const itemsPerPage = 8;
  const totalPages = Math.ceil(vocabulary.length / itemsPerPage);
  let currentPage = 0;
  let totalMatchedPairs = 0;

  function renderPage(page) {
    const start = page * itemsPerPage;
    const pageVocab = vocabulary.slice(start, start + itemsPerPage);
    let words = shuffleArray([...pageVocab]);
    let meanings = shuffleArray([...pageVocab]);
    let selectedWord = null;
    let selectedMeaning = null;
    let matchedPairs = 0;
    const totalPairs = pageVocab.length;

    let html = `
<div class="grid grid-cols-2 gap-4 max-w-3xl mx-auto">

  <div class="col-span-2 text-center mb-6">
      <span class="text-lg font-bold bg-purple-100 px-5 py-2 rounded-full">
          Trang ${page + 1}/${totalPages} - Ghép từ với nghĩa
      </span>
  </div>

  <div id="word-column" class="space-y-2"></div>
  <div id="meaning-column" class="space-y-2"></div>

</div>

<div id="feedback-matching" class="text-center mt-4 text-lg font-bold"></div>
`;
    container.innerHTML = html;
    const wordCol = document.getElementById('word-column');
    const meaningCol = document.getElementById('meaning-column');
    const fbDiv = document.getElementById('feedback-matching');

    words.forEach((item) => {
      wordCol.innerHTML += `<div class="matching-word" data-word="${item.word}">${item.word}</div>`;
    });
    meanings.forEach((item) => {
      meaningCol.innerHTML += `<div class="matching-meaning" data-word="${item.word}">${item.vietnamese_meaning}</div>`;
    });

    function attachEvents() {
      const wordEls = document.querySelectorAll('.matching-word');
      const meaningEls = document.querySelectorAll('.matching-meaning');
      const currentFb = document.getElementById('feedback-matching');

      wordEls.forEach(el => {
        el.addEventListener('click', () => {
          wordEls.forEach(e => e.classList.remove('selected'));
          el.classList.add('selected');
          selectedWord = el;
          checkMatch();
        });
      });
      meaningEls.forEach(el => {
        el.addEventListener('click', () => {
          meaningEls.forEach(e => e.classList.remove('selected'));
          el.classList.add('selected');
          selectedMeaning = el;
          checkMatch();
        });
      });

      function checkMatch() {
        if (selectedWord && selectedMeaning) {
          if (selectedWord.dataset.word === selectedMeaning.dataset.word) {
            playSound('success');
            currentFb.innerHTML = '<span class="text-green-500">✔ Ghép đúng!</span>';
            const matchedWord = selectedWord.dataset.word;
            words = words.filter(w => w.word !== matchedWord);
            meanings = meanings.filter(m => m.word !== matchedWord);
            matchedPairs++;
            totalMatchedPairs++;
            selectedWord = null;
            selectedMeaning = null;

            if (matchedPairs === totalPairs) {
              if (currentPage < totalPages - 1) {
                currentFb.innerHTML = '<button id="next-page-btn" class="next-page-btn">Next Page ➡️</button>';
                document.getElementById('next-page-btn').addEventListener('click', () => {
                  currentPage++;
                  renderPage(currentPage);
                });
              } else {
                exerciseScores.matching = {
                  score: totalMatchedPairs,
                  total: vocabulary.length,
                  grade: (totalMatchedPairs / vocabulary.length * 10).toFixed(1)
                };
                Storage.saveScore(lessonId, 'matching', exerciseScores.matching);
                updateCompletedCount();
                showMiniResult(container, {
                  score: totalMatchedPairs,
                  total: vocabulary.length,
                  exKey: 'matching',
                  tabId: 'matching'
                });
              }
            } else {
              setTimeout(() => renderCurrentPageAfterMatch(), 400);
            }
          } else {
            playSound('error');
            currentFb.innerHTML = '<span class="text-red-500">✘ Chưa đúng</span>';
            setTimeout(() => {
              selectedWord.classList.remove('selected');
              selectedMeaning.classList.remove('selected');
              selectedWord.classList.add('wrong-match');
              selectedMeaning.classList.add('wrong-match');
              setTimeout(() => {
                selectedWord.classList.remove('wrong-match');
                selectedMeaning.classList.remove('wrong-match');
                selectedWord = null;
                selectedMeaning = null;
                currentFb.innerHTML = '';
              }, 700);
            }, 300);
          }
        }
      }
    }

    function renderCurrentPageAfterMatch() {
      let newHtml = `
        <div class="mb-4 text-center">
          <span class="text-sm font-semibold">Trang ${currentPage + 1}/${totalPages} - Ghép từ với nghĩa</span>
        </div>
        <div class="grid grid-cols-2 gap-4 max-w-3xl mx-auto">
          <div id="word-column" class="space-y-2"></div>
          <div id="meaning-column" class="space-y-2"></div>
        </div>
        <div id="feedback-matching" class="text-center mt-4 text-lg font-bold"></div>
      `;
      container.innerHTML = newHtml;
      const newWordCol = document.getElementById('word-column');
      const newMeaningCol = document.getElementById('meaning-column');
      words.forEach((item) => {
        newWordCol.innerHTML += `<div class="matching-word" data-word="${item.word}">${item.word}</div>`;
      });
      meanings.forEach((item) => {
        newMeaningCol.innerHTML += `<div class="matching-meaning" data-word="${item.word}">${item.vietnamese_meaning}</div>`;
      });
      attachEvents();
    }

    attachEvents();
  }
  renderPage(0);
}

// ---------- Listening (điền từng ô, check từng từ, 4 giọng xen kẽ) ----------
function renderListening(container) {
  usedHints = 0;
  const questions = getShuffledQuestions(vocabulary);
  let currentQ = 0;
  let score = 0;

  let userAnswers = [];
  let selectedVoices = null;

  // Helper: lấy 4 giọng chất lượng cao (UK female, UK male, US female, US male)
  async function getNaturalVoices() {
    if (selectedVoices) return selectedVoices;
    function waitForVoices() {
      return new Promise((resolve) => {
        let voices = speechSynthesis.getVoices();
        if (voices.length) resolve(voices);
        else speechSynthesis.addEventListener('voiceschanged', () => resolve(speechSynthesis.getVoices()), { once: true });
      });
    }
    const voices = await waitForVoices();
    function findVoice(priorityKeywords, langPrefix) {
      for (let kw of priorityKeywords) {
        const found = voices.find(v =>
          v.lang.startsWith(langPrefix) &&
          v.name.toLowerCase().includes(kw.toLowerCase())
        );
        if (found) return found;
      }
      return voices.find(v => v.lang.startsWith(langPrefix)) || null;
    }
    const ukFemale = findVoice(['Google UK English Female', 'Samantha', 'Moira', 'Tessa', 'Serena'], 'en-GB');
    const ukMale = findVoice(['Google UK English Male', 'Daniel', 'Arthur', 'Charlie'], 'en-GB');
    const usFemale = findVoice(['Google US English', 'Samantha', 'Allison', 'Ava', 'Zira'], 'en-US');
    const usMale = findVoice(['Google US English', 'Alex', 'Mark', 'David', 'Guy'], 'en-US');
    const defaultUK = voices.find(v => v.lang.startsWith('en-GB')) || voices[0];
    const defaultUS = voices.find(v => v.lang.startsWith('en-US')) || voices[0];
    selectedVoices = {
      ukFemale: ukFemale || defaultUK,
      ukMale: ukMale || defaultUK,
      usFemale: usFemale || defaultUS,
      usMale: usMale || defaultUS
    };
    return selectedVoices;
  }

  const VOICE_TYPES = ['ukFemale', 'ukMale', 'usFemale', 'usMale'];

  // Hàm phát câu với giọng xen kẽ theo index câu
  async function speakWithVoice(sentence, voiceObj) {
    return new Promise((resolve) => {
      if (!voiceObj) { resolve(); return; }
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(sentence);
      utterance.voice = voiceObj;
      utterance.lang = voiceObj.lang;
      utterance.rate = 0.85;
      utterance.pitch = 1.0;
      utterance.volume = 1;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      speechSynthesis.speak(utterance);
    });
  }

  function tokenizeSentence(sentence) {
    return sentence.match(/\b[\w']+\b|[.,!?;:]/g) || [];
  }
  function isPunctuation(token) {
    return /^[.,!?;:]$/.test(token);
  }

  function renderQuestion() {
    if (currentQ >= questions.length) {
      exerciseScores.listening = {
        score,
        total: questions.length,
        hintsUsed: usedHints,
        grade: (score / questions.length * 10).toFixed(1)
      };
      Storage.saveScore(lessonId, 'listening', exerciseScores.listening);
      updateCompletedCount();
      showMiniResult(container, { score, total: questions.length, exKey: 'listening', tabId: 'listening' });
      return;
    }

    const item = questions[currentQ];
    const originalSentence = item.example_sentence;
    const tokens = tokenizeSentence(originalSentence);
    const wordTokens = tokens.filter(t => !isPunctuation(t));
    const totalWords = wordTokens.length;

    if (!userAnswers[currentQ]) userAnswers[currentQ] = new Array(totalWords).fill('');
    let wordStatus = new Array(totalWords).fill(null);
    let hintIndex = 0;

    // Tạo HTML các ô input
    let sentenceHtml = '<div class="listening-sentence" style="display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-bottom: 20px;">';
    let inputIdx = 0;
    for (let token of tokens) {
      if (isPunctuation(token)) {
        sentenceHtml += `<span class="punctuation" style="font-size: 1.4rem; font-weight: bold; margin: 0 2px;">${token}</span>`;
      } else {
        sentenceHtml += `<input type="text" class="word-input" data-idx="${inputIdx}" style="width: 100px; padding: 8px; text-align: center; border-radius: 12px; border: 2px solid #cbd5e1; font-size: 1rem;" autocomplete="off" value="${escapeHtml(userAnswers[currentQ][inputIdx])}">`;
        inputIdx++;
      }
    }
    sentenceHtml += '</div>';

    container.innerHTML = `
      <div class="quiz-card text-center">
        <div class="mb-3"><span class="font-bold text-purple-700">Question ${currentQ + 1}/${questions.length}</span></div>
        <div class="mb-4"><button id="listenBtn" class="audio-play-btn mx-auto" style="margin-top: 20px;">🔊</button></div>
        <div id="hintArea" class="bg-purple-50 rounded-xl p-4 mb-4 min-h-[70px]"><b>Hints:</b><br><span id="hintText">No hints yet</span></div>
        ${sentenceHtml}
        <div class="flex justify-center gap-3 mt-5 flex-wrap">
          <button id="hintBtn" class="bg-yellow-400 hover:bg-yellow-500 text-white px-5 py-3 rounded-full font-bold">💡 Hint (${totalHintsAllowed - usedHints} left)</button>
          <button id="checkBtn" class="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-full font-bold">✅ Check</button>
        </div>
        <div id="feedback" class="mt-5 text-xl font-bold"></div>
        <div id="resultArea" class="mt-4 p-4 bg-gray-100 rounded-xl hidden"></div>
        <div id="next-btn-container" class="text-center mt-4" style="display:none;"><button class="next-btn" id="next-btn-listening">Next ➡️</button></div>
      </div>
    `;

    const listenBtn = document.getElementById('listenBtn');
    const hintBtn = document.getElementById('hintBtn');
    const checkBtn = document.getElementById('checkBtn');
    const feedbackDiv = document.getElementById('feedback');
    const resultArea = document.getElementById('resultArea');
    const nextContainer = document.getElementById('next-btn-container');
    const nextBtn = document.getElementById('next-btn-listening');
    const inputs = document.querySelectorAll('.word-input');

    function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
      });
    }

    // Cập nhật userAnswers khi gõ
    inputs.forEach((input, idx) => {
      input.value = userAnswers[currentQ][idx] || '';
      input.addEventListener('input', (e) => {
        userAnswers[currentQ][idx] = e.target.value;
      });
    });

    // Phím cách chuyển ô
    function handleKeydown(e, idx) {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        if (idx + 1 < inputs.length) inputs[idx + 1].focus();
      }
    }
    inputs.forEach((input, idx) => {
      input.addEventListener('keydown', (e) => handleKeydown(e, idx));
    });

    // Nút nghe: sử dụng 4 giọng xen kẽ
    listenBtn.onclick = async () => {
      listenBtn.disabled = true;
      const voices = await getNaturalVoices();
      const voiceType = VOICE_TYPES[currentQ % VOICE_TYPES.length];
      const voice = voices[voiceType];
      if (voice) {
        await speakWithVoice(originalSentence, voice);
      } else {
        // fallback
        const utterance = new SpeechSynthesisUtterance(originalSentence);
        utterance.rate = 0.9;
        speechSynthesis.cancel();
        speechSynthesis.speak(utterance);
      }
      listenBtn.disabled = false;
    };

    // Hint: điền từ đúng vào ô tiếp theo
    const correctWords = wordTokens;
    hintBtn.onclick = () => {
      if (usedHints >= totalHintsAllowed) {
        alert('You have used all 25 hints!');
        return;
      }
      if (hintIndex >= totalWords) return;
      const targetInput = inputs[hintIndex];
      if (targetInput) {
        targetInput.value = correctWords[hintIndex];
        userAnswers[currentQ][hintIndex] = correctWords[hintIndex];
        targetInput.dispatchEvent(new Event('input'));
      }
      usedHints++;
      hintIndex++;
      document.getElementById('hintText').innerHTML = correctWords.slice(0, hintIndex).join(' ');
      hintBtn.innerHTML = `💡 Hint (${totalHintsAllowed - usedHints} left)`;
    };

    // Check: so sánh từng từ, tô màu, hiển thị kết quả
    checkBtn.onclick = () => {
      let correctCount = 0;
      for (let i = 0; i < inputs.length; i++) {
        const userWord = (userAnswers[currentQ][i] || '').trim().toLowerCase();
        const correctWord = correctWords[i].toLowerCase();
        const isCorrect = (userWord === correctWord);
        if (isCorrect) correctCount++;
        wordStatus[i] = isCorrect;
        // Tô màu ô
        if (isCorrect) {
          inputs[i].style.backgroundColor = '#bbf7d0';
          inputs[i].style.borderColor = '#22c55e';
        } else {
          inputs[i].style.backgroundColor = '#fee2e2';
          inputs[i].style.borderColor = '#ef4444';
        }
      }
      const percent = Math.round((correctCount / totalWords) * 100);
      const isAccepted = (correctCount / totalWords) >= 0.7;
      if (isAccepted) {
        score++;
        playSound('success');
        feedbackDiv.innerHTML = `<span class="text-green-500">✅ Đúng! (${percent}% từ chính xác)</span>`;
      } else {
        playSound('error');
        feedbackDiv.innerHTML = `<span class="text-red-500">❌ Sai (${percent}% đúng). Cần ít nhất 70%.</span>`;
      }

      // Hiển thị câu đúng, highlight từ sai
      let fullCorrectHtml = '';
      let wordIdx = 0;
      for (let token of tokens) {
        if (isPunctuation(token)) {
          fullCorrectHtml += `<span class="correct-punct">${token}</span> `;
        } else {
          const isWordCorrect = wordStatus[wordIdx];
          if (isWordCorrect) {
            fullCorrectHtml += `<span class="correct-word" style="color: #16a34a; font-weight: bold;">${token}</span> `;
          } else {
            fullCorrectHtml += `<span class="wrong-word" style="color: #dc2626; font-weight: bold; text-decoration: underline;">${token}</span> `;
          }
          wordIdx++;
        }
      }
      resultArea.innerHTML = `
        <div><strong>Tỉ lệ đúng:</strong> ${percent}% (${correctCount}/${totalWords})</div>
        <div class="mt-2"><strong>Câu đúng:</strong></div>
        <div class="text-lg font-semibold mt-1">${fullCorrectHtml}</div>
      `;
      resultArea.classList.remove('hidden');

      checkBtn.disabled = true;
      hintBtn.disabled = true;
      nextContainer.style.display = 'block';
      nextBtn.addEventListener('click', () => {
        currentQ++;
        renderQuestion();
      }, { once: true });
    };
  }

  renderQuestion();
}
// ---------- Test tổng hợp ----------
function renderTest(container) {
  const total = vocabulary.length;
  const part = Math.floor(total / 3);
  let allQuestions = [];
  const shuffledVocab = getShuffledQuestions([...vocabulary]);

  for (let i = 0; i < part; i++) {
    const v = shuffledVocab[i];
    const blankSentence = v.example_sentence.replace(new RegExp(v.word, 'gi'), '_____');
    const correct = v.word;
    let wrongs = vocabulary.filter(item => item.word !== correct).map(item => item.word);
    wrongs = shuffleArray(wrongs).slice(0, 3);
    const opts = shuffleArray([correct, ...wrongs]);
    allQuestions.push({ type: 'mcq', data: { blankSentence, correct, opts } });
  }
  for (let i = part; i < part * 2; i++) {
    const v = shuffledVocab[i];
    allQuestions.push({
      type: 'scramble',
      data: { original: v.word, scrambled: shuffleArray(v.word.split('')), meaning: v.vietnamese_meaning }
    });
  }
  for (let i = part * 2; i < total; i++) {
    const v = shuffledVocab[i];
    allQuestions.push({
      type: 'sentence',
      data: {
        original: v.example_sentence,
        words: v.example_sentence.split(' '),
        scrambled: shuffleArray(v.example_sentence.split(' '))
      }
    });
  }
  allQuestions = shuffleArray(allQuestions);
  let currentQ = 0, score = 0;

  function renderCurrent() {
    if (currentQ >= total) {
      exerciseScores.test = { score, total, grade: (score / total * 10).toFixed(1) };
      Storage.saveScore(lessonId, 'test', exerciseScores.test);
      updateCompletedCount();
      showMiniResult(container, { score, total, exKey: 'test', tabId: 'test' });
      return;
    }
    const q = allQuestions[currentQ];

    if (q.type === 'mcq') {
      const d = q.data;
      let html = `
        <div class="quiz-card text-center">
          <div class="mb-2"><span class="text-sm font-bold text-purple-700">Test - Câu ${currentQ + 1}/${total}</span></div>
          <p class="text-xl italic mb-6">"${d.blankSentence}"</p>
          <div class="grid grid-cols-2 gap-4 max-w-md mx-auto">
      `;
      d.opts.forEach(opt => {
        html += `<button class="quiz-option opt-test" data-ans="${opt}">${opt}</button>`;
      });
      html += `</div>
        <div id="fb-test" class="mt-4 text-xl font-bold"></div>
        <div id="next-btn-container" class="text-center mt-4" style="display:none;">
          <button class="next-btn" id="next-btn-test">Next ➡️</button>
        </div>
      </div>`;
      container.innerHTML = html;
      const btns = document.querySelectorAll('.opt-test');
      btns.forEach(btn => {
        btn.addEventListener('click', function () {
          const selected = this.dataset.ans;
          btns.forEach(b => b.disabled = true);
          const fbDiv = document.getElementById('fb-test');
          if (selected === d.correct) {
            score++;
            fbDiv.innerHTML = '<span class="text-green-500">✔ Đúng!</span>';
            playSound('success');
            this.classList.add('correct-choice');
          } else {
            fbDiv.innerHTML = `<span class="text-red-500">✘ Sai! Đáp án: ${d.correct}</span>`;
            playSound('error');
            this.classList.add('wrong-choice');
            btns.forEach(b => {
              if (b.dataset.ans === d.correct) b.classList.add('correct-choice');
            });
          }
          document.getElementById(`next-btn-container`).style.display = 'block';
          document.getElementById(`next-btn-test`).addEventListener('click', () => {
            currentQ++;
            renderCurrent();
          });
        });
      });
    } else if (q.type === 'scramble') {
      const d = q.data;
      let answerLetters = [];
      const html = `
        <div class="game-container">
          <div class="game-title">🧩 TEST - SẮP XẾP CHỮ</div>
          <div class="text-center"><span class="text-sm font-bold">Câu ${currentQ + 1}/${total}</span></div>
          <div class="text-center mt-2"><span class="game-hint">💡 ${d.meaning}</span></div>
          <div class="game-tiles" id="test-scrambled"></div>
          <div class="answer-zone" id="test-answer-area"></div>
          <div class="game-controls">
            <button id="test-undo-scramble" class="game-btn game-btn-undo">↶ Undo</button>
            <button id="test-clear-scramble" class="game-btn game-btn-clear">🗑️ Clear</button>
            <button id="test-submit-scramble" class="game-btn game-btn-submit">✅ Nộp bài</button>
          </div>
          <div class="game-feedback" id="fb-test"></div>
          <div id="next-btn-container" class="text-center mt-4" style="display:none;">
            <button class="next-btn" id="next-btn-test-scramble">Next ➡️</button>
          </div>
        </div>
      `;
      container.innerHTML = html;
      const scrambledDiv = document.getElementById('test-scrambled');
      const answerDiv = document.getElementById('test-answer-area');
      const fbDiv = document.getElementById('fb-test');
      const undoBtn = document.getElementById('test-undo-scramble');
      const clearBtn = document.getElementById('test-clear-scramble');
      const submitBtn = document.getElementById('test-submit-scramble');

      d.scrambled.forEach((letter) => {
        const tile = document.createElement('button');
        tile.className = 'game-tile';
        tile.dataset.letter = letter;
        tile.textContent = letter;
        scrambledDiv.appendChild(tile);
      });

      function updateUI() {
        answerDiv.innerHTML = answerLetters.map(l => `<span class="placed-tile">${l}</span>`).join('');
      }

      function lockAll() {
        scrambledDiv.querySelectorAll('.game-tile').forEach(b => b.style.pointerEvents = 'none');
        undoBtn.disabled = true;
        clearBtn.disabled = true;
        submitBtn.disabled = true;
      }

      scrambledDiv.addEventListener('click', (e) => {
        const tile = e.target.closest('.game-tile');
        if (!tile || tile.classList.contains('hidden-tile')) return;
        answerLetters.push(tile.dataset.letter);
        tile.classList.add('hidden-tile');
        updateUI();
      });

      undoBtn.addEventListener('click', () => {
        if (answerLetters.length === 0) return;
        const last = answerLetters.pop();
        const hiddenTiles = [...scrambledDiv.querySelectorAll('.game-tile.hidden-tile')].reverse();
        const tile = hiddenTiles.find(t => t.dataset.letter === last);
        if (tile) tile.classList.remove('hidden-tile');
        updateUI();
        fbDiv.innerHTML = '';
      });

      clearBtn.addEventListener('click', () => {
        answerLetters = [];
        scrambledDiv.querySelectorAll('.game-tile').forEach(t => t.classList.remove('hidden-tile'));
        updateUI();
        fbDiv.innerHTML = '';
      });

      submitBtn.addEventListener('click', () => {
        if (answerLetters.length !== d.original.length) {
          fbDiv.innerHTML = '<span style="color:#EF4444;">⚠️ Hãy sắp xếp đủ các chữ cái!</span>';
          return;
        }
        const userWord = answerLetters.join('');
        if (userWord === d.original) {
          score++;
          fbDiv.innerHTML = '<span style="color:#10B981;">✔ Đúng!</span>';
          playSound('success');
        } else {
          fbDiv.innerHTML = `<span style="color:#EF4444;">✘ Sai! Đáp án: ${d.original}</span>`;
          playSound('error');
        }
        lockAll();
        document.getElementById(`next-btn-container`).style.display = 'block';
        document.getElementById(`next-btn-test-scramble`).addEventListener('click', () => {
          currentQ++;
          renderCurrent();
        });
      });
    } else if (q.type === 'sentence') {
      const d = q.data;
      let answerWords = [];
      const html = `
        <div class="game-container">
          <div class="game-title">📝 TEST - SẮP XẾP CÂU</div>
          <div class="text-center"><span class="text-sm font-bold">Câu ${currentQ + 1}/${total}</span></div>
          <div class="game-tiles" id="test-sentence-words"></div>
          <div class="answer-zone" id="test-sentence-answer"></div>
          <div class="game-controls">
            <button id="test-undo-sentence" class="game-btn game-btn-undo">↶ Undo</button>
            <button id="test-clear-sentence" class="game-btn game-btn-clear">🗑️ Clear</button>
            <button id="test-submit-sentence" class="game-btn game-btn-submit">✅ Nộp bài</button>
          </div>
          <div class="game-feedback" id="fb-test"></div>
          <div id="next-btn-container" class="text-center mt-4" style="display:none;">
            <button class="next-btn" id="next-btn-test-sentence">Next ➡️</button>
          </div>
        </div>
      `;
      container.innerHTML = html;
      const wordsDiv = document.getElementById('test-sentence-words');
      const answerDiv = document.getElementById('test-sentence-answer');
      const fbDiv = document.getElementById('fb-test');
      const undoBtn = document.getElementById('test-undo-sentence');
      const clearBtn = document.getElementById('test-clear-sentence');
      const submitBtn = document.getElementById('test-submit-sentence');

      d.scrambled.forEach((word) => {
        const tile = document.createElement('button');
        tile.className = 'game-tile';
        tile.dataset.word = word;
        tile.textContent = word;
        wordsDiv.appendChild(tile);
      });

      function updateUI() {
        answerDiv.innerHTML = answerWords.map(w => `<span class="placed-tile">${w}</span>`).join(' ');
      }

      function lockAll() {
        wordsDiv.querySelectorAll('.game-tile').forEach(b => b.style.pointerEvents = 'none');
        undoBtn.disabled = true;
        clearBtn.disabled = true;
        submitBtn.disabled = true;
      }

      wordsDiv.addEventListener('click', (e) => {
        const tile = e.target.closest('.game-tile');
        if (!tile || tile.classList.contains('hidden-tile')) return;
        answerWords.push(tile.dataset.word);
        tile.classList.add('hidden-tile');
        updateUI();
      });

      undoBtn.addEventListener('click', () => {
        if (answerWords.length === 0) return;
        const last = answerWords.pop();
        const hiddenTiles = [...wordsDiv.querySelectorAll('.game-tile.hidden-tile')].reverse();
        const tile = hiddenTiles.find(t => t.dataset.word === last);
        if (tile) tile.classList.remove('hidden-tile');
        updateUI();
        fbDiv.innerHTML = '';
      });

      clearBtn.addEventListener('click', () => {
        answerWords = [];
        wordsDiv.querySelectorAll('.game-tile').forEach(t => t.classList.remove('hidden-tile'));
        updateUI();
        fbDiv.innerHTML = '';
      });

      submitBtn.addEventListener('click', () => {
        if (answerWords.length !== d.words.length) {
          fbDiv.innerHTML = '<span style="color:#EF4444;">⚠️ Hãy sắp xếp đủ các từ!</span>';
          return;
        }
        const userSentence = answerWords.join(' ');
        if (userSentence === d.original) {
          score++;
          fbDiv.innerHTML = '<span style="color:#10B981;">✔ Đúng!</span>';
          playSound('success');
        } else {
          fbDiv.innerHTML = `<span style="color:#EF4444;">✘ Sai! Đáp án: ${d.original}</span>`;
          playSound('error');
        }
        lockAll();
        document.getElementById(`next-btn-container`).style.display = 'block';
        document.getElementById(`next-btn-test-sentence`).addEventListener('click', () => {
          currentQ++;
          renderCurrent();
        });
      });
    }
  }
  renderCurrent();
}

// ---------- Results & Certificate Modals ----------
function showResultsModal() {
   console.log('User trong modal:', Storage.getUser());
  const name = Storage.getUser()?.name || 'Ẩn danh';
  const date = new Date().toLocaleDateString('vi-VN');
  const exercises = [
    { key: 'vnToEn', name: 'VN → EN MCQ' },
    { key: 'enToVn', name: 'EN → VN MCQ' },
    { key: 'fillBlank', name: 'Điền vào chỗ trống' },
    { key: 'wordScramble', name: 'Sắp xếp chữ cái' },
    { key: 'sentenceScramble', name: 'Sắp xếp câu' },
    { key: 'matching', name: 'Ghép cặp' },
    { key: 'listening', name: '🎧 Listening' },
    { key: 'test', name: 'Test tổng hợp' }
  ];
  let rows = '';
  exercises.forEach(ex => {
    const data = exerciseScores[ex.key];
    rows += `<tr>
      <td class="px-4 py-3 font-semibold">${ex.name}</td>
      <td class="px-4 py-3">${data ? data.score : '–'}</td>
      <td class="px-4 py-3">${data ? data.total : '–'}</td>
      <td class="px-4 py-3 font-bold text-lg ${data && data.grade >= 8 ? 'text-green-700' : data ? 'text-orange-600' : 'text-gray-500'}">
        ${data ? data.grade : '–'}
      </td>
    </tr>`;
  });
  const modalContent = `
    <h1 class="text-3xl font-bold text-center text-pastel-blue mb-4">📊 Kết quả học tập</h1>
    <div class="text-center mb-4">
      <p><strong>Học viên:</strong> ${name} &nbsp;|&nbsp; <strong>Ngày:</strong> ${date}</p>
      <p><strong>Bài học:</strong> ${lessonData?.title || ''}</p>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full border-collapse bg-white rounded-2xl overflow-hidden shadow">
        <thead class="bg-gradient-to-r from-pastel-lavender to-pastel-coral">
          <tr>
            <th class="p-3">Bài tập</th>
            <th>Đúng</th>
            <th>Tổng</th>
            <th>Điểm (10)</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="text-center mt-6">
      <button onclick="closeResultsModal()" class="bg-pastel-blue hover:bg-blue-400 text-white font-bold py-2 px-8 rounded-full transition">
        Đóng
      </button>
    </div>
  `;
  document.getElementById('modalContent').innerHTML = modalContent;
  document.getElementById('resultsModal').classList.remove('hidden');
}

function closeResultsModal() {
  document.getElementById('resultsModal').classList.add('hidden');
}

function showCertificateModal() {
  const name = Storage.getUser()?.name || 'Học viên';
  const date = new Date().toLocaleDateString('vi-VN');
  const exercises = [
    { key: 'vnToEn', name: 'VN → EN' },
    { key: 'enToVn', name: 'EN → VN' },
    { key: 'fillBlank', name: 'Điền từ' },
    { key: 'wordScramble', name: 'Xếp chữ' },
    { key: 'sentenceScramble', name: 'Xếp câu' },
    { key: 'matching', name: 'Ghép cặp' },
    { key: 'listening', name: '🎧 Listening' },
    { key: 'test', name: 'Test tổng hợp' }
  ];
  let rows = '';
  let allCompleted = true;
  exercises.forEach(ex => {
    const data = exerciseScores[ex.key];
    if (!data) allCompleted = false;
    rows += `<tr>
      <td>${ex.name}</td>
      <td>${data ? data.score : '-'}</td>
      <td>${data ? data.total : '-'}</td>
      <td><strong>${data ? data.grade : '-'}/10</strong></td>
    </tr>`;
  });
  if (!allCompleted) {
    alert('Bạn cần hoàn thành tất cả 8 bài tập để nhận chứng chỉ.');
    return;
  }
  // +200 XP cho test hoàn thành
  Storage.addXP(200);
  checkAndNotifyAchievements();

  const html = `
    <div class="certificate">
      <div class="stamp">🏆</div>
      <h2>CHỨNG CHỈ HOÀN THÀNH</h2>
      <p style="font-size:1.2rem; color:#5e503f;">Trao tặng</p>
      <p style="font-size:2rem; font-weight:bold; color:#3e2c1b;">${name}</p>
      <p style="color:#5e503f;">Đã xuất sắc hoàn thành bài học</p>
      <p style="font-weight:700;color:#7c3aed;font-size:1.3rem;">${lessonData?.title || ''}</p>
      <p>Ngày hoàn thành: ${date}</p>
      <table class="cert-table">
        <thead>
          <tr>
            <th>Bài tập</th>
            <th>Đúng</th>
            <th>Tổng</th>
            <th>Điểm</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:1rem;">Chữ ký giáo viên hướng dẫn</p>
      <div class="signature">Ms. Thúy</div>
    </div>
  `;
  document.getElementById('certificateContent').innerHTML = html;
  document.getElementById('certificateModal').classList.remove('hidden');
}

function closeCertificateModal() {
  document.getElementById('certificateModal').classList.add('hidden');
}

// ---------- Music ----------
function initMusic() {
  const bgMusic = document.getElementById('bgMusic');
  bgMusic.volume = 0.12;
  const musicBtn = document.getElementById('musicBtn');
  musicBtn.addEventListener('click', async () => {
    if (bgMusic.paused) {
      await bgMusic.play();
      musicBtn.innerHTML = '⏸ Pause';
    } else {
      bgMusic.pause();
      musicBtn.innerHTML = '🎵 Play Music';
    }
  });
  window.addEventListener('click', () => { bgMusic.play(); }, { once: true });
}

// ---------- Mascot ----------
function initMascot() {
  const encouragements = [
    'Cố lên em nhé! 💪',
    'Giỏi quá! ⭐',
    'Từ này dễ mà, thử lại nha!',
    'Em làm đúng rồi! 🎉',
    'Mỗi ngày một từ mới nhé!',
    'Cô Thúy tin em làm được! 💖'
  ];
  const bubble = document.getElementById('speechBubble');
  function nextMessage() {
    const msg = encouragements[Math.floor(Math.random() * encouragements.length)];
    bubble.textContent = msg;
    bubble.classList.add('show');
    clearTimeout(bubble._timeout);
    bubble._timeout = setTimeout(() => {
      bubble.classList.remove('show');
    }, 3500);
  }
  setInterval(() => { nextMessage(); }, 5000);
  setTimeout(nextMessage, 1000);
}

// ---------- Achievement Check ----------
function checkAndNotifyAchievements() {
  const newAchievements = checkAchievements();
  newAchievements.forEach(ach => {
    showToast(`🏆 Thành tựu: ${ach.icon} ${ach.name}!`, 'achievement');
  });
}

// ---------- Toast (dùng lại từ home.js nhưng an toàn) ----------
if (typeof showToast !== 'function') {
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', achievement: '🏆', info: 'ℹ️' };
    toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'slideInRight 0.3s reverse';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
}
