// ==================== LISTENING.JS ====================
(function() {
    'use strict';

    // ---------- Storage helpers ----------
    const Storage = {
        get(key, fallback = null) {
            try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
            catch { return fallback; }
        },
        set(key, value) {
            localStorage.setItem(key, JSON.stringify(value));
        },
        addXP(amount) {
            if (typeof window.addXP === 'function') {
                window.addXP(amount);
            } else {
                const current = Storage.get('userXP', 0);
                Storage.set('userXP', current + amount);
            }
        },
        getXP() {
            if (typeof window.getXP === 'function') return window.getXP();
            return Storage.get('userXP', 0);
        },
        getLevel() {
            if (typeof window.getLevel === 'function') return window.getLevel();
            return Math.floor(Storage.get('userXP', 0) / 100) + 1;
        },
        getDarkMode() {
            if (typeof window.getDarkMode === 'function') return window.getDarkMode();
            return Storage.get('darkMode', false);
        },
        setDarkMode(val) {
            if (typeof window.setDarkMode === 'function') {
                window.setDarkMode(val);
            } else {
                Storage.set('darkMode', val);
            }
            document.documentElement.setAttribute('data-theme', val ? 'dark' : 'light');
        },
        getProgress(courseId) {
            return Storage.get(`progress_${courseId}`, {});
        },
        setProgress(courseId, data) {
            Storage.set(`progress_${courseId}`, data);
        }
    };

    // Apply theme
    if (Storage.getDarkMode()) {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
    }

    // ---------- Global state ----------
    const app = document.getElementById('app');
    let courseData = null;
    let audio = null;
    let isPlaying = false;
    let currentTime = 0;
    let duration = 0;
    let playbackRate = 1;
    let activePartIndex = 0;
    let parts = []; // Each part: { title, questions, answers (user) }
    let transcriptVisible = false;
    let questionRefs = []; // for scroll to

    // ---------- Utility ----------
    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    }

    async function fetchJSON(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to load data');
        return res.json();
    }

    function getQueryParam(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    }

    // ---------- Render UI ----------
    function renderLoading() {
        app.innerHTML = `<div class="loading-screen"><div class="loader"></div></div>`;
    }

    function renderApp() {
        if (!courseData) return;
        buildHTML();
        initAudio();
        initKeyboard();
        renderPart(activePartIndex);
    }

    function buildHTML() {
        const { title, description, icon, duration: durStr, level, questions, transcript } = courseData;
        // Process parts: if parts not defined, create a single part from questions
        parts = courseData.parts || [{ title: "Exercises", questions: questions || [] }];
        // Initialize user answers
        parts.forEach((part, idx) => {
            if (!part._answers) part._answers = new Array(part.questions.length).fill(null);
            if (!part._checked) part._checked = false;
        });

        const xp = Storage.getXP();
        const lvl = Storage.getLevel();

        const html = `
            <header class="app-header">
                <div class="header-left">
                    <span class="logo">🎓 Ms. Thúy</span>
                    <span class="lesson-title">${escapeHTML(title)}</span>
                </div>
                <div class="header-right">
                    <div class="xp-level">✨ Lv.${lvl} · ${xp} XP</div>
                    <button class="theme-toggle" id="themeToggle">${Storage.getDarkMode() ? '☀️' : '🌙'}</button>
                </div>
            </header>

            <div class="hero-card">
                <div class="hero-icon">${icon || '🎧'}</div>
                <div class="hero-info">
                    <h1 class="hero-title">${escapeHTML(title)}</h1>
                    <p class="hero-desc">${escapeHTML(description)}</p>
                    <div class="hero-meta">
                        <span>⏱️ ${durStr || '00:00'}</span>
                        <span>📋 ${questions?.length || 0} questions</span>
                        <span>📊 ${level || 'All'}</span>
                    </div>
                </div>
            </div>

            <div class="audio-player" id="audioPlayer">
                <div class="wave-animation" id="waveContainer"></div>
                <div class="player-controls-top">
                    <button class="control-btn" id="skipBack" title="-5s">⏪</button>
                    <button class="control-btn play-btn" id="playPauseBtn">▶️</button>
                    <button class="control-btn" id="skipForward" title="+5s">⏩</button>
                </div>
                <div class="progress-container" id="progressContainer">
                    <div class="progress-bar" id="progressBar">
                        <div class="progress-fill" id="progressFill" style="width:0%">
                            <div class="progress-thumb"></div>
                        </div>
                    </div>
                </div>
                <div class="time-display">
                    <span id="currentTime">00:00</span>
                    <span id="totalTime">${durStr || '00:00'}</span>
                </div>
                <div class="player-bottom">
                    <div class="volume-speed">
                        <span>🔊</span>
                        <input type="range" class="volume-slider" id="volumeSlider" min="0" max="1" step="0.05" value="1">
                        <select class="speed-select" id="speedSelect">
                            <option value="0.75">0.75x</option>
                            <option value="1" selected>1x</option>
                            <option value="1.25">1.25x</option>
                            <option value="1.5">1.5x</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="exercise-tabs" id="tabContainer"></div>
            <div class="exercise-card" id="exerciseCard">
                <div class="exercise-header">
                    <h3 id="partTitle">Exercises</h3>
                    <button class="print-btn" id="printPartBtn">🖨️ Print Result</button>
                </div>
                <div class="exercise-content" id="exerciseContent"></div>
            </div>

            <div id="transcriptArea"></div>

            <div class="sticky-footer">
                <button class="btn btn-primary" id="checkPartBtn">✅ Check Answers</button>
                <button class="btn" id="resetPartBtn">🔄 Reset</button>
                <button class="btn" id="toggleTranscriptBtn">📜 Show Transcript</button>
            </div>

            <canvas id="confetti-canvas" style="display:none;"></canvas>
        `;
        app.innerHTML = html;

        // Bind events
        document.getElementById('themeToggle').addEventListener('click', toggleTheme);
        document.getElementById('skipBack').addEventListener('click', () => skipTime(-5));
        document.getElementById('skipForward').addEventListener('click', () => skipTime(5));
        document.getElementById('playPauseBtn').addEventListener('click', togglePlay);
        document.getElementById('progressContainer').addEventListener('click', seekAudio);
        document.getElementById('volumeSlider').addEventListener('input', (e) => { if(audio) audio.volume = e.target.value; });
        document.getElementById('speedSelect').addEventListener('change', (e) => {
            playbackRate = parseFloat(e.target.value);
            if(audio) audio.playbackRate = playbackRate;
        });
        document.getElementById('checkPartBtn').addEventListener('click', checkCurrentPart);
        document.getElementById('resetPartBtn').addEventListener('click', resetCurrentPart);
        document.getElementById('toggleTranscriptBtn').addEventListener('click', toggleTranscript);
        document.getElementById('printPartBtn').addEventListener('click', printPartResult);

        renderTabs();
    }

    function renderTabs() {
        const tabContainer = document.getElementById('tabContainer');
        tabContainer.innerHTML = parts.map((part, idx) => {
            const activeClass = idx === activePartIndex ? 'active' : '';
            const summary = part._checked ? `(${getPartScore(part).correct}/${part.questions.length})` : '';
            return `<button class="tab-btn ${activeClass}" data-index="${idx}">${escapeHTML(part.title)} <span class="tab-result-summary">${summary}</span></button>`;
        }).join('');
        tabContainer.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                activePartIndex = parseInt(e.currentTarget.dataset.index);
                renderPart(activePartIndex);
                renderTabs();
            });
        });
    }

    function renderPart(index) {
        const part = parts[index];
        document.getElementById('partTitle').textContent = part.title;
        const container = document.getElementById('exerciseContent');
        questionRefs = [];
        let html = '';
        part.questions.forEach((q, qIdx) => {
            const userAnswer = part._answers[qIdx];
            html += `<div class="question-item ${userAnswer !== null ? 'answered' : ''}" id="q-${qIdx}">
                <div class="question-text">${qIdx+1}. ${escapeHTML(q.question || q.text || '')}</div>`;
            switch(q.type) {
                case 'mcq':
                    html += renderMCQ(q, qIdx, part);
                    break;
                case 'fill_blank':
                    html += renderFillBlank(q, qIdx, part);
                    break;
                case 'dictation':
                    html += renderFillBlank(q, qIdx, part); // similar input
                    break;
                case 'true_false':
                    html += renderTrueFalse(q, qIdx, part);
                    break;
                case 'multi_select':
                    html += renderMultiSelect(q, qIdx, part);
                    break;
                case 'matching':
                    html += renderMatching(q, qIdx, part);
                    break;
                case 'sentence_order':
                    html += renderSentenceOrder(q, qIdx, part);
                    break;
                default: html += `<p>Unknown type</p>`;
            }
            html += `</div>`;
        });
        container.innerHTML = html;
        // Attach event listeners
        part.questions.forEach((q, qIdx) => {
            if (q.type === 'mcq') attachMCQEvents(qIdx, part);
            else if (q.type === 'fill_blank' || q.type === 'dictation') attachFillBlankEvents(qIdx, part);
            else if (q.type === 'true_false') attachTFEvents(qIdx, part);
            else if (q.type === 'multi_select') attachMultiSelectEvents(qIdx, part);
            else if (q.type === 'matching') attachMatchingEvents(qIdx, part);
            else if (q.type === 'sentence_order') attachSentenceOrderEvents(qIdx, part);
        });
        updateTranscriptButton();
    }

    // --- Renderers ---
    function renderMCQ(q, qIdx, part) {
        return `<div class="options-grid">${q.options.map((opt, oi) => {
            const selected = (part._answers[qIdx] === oi) ? 'selected' : '';
            return `<div class="option ${selected}" data-option="${oi}">${String.fromCharCode(65+oi)}. ${escapeHTML(opt)}</div>`;
        }).join('')}</div>`;
    }
    function renderFillBlank(q, qIdx, part) {
        return `<input type="text" class="fill-blank-input" placeholder="Type your answer..." value="${escapeHTML(part._answers[qIdx] || '')}" id="fb-${qIdx}">`;
    }
    function renderTrueFalse(q, qIdx, part) {
        const ans = part._answers[qIdx];
        return `<div class="true-false-btns">
            <div class="tf-btn ${ans === true ? 'selected' : ''}" data-val="true">✅ True</div>
            <div class="tf-btn ${ans === false ? 'selected' : ''}" data-val="false">❌ False</div>
        </div>`;
    }
    function renderMultiSelect(q, qIdx, part) {
        const selectedArr = part._answers[qIdx] || [];
        return `<div class="options-grid multi-select">${q.options.map((opt, oi) => {
            const checked = selectedArr.includes(oi) ? 'selected' : '';
            return `<div class="option ${checked}" data-option="${oi}">${String.fromCharCode(65+oi)}. ${escapeHTML(opt)}</div>`;
        }).join('')}</div>`;
    }
    function renderMatching(q, qIdx, part) {
        const pairs = q.pairs; // [{left, right}]
        const userMatch = part._answers[qIdx] || new Array(pairs.length).fill(null);
        return pairs.map((pair, i) => `
            <div class="matching-pair">
                <span>${escapeHTML(pair.left)}</span>
                <select class="matching-select" data-index="${i}">
                    <option value="">--</option>
                    ${pairs.map((p, j) => `<option value="${j}" ${userMatch[i] === j ? 'selected' : ''}>${escapeHTML(p.right)}</option>`).join('')}
                </select>
            </div>`).join('');
    }
    function renderSentenceOrder(q, qIdx, part) {
        const items = q.sentences;
        const order = part._answers[qIdx] || [...Array(items.length).keys()];
        return `<ul class="sentence-order-list" id="sortList-${qIdx}">
            ${order.map(origIdx => `<li class="sentence-order-item" draggable="true" data-orig="${origIdx}">☰ ${escapeHTML(items[origIdx])}</li>`).join('')}
        </ul>`;
    }

    // --- Event attachment ---
    function attachMCQEvents(qIdx, part) {
        document.querySelectorAll(`.question-item [data-option]`).forEach(opt => {
            opt.addEventListener('click', (e) => {
                const oi = parseInt(e.currentTarget.dataset.option);
                part._answers[qIdx] = oi;
                renderPart(activePartIndex);
            });
        });
    }
    function attachFillBlankEvents(qIdx, part) {
        const input = document.getElementById(`fb-${qIdx}`);
        if (!input) return;
        input.addEventListener('input', (e) => {
            part._answers[qIdx] = e.target.value;
        });
    }
    function attachTFEvents(qIdx, part) {
        document.querySelectorAll(`.true-false-btns .tf-btn`).forEach(btn => {
            btn.addEventListener('click', (e) => {
                const val = e.currentTarget.dataset.val === 'true';
                part._answers[qIdx] = val;
                renderPart(activePartIndex);
            });
        });
    }
    function attachMultiSelectEvents(qIdx, part) {
        document.querySelectorAll(`.multi-select .option`).forEach(opt => {
            opt.addEventListener('click', (e) => {
                const oi = parseInt(e.currentTarget.dataset.option);
                let selected = part._answers[qIdx] || [];
                if (selected.includes(oi)) selected = selected.filter(i => i !== oi);
                else selected = [...selected, oi];
                part._answers[qIdx] = selected;
                renderPart(activePartIndex);
            });
        });
    }
    function attachMatchingEvents(qIdx, part) {
        document.querySelectorAll(`.matching-select`).forEach(select => {
            select.addEventListener('change', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                const val = e.target.value === "" ? null : parseInt(e.target.value);
                let matches = part._answers[qIdx] || new Array(part.questions[qIdx].pairs.length).fill(null);
                matches[index] = val;
                part._answers[qIdx] = matches;
            });
        });
    }
    function attachSentenceOrderEvents(qIdx, part) {
        const list = document.getElementById(`sortList-${qIdx}`);
        if (!list) return;
        let dragSrc = null;
        list.querySelectorAll('li').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                dragSrc = e.target;
                e.target.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            item.addEventListener('dragover', (e) => e.preventDefault());
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                if (dragSrc !== e.target) {
                    const children = [...list.children];
                    const from = children.indexOf(dragSrc);
                    const to = children.indexOf(e.target);
                    list.insertBefore(dragSrc, to > from ? e.target.nextSibling : e.target);
                    // update answer order
                    const newOrder = [...list.children].map(li => parseInt(li.dataset.orig));
                    part._answers[qIdx] = newOrder;
                }
                dragSrc.classList.remove('dragging');
            });
            item.addEventListener('dragend', (e) => { e.target.classList.remove('dragging'); });
        });
    }

    // --- Scoring ---
    function checkAnswer(question, userAnswer) {
        switch(question.type) {
            case 'mcq': return userAnswer === question.answer;
            case 'fill_blank': case 'dictation':
                return userAnswer?.toString().trim().toLowerCase() === question.answer.toString().trim().toLowerCase();
            case 'true_false': return userAnswer === question.answer;
            case 'multi_select':
                if (!userAnswer || !question.answer) return false;
                const uSet = new Set(userAnswer);
                const cSet = new Set(question.answer);
                return uSet.size === cSet.size && [...uSet].every(v => cSet.has(v));
            case 'matching':
                if (!userAnswer || !question.answer) return false;
                return userAnswer.every((val, idx) => val === question.answer[idx]);
            case 'sentence_order':
                if (!userAnswer || !question.answer) return false;
                return userAnswer.join(',') === question.answer.join(',');
            default: return false;
        }
    }

    function getPartScore(part) {
        let correct = 0;
        part.questions.forEach((q, i) => {
            if (checkAnswer(q, part._answers[i])) correct++;
        });
        const total = part.questions.length;
        const percent = total ? (correct / total * 100) : 0;
        const score10 = total ? (correct / total * 10).toFixed(1) : 0;
        return { correct, total, percent: Math.round(percent), score10 };
    }

    function showMiniResult(part, containerElement) {
        const score = getPartScore(part);
        const existing = containerElement.querySelector('.mini-result');
        if (existing) existing.remove();
        const radius = 27;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (score.percent / 100) * circumference;
        const html = `
            <div class="mini-result">
                <div class="circular-progress">
                    <svg viewBox="0 0 70 70">
                        <circle class="circular-bg" cx="35" cy="35" r="${radius}"></circle>
                        <circle class="circular-fill" cx="35" cy="35" r="${radius}" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}" id="circleFill"></circle>
                    </svg>
                    <div class="circular-text">${score.score10}</div>
                </div>
                <div class="result-details">
                    <p>✅ Correct: ${score.correct}/${score.total}</p>
                    <p>📊 Accuracy: ${score.percent}%</p>
                </div>
            </div>`;
        containerElement.insertAdjacentHTML('beforeend', html);
        setTimeout(() => {
            const circle = document.getElementById('circleFill');
            if (circle) circle.style.strokeDashoffset = offset;
        }, 50);
    }

    function checkCurrentPart() {
        const part = parts[activePartIndex];
        if (part._checked) return;
        part._checked = true;
        // Apply correct/incorrect visual if not already
        renderPart(activePartIndex);
        const card = document.getElementById('exerciseCard');
        showMiniResult(part, card);
        renderTabs();
        updateTranscriptButton();
        saveProgress();
        // Award XP based on overall if all parts done?
        if (parts.every(p => p._checked)) {
            const overall = getOverallScore();
            let xpGain = 20;
            if (overall.percent >= 90) xpGain += 20;
            else if (overall.percent >= 80) xpGain += 10;
            Storage.addXP(xpGain);
            if (overall.percent >= 90) triggerConfetti();
        }
    }

    function resetCurrentPart() {
        const part = parts[activePartIndex];
        part._answers = new Array(part.questions.length).fill(null);
        part._checked = false;
        const card = document.getElementById('exerciseCard');
        const mini = card.querySelector('.mini-result');
        if (mini) mini.remove();
        renderPart(activePartIndex);
        renderTabs();
        updateTranscriptButton();
    }

    function getOverallScore() {
        let totalCorrect = 0, totalQ = 0;
        parts.forEach(p => {
            const sc = getPartScore(p);
            totalCorrect += sc.correct;
            totalQ += sc.total;
        });
        const percent = totalQ ? Math.round(totalCorrect / totalQ * 100) : 0;
        return { correct: totalCorrect, total: totalQ, percent };
    }

    function printPartResult() {
        const part = parts[activePartIndex];
        const score = getPartScore(part);
        const now = new Date().toLocaleString();
        const report = `Result for: ${courseData.title} - ${part.title}\nDate: ${now}\nScore: ${score.score10}/10 (${score.correct}/${score.total} correct)\nAccuracy: ${score.percent}%`;
        alert(report);
        // Could also open print window
    }

    // --- Transcript ---
    function toggleTranscript() {
        const area = document.getElementById('transcriptArea');
        if (transcriptVisible) {
            area.innerHTML = '';
            transcriptVisible = false;
        } else {
            const allChecked = parts.every(p => p._checked);
            if (!allChecked) {
                alert('Please complete all exercises before viewing transcript.');
                return;
            }
            const lines = courseData.transcript || [];
            area.innerHTML = `<div class="transcript-panel">${lines.map(l => `<div class="transcript-line">${escapeHTML(l)}</div>`).join('')}</div>`;
            transcriptVisible = true;
        }
        updateTranscriptButton();
    }

    function updateTranscriptButton() {
        const btn = document.getElementById('toggleTranscriptBtn');
        if (!btn) return;
        const allChecked = parts.every(p => p._checked);
        btn.textContent = transcriptVisible ? '📜 Hide Transcript' : '📜 Show Transcript';
        btn.style.display = allChecked || transcriptVisible ? 'flex' : 'flex';
    }

    // --- Audio ---
    function initAudio() {
        if (audio) {
            audio.pause();
            audio = null;
        }
        audio = new Audio(courseData.audio);
        audio.volume = document.getElementById('volumeSlider')?.value || 1;
        audio.playbackRate = playbackRate;
        audio.addEventListener('loadedmetadata', () => {
            duration = audio.duration;
            document.getElementById('totalTime').textContent = formatTime(duration);
        });
        audio.addEventListener('timeupdate', () => {
            currentTime = audio.currentTime;
            document.getElementById('currentTime').textContent = formatTime(currentTime);
            const percent = (currentTime / duration) * 100 || 0;
            document.getElementById('progressFill').style.width = `${percent}%`;
            updateWave();
        });
        audio.addEventListener('play', () => {
            isPlaying = true;
            document.getElementById('playPauseBtn').textContent = '⏸️';
        });
        audio.addEventListener('pause', () => {
            isPlaying = false;
            document.getElementById('playPauseBtn').textContent = '▶️';
        });
        audio.addEventListener('ended', () => {
            isPlaying = false;
            document.getElementById('playPauseBtn').textContent = '▶️';
        });
    }

    function togglePlay() {
        if (!audio) return;
        if (isPlaying) audio.pause();
        else audio.play();
    }

    function skipTime(sec) {
        if (!audio) return;
        audio.currentTime = Math.min(duration, Math.max(0, audio.currentTime + sec));
    }

    function seekAudio(e) {
        if (!audio || !duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const ratio = x / rect.width;
        audio.currentTime = ratio * duration;
    }

    function updateWave() {
        const container = document.getElementById('waveContainer');
        if (!container || !isPlaying) {
            if (container) container.innerHTML = '';
            return;
        }
        if (container.children.length === 0) {
            for (let i = 0; i < 20; i++) {
                const bar = document.createElement('div');
                bar.className = 'wave-bar';
                container.appendChild(bar);
            }
        }
        const bars = container.children;
        for (let bar of bars) {
            const h = Math.random() * 25 + 5;
            bar.style.height = h + 'px';
        }
    }

    function initKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
            else if (e.code === 'ArrowLeft') skipTime(-5);
            else if (e.code === 'ArrowRight') skipTime(5);
        });
    }

    function toggleTheme() {
        const isDark = !Storage.getDarkMode();
        Storage.setDarkMode(isDark);
        document.getElementById('themeToggle').textContent = isDark ? '☀️' : '🌙';
    }

    function triggerConfetti() {
        const canvas = document.getElementById('confetti-canvas');
        canvas.style.display = 'block';
        // Simple confetti animation (omitted for brevity, you can integrate a library)
        setTimeout(() => { canvas.style.display = 'none'; }, 3000);
        // Minimal confetti: just draw random circles
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        let particles = [];
        for (let i=0;i<80;i++) particles.push({x:Math.random()*canvas.width, y:Math.random()*canvas.height*-1, r:Math.random()*6+2, color:`hsl(${Math.random()*360},80%,70%)`, vy:Math.random()*3+2, vx:Math.random()*2-1});
        function draw() {
            ctx.clearRect(0,0,canvas.width,canvas.height);
            particles.forEach(p => { p.y+=p.vy; p.x+=p.vx; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fillStyle=p.color; ctx.fill(); });
            if (particles.some(p=>p.y<canvas.height+20)) requestAnimationFrame(draw);
            else canvas.style.display='none';
        }
        draw();
    }

    function escapeHTML(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);
    }

    function saveProgress() {
        const courseId = courseData.id;
        const progress = {
            completed: parts.every(p => p._checked),
            parts: parts.map(p => ({ answers: p._answers, checked: p._checked })),
            overallScore: getOverallScore()
        };
        Storage.setProgress(courseId, progress);
    }

    function loadProgress() {
        const courseId = courseData.id;
        const saved = Storage.getProgress(courseId);
        if (saved && saved.parts) {
            saved.parts.forEach((sp, i) => {
                if (parts[i]) {
                    parts[i]._answers = sp.answers || new Array(parts[i].questions.length).fill(null);
                    parts[i]._checked = sp.checked || false;
                }
            });
        }
    }

    // ---------- Init ----------
    async function init() {
        renderLoading();
        const id = getQueryParam('id');
        if (!id) {
            app.innerHTML = '<p style="text-align:center;margin-top:40px;">Missing lesson ID.</p>';
            return;
        }
        try {
            // Try to load from data/listening/ based on articles.json mapping
            // Since we only have ID, we need file path. Could fetch articles.json first.
            // Simpler: assume file at ../data/listening/{id}.json
            const resp = await fetch(`../data/listening/${id}.json`);
            if (!resp.ok) throw new Error('File not found');
            courseData = await resp.json();
            // Ensure parts structure
            if (!courseData.parts && courseData.questions) {
                courseData.parts = [{ title: "Exercises", questions: courseData.questions }];
            }
            loadProgress();
            renderApp();
        } catch (err) {
            console.error(err);
            app.innerHTML = `<p style="text-align:center;margin-top:40px;">Failed to load lesson data.</p>`;
        }
    }

    init();
})();
