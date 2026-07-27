/* ===========================
   保育士試験 一問一答 - app.js
=========================== */
(function () {
  'use strict';

  const QUIZ_COUNT = 10;
  const STORAGE_KEY = 'hoikushi_quiz_history';
  const STREAK_MILESTONES = new Set([3, 7, 14, 30, 50, 100]);
  const MILESTONE_SHARE_URL = 'https://hoikushi-quiz.com/flashcard/?utm_source=twitter&utm_medium=social&utm_campaign=milestone_share';

  // ---- Date utilities (JST) ----
  function getTodayJST() {
    return new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
  }
  function getYesterdayJST() {
    return new Date(Date.now() - 86400000).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
  }

  // ---- Streak utilities ----
  function getEffectiveStreak(history) {
    const last = history.lastSessionDate;
    if (!last) return 0;
    if (last === getTodayJST() || last === getYesterdayJST()) return history.streak || 0;
    return 0;
  }

  function updateStreakInPlace(history) {
    const today = getTodayJST();
    const yesterday = getYesterdayJST();
    if (history.lastSessionDate === today) return; // already counted today
    history.streak = (history.lastSessionDate === yesterday) ? (history.streak || 0) + 1 : 1;
    history.lastSessionDate = today;
    history.bestStreak = Math.max(history.bestStreak || 0, history.streak);
  }

  function milestoneShareText(type, value) {
    if (type === 'streak') {
      const fire = value >= 30 ? '🔥🔥🔥' : value >= 7 ? '🔥🔥' : '🔥';
      return `保育士試験の勉強を${value}日連続で継続中${fire}\nコツコツ積み重ねて合格を目指します！\n#保育士試験 #保育士勉強 #保育士試験勉強垢\n${MILESTONE_SHARE_URL}`;
    }
    const label = value === 'all' ? '全科目' : value;
    return `保育士試験【${label}】で満点（10/10）達成🏆\n#保育士試験 #保育士勉強\n${MILESTONE_SHARE_URL}`;
  }

  // ---- Supabase ----
  const { createClient } = supabase;
  const db = createClient(
    'https://udrkuswxyfnzdupvqcjg.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkcmt1c3d4eWZuemR1cHZxY2pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODk3MTIsImV4cCI6MjA5MjA2NTcxMn0.XQ7JHEaIsImIuEqE0WRwV_WFeeHYpmBq5KIJNPFNP2E'
  );

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

    const streak = getEffectiveStreak(history);
    const streakEl = document.getElementById('streak-display');
    if (streak > 0) {
      document.getElementById('streak-count').textContent = streak;
      streakEl.style.display = 'flex';
    } else {
      streakEl.style.display = 'none';
    }
  }

  // Subject buttons
  const SUBJECT_PAGE_URLS = {
    'all':          '/flashcard/',
    '保育原理':      '/flashcard/hoiku-genri/',
    '教育原理':      '/flashcard/kyoiku-genri/',
    '社会福祉':      '/flashcard/shakai-fukushi/',
    '子ども家庭福祉': '/flashcard/kodomo-katei-fukushi/',
    '社会的養護':    '/flashcard/shakaiteki-yogo/',
    '保育の心理学':  '/flashcard/hoiku-shinrigaku/',
    '子どもの保健':  '/flashcard/kodomo-hoken/',
    '子どもの食と栄養': '/flashcard/shokuji-eiyou/',
    '保育実習理論':  '/flashcard/jisshu-riron/',
  };
  document.querySelectorAll('.subject-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = SUBJECT_PAGE_URLS[btn.dataset.subject];
      if (url) { window.location.href = url; return; }
      document.querySelectorAll('.subject-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
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
      const labelSpan = document.createElement('span');
      labelSpan.className = 'choice-label';
      labelSpan.textContent = labels[i];
      const textSpan = document.createElement('span');
      textSpan.textContent = text;
      btn.appendChild(labelSpan);
      btn.appendChild(textSpan);
      btn.setAttribute('aria-label', labels[i] + '. ' + text);
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
      if (i === q.answer) {
        btn.classList.add('correct');
        btn.setAttribute('aria-label', btn.getAttribute('aria-label') + '（正解）');
      } else if (i === choiceIndex && !isCorrect) {
        btn.classList.add('wrong');
        btn.setAttribute('aria-label', btn.getAttribute('aria-label') + '（不正解）');
      }
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

  // ---- Subject hashtag map ----
  const SUBJECT_HASHTAGS = {
    '保育原理':    '#保育原理',
    '教育原理':    '#教育原理',
    '社会福祉':    '#社会福祉',
    '子ども家庭福祉': '#子ども家庭福祉',
    '社会的養護':  '#社会的養護',
    '保育の心理学': '#保育の心理学',
    '子どもの保健': '#子どもの保健',
    '子どもの食と栄養': '#子どもの食と栄養',
    '保育実習理論': '#保育実習理論',
  };

  function scoreEmoji(rate) {
    if (rate === 100) return '🏆 満点達成！';
    if (rate >= 80)  return '🌟 好成績！';
    if (rate >= 60)  return '📚 合格ライン突破！';
    return '💪 目指せ合格！';
  }

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
      wrongList.innerHTML = '';
      state.sessionWrong.forEach(q => {
        const item = document.createElement('div');
        item.className = 'wrong-item';
        const subjectDiv = document.createElement('div');
        subjectDiv.className = 'wrong-item-subject';
        subjectDiv.textContent = q.subject;
        item.appendChild(subjectDiv);
        item.appendChild(document.createTextNode(q.question));
        wrongList.appendChild(item);
      });
    } else {
      wrongWrap.style.display = 'none';
    }

    const reviewWrongBtn = document.getElementById('btn-review-wrong');
    reviewWrongBtn.style.display = state.sessionWrong.length > 0 ? 'block' : 'none';

    const subjectLabel = state.selectedSubject === 'all' ? '全科目' : state.selectedSubject;
    const subjectTag = state.selectedSubject !== 'all' && SUBJECT_HASHTAGS[state.selectedSubject]
      ? ' ' + SUBJECT_HASHTAGS[state.selectedSubject]
      : '';
    const shareUrl = 'https://hoikushi-quiz.com/flashcard/?utm_source=twitter&utm_medium=social&utm_campaign=score_share';
    const tweetText = `保育士試験【${subjectLabel}】${correct}/${total}問正解（${rate}%）${scoreEmoji(rate)}\n#保育士試験 #保育士勉強${subjectTag}\n${shareUrl}`;
    document.getElementById('btn-twitter-share').onclick = () =>
      window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(tweetText), '_blank', 'width=550,height=420,noopener,noreferrer');

    // ---- Streak update & milestone ----
    const historyForStreak = loadHistory();
    const isNewSessionToday = historyForStreak.lastSessionDate !== getTodayJST();
    updateStreakInPlace(historyForStreak);
    saveHistory(historyForStreak);

    let milestoneType = null;
    let milestoneValue = null;
    if (correct === total) {
      milestoneType = 'perfect';
      milestoneValue = state.selectedSubject;
    } else if (isNewSessionToday && STREAK_MILESTONES.has(historyForStreak.streak)) {
      milestoneType = 'streak';
      milestoneValue = historyForStreak.streak;
    }

    const milestoneWrap = document.getElementById('milestone-share');
    if (milestoneType) {
      document.getElementById('milestone-message').textContent =
        milestoneType === 'perfect' ? `🏆 満点達成！おめでとうございます！` : `🔥 ${milestoneValue}日連続学習達成！`;
      document.getElementById('btn-twitter-milestone').onclick = () => {
        const text = milestoneShareText(milestoneType, milestoneValue);
        window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(text), '_blank', 'width=550,height=420,noopener,noreferrer');
      };
      milestoneWrap.style.display = 'block';
    } else {
      milestoneWrap.style.display = 'none';
    }

    // ---- 他の科目へのナビゲーション ----
    const nextSubjectsWrap = document.getElementById('result-next-subjects');
    if (nextSubjectsWrap) {
      const SUBJECT_LIST = [
        { name: '保育原理',      url: '/flashcard/hoiku-genri/' },
        { name: '教育原理',      url: '/flashcard/kyoiku-genri/' },
        { name: '社会福祉',      url: '/flashcard/shakai-fukushi/' },
        { name: '子ども家庭福祉', url: '/flashcard/kodomo-katei-fukushi/' },
        { name: '社会的養護',    url: '/flashcard/shakaiteki-yogo/' },
        { name: '保育の心理学',  url: '/flashcard/hoiku-shinrigaku/' },
        { name: '子どもの保健',  url: '/flashcard/kodomo-hoken/' },
        { name: '子どもの食と栄養', url: '/flashcard/shokuji-eiyou/' },
        { name: '保育実習理論',  url: '/flashcard/jisshu-riron/' },
      ];
      const currentSubject = window.PRESET_SUBJECT || null;
      const others = currentSubject
        ? SUBJECT_LIST.filter(s => s.name !== currentSubject)
        : SUBJECT_LIST;
      nextSubjectsWrap.innerHTML = `
        <div class="result-next-subjects-inner">
          <h3 class="result-next-title">次に学ぶ科目はこちら</h3>
          <div class="subject-links-grid">
            ${others.map(s => `<a href="${s.url}" class="subject-link-card">${s.name} <span>一問一答</span></a>`).join('')}
          </div>
        </div>`;
    }

    showScreen('screen-result');
  }

  function comment(rate) {
    if (rate === 100) return '完璚です！素晴らしい！';
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

  // ---- Report button ----
  document.getElementById('btn-report').addEventListener('click', () => {
    const q = state.queue[state.current];
    document.getElementById('report-question-preview').textContent = q.question;
    document.getElementById('report-textarea').value = '';
    document.getElementById('report-overlay').classList.remove('hidden');
  });

  document.getElementById('btn-report-cancel').addEventListener('click', () => {
    document.getElementById('report-overlay').classList.add('hidden');
  });

  document.getElementById('btn-report-send').addEventListener('click', async () => {
    const q = state.queue[state.current];
    const note = document.getElementById('report-textarea').value.trim();
    if (note.length > 500) {
      alert('報告内容は500文字以内で入力してください。');
      return;
    }
    const sendBtn = document.getElementById('btn-report-send');

    sendBtn.disabled = true;
    sendBtn.textContent = '送信中…';

    const { error } = await db.from('reports').insert({
      question_id: q.id,
      subject: q.subject,
      question_text: q.question,
      note: note || null
    });

    sendBtn.disabled = false;
    sendBtn.textContent = '報告する';
    document.getElementById('report-overlay').classList.add('hidden');

    if (error) {
      alert('送信に失敗しました。時間をおいて再度お試しください。');
      console.error(error);
    } else {
      alert('報告を受け付けました。ありがとうございます。');
    }
  });

  // ---- Disclaimer modal ----
  document.getElementById('btn-disclaimer').addEventListener('click', () => {
    document.getElementById('modal-overlay').classList.remove('hidden');
  });
  document.getElementById('btn-modal-close').addEventListener('click', () => {
    document.getElementById('modal-overlay').classList.add('hidden');
  });
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-overlay')) {
      document.getElementById('modal-overlay').classList.add('hidden');
    }
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
  // Apply subject preset from subject-specific pages
  const _VALID_SUBJECTS = ['保育原理','教育原理','社会福祉','子ども家庭福祉','社会的養護','保育の心理学','子どもの保健','子どもの食と栄養','保育実習理論'];
  if (window.PRESET_SUBJECT && _VALID_SUBJECTS.includes(window.PRESET_SUBJECT)) {
    state.selectedSubject = window.PRESET_SUBJECT;
    document.querySelectorAll('.subject-btn').forEach(function(btn) {
      var match = btn.dataset.subject === window.PRESET_SUBJECT;
      btn.classList.toggle('active', match);
      btn.setAttribute('aria-pressed', match ? 'true' : 'false');
    });
    var subtitle = document.querySelector('.app-subtitle');
    if (subtitle) {
      // 問題数は QUESTIONS から算出する（固定値だと問題追加時に古い値が残るため）
      var subjectCount = QUESTIONS.filter(function(q) {
        return q.subject === window.PRESET_SUBJECT;
      }).length;
      subtitle.textContent = window.PRESET_SUBJECT + ' · ' + subjectCount + '問 · 4択形式';
    }
  }
  initStartScreen();

  // FAQ accordion
  document.querySelectorAll('.faq-q').forEach(function(dt) {
    dt.addEventListener('click', function() {
      dt.closest('.faq-item').classList.toggle('open');
    });
  });

})();
