/* ===========================
   保育士試験 一問一答 - app.js
=========================== */
(function () {
  'use strict';

  const QUIZ_COUNT = 10;
  const STORAGE_KEY = 'hoikushi_quiz_history';

  // ---- State ----
  let state = {
    selectedSubject: 'all',
    queue: [],
    current: 0,
    wrongIds: [],
    sessionWrong: [],
    isReviewMode: false,
  };

  // ---- Storage ----
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { total: 0, correct: 0, wrong: [] }; }
    catch (e) { return { total: 0, correct: 0, wrong: [] }; }
  }
  function saveHistory(h) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(h));
  }

  // ---- Screens ----
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    window.scrollTo(0, 0);
  }

  // ---- Start screen ----
  function initStartScreen() {
    const history = loadHistory();
    document.getElementById('stat-total').textContent = history.total;
    document.getElementById('stat-correct').textContent = history.correct;
    document.getElementById('stat-rate').textContent =
      history.total > 0 ? Math.round(history.correct / history.total * 100) + '%' : '—';

    const reviewBtn = document.getElementById('btn-review');
    reviewBtn.style.display = history.wrong && history.wrong.length > 0 ? 'block' : 'none';
  }

  // Subject buttons
  document.querySelectorAll('.subject-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.subject-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedSubject = btn.dataset.subject;
    });
  });

  // Start button
  document.getElementById('btn-start').addEventListener('click', () => startQuiz(false));

  // Review wrong answers
  document.getElementById('btn-review').addEventListener('click', () => startQuiz(true));

  // Clear history
  document.getElementById('btn-clear-history').addEventListener('click', () => {
    if (confirm('学習履歴をリセットしますか？')) {
      saveHistory({ total: 0, correct: 0, wrong: [] });
      initStartScreen();
    }
  });

  // Back button
  document.getElementById('btn-back').addEventListener('click', () => {
    if (confirm('クイズを中断してトップに戻りますか？')) {
      showScreen('screen-start');
      initStartScreen();
    }
  });

  // ---- Quiz Logic ----
  function startQuiz(reviewMode) {
    state.isReviewMode = reviewMode;
    state.sessionWrong = [];
    state.current = 0;

    let pool;
    if (reviewMode) {
      const history = loadHistory();
      const wrongIds = new Set(history.wrong || []);
      pool = QUESTIONS.filter(q => wrongIds.has(q.id));
      if (pool.length === 0) { alert('復習する問題がありません。'); return; }
    } else {
      pool = state.selectedSubject === 'all'
        ? QUESTIONS
        : QUESTIONS.filter(q => q.subject === state.selectedSubject);
      if (pool.length === 0) { alert('この科目の問題がありません。'); return; }
    }

    state.queue = shuffle(pool).slice(0, QUIZ_COUNT);
    showScreen('screen-quiz');
    renderQuestion();
  }

  function renderQuestion() {
    const q = state.queue[state.current];
    const total = state.queue.length;

    document.getElementById('quiz-subject-label').textContent = q.subject;
    document.getElementById('quiz-progress').textContent = (state.current + 1) + ' / ' + total;
    document.getElementById('progress-bar').style.width = ((state.current + 1) / total * 100) + '%';
    document.getElementById('card-question').textContent = q.question;

    // Choices
    const choicesEl = document.getElementById('choices');
    choicesEl.innerHTML = '';
    const labels = ['A', 'B', 'C', 'D'];
    q.choices.forEach((text, i) => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.innerHTML = '<span class="choice-label">' + labels[i] + '</span><span>' + text + '</span>';
      btn.addEventListener('click', () => onAnswer(i));
      choicesEl.appendChild(btn);
    });

    // Hide answer area
    const answerEl = document.getElementById('card-answer');
    answerEl.classList.add('hidden');
  }

  function onAnswer(choiceIndex) {
    const q = state.queue[state.current];
    const isCorrect = choiceIndex === q.answer;

    // Disable all buttons and highlight
    const btns = document.querySelectorAll('.choice-btn');
    btns.forEach((btn, i) => {
      btn.disabled = true;
      if (i === q.answer) btn.classList.add('correct');
      else if (i === choiceIndex && !isCorrect) btn.classList.add('wrong');
    });

    // Update history
    const history = loadHistory();
    history.total += 1;
    if (isCorrect) {
      history.correct += 1;
      history.wrong = (history.wrong || []).filter(id => id !== q.id);
    } else {
      state.sessionWrong.push(q);
      if (!(history.wrong || []).includes(q.id)) {
        history.wrong = [...(history.wrong || []), q.id];
      }
    }
    saveHistory(history);

    // Show answer
    const answerEl = document.getElementById('card-answer');
    const badge = document.getElementById('answer-badge');
    badge.textContent = isCorrect ? '正解 ✓' : '不正解 ✗';
    badge.className = 'answer-badge ' + (isCorrect ? 'correct-badge' : 'wrong-badge');
    document.getElementById('answer-correct-text').textContent = q.choices[q.answer];
    document.getElementById('answer-explanation').textContent = q.explanation;
    answerEl.classList.remove('hidden');

    document.getElementById('btn-next').textContent =
      state.current + 1 < state.queue.length ? '次の問題 →' : '結果を見る';
  }

  document.getElementById('btn-next').addEventListener('click', () => {
    state.current += 1;
    if (state.current < state.queue.length) {
      renderQuestion();
    } else {
      showResult();
    }
  });

  // ---- Result ----
  function showResult() {
    const total = state.queue.length;
    const wrong = state.sessionWrong.length;
    const correct = total - wrong;
    const rate = Math.round(correct / total * 100);

    document.getElementById('score-num').textContent = correct;
    document.getElementById('score-denom').textContent = '/ ' + total;
    document.getElementById('score-rate').textContent = rate + '%';
    document.getElementById('score-comment').textContent = comment(rate);

    const circumference = 326.7;
    const offset = circumference - (circumference * correct / total);
    const ring = document.getElementById('score-ring');
    ring.style.strokeDashoffset = circumference;
    setTimeout(() => { ring.style.strokeDashoffset = offset; }, 100);

    const wrongWrap = document.getElementById('wrong-list-wrap');
    const wrongList = document.getElementById('wrong-list');
    if (state.sessionWrong.length > 0) {
      wrongWrap.style.display = 'block';
      wrongList.innerHTML = state.sessionWrong.map(q =>
        '<div class="wrong-item"><div class="wrong-item-subject">' + q.subject + '</div>' + q.question + '</div>'
      ).join('');
    } else {
      wrongWrap.style.display = 'none';
    }

    const reviewWrongBtn = document.getElementById('btn-review-wrong');
    reviewWrongBtn.style.display = state.sessionWrong.length > 0 ? 'block' : 'none';

    showScreen('screen-result');
  }

  function comment(rate) {
    if (rate === 100) return '完璧です！素晴らしい！';
    if (rate >= 80) return 'とても良くできました！';
    if (rate >= 60) return 'もう少しで合格ライン！引き続き頑張りましょう。';
    if (rate >= 40) return '復習してもう一度チャレンジしましょう。';
    return 'もう一度テキストを確認してから挑戦しましょう。';
  }

  document.getElementById('btn-retry').addEventListener('click', () => startQuiz(state.isReviewMode));
  document.getElementById('btn-review-wrong').addEventListener('click', () => {
    state.isReviewMode = true;
    startQuiz(true);
  });
  document.getElementById('btn-home').addEventListener('click', () => {
    showScreen('screen-start');
    initStartScreen();
  });

  // ---- Utilities ----
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---- Init ----
  initStartScreen();

})();
