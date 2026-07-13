'use strict';

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const os = require('os');

// questions.js を動的にロード
const questionsPath = path.join(__dirname, '../../flashcard/questions.js');
const questionsContent = fs.readFileSync(questionsPath, 'utf8');
const tmpPath = path.join(os.tmpdir(), '_hoikushi_questions.js');
fs.writeFileSync(tmpPath, questionsContent + '\nmodule.exports = QUESTIONS;');
const QUESTIONS = require(tmpPath);

// 今日の問題を決定（日付ベースで毎日異なる問題）
const daysSinceEpoch = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
const question = QUESTIONS[daysSinceEpoch % QUESTIONS.length];

const LABELS = ['A', 'B', 'C', 'D'];
const SITE_URL = 'https://hoikushi-quiz.com/flashcard/';
const X_URL = 'https://hoikushi-quiz.com/flashcard/?utm_source=twitter&utm_medium=social&utm_campaign=daily_question';
const TWEET_LIMIT = 140;
// Xの仕様: URLはすべて23文字として計算される
const URL_DISPLAY_LENGTH = 23;
const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

const SUBJECT_HASHTAGS = {
  '保育原理':       '#保育原理',
  '教育原理':       '#教育原理',
  '社会福祉':       '#社会福祉',
  '子ども家庭福祉': '#子ども家庭福祉',
  '社会的養護':     '#社会的養護',
  '保育の心理学':   '#保育心理学',
  '子どもの保健':   '#子どもの保健',
  '子どもの食と栄養': '#食と栄養',
  '保育実習理論':   '#保育実習理論',
};

const SUBJECT_TIPS = {
  '保育原理':       '保育所保育指針の改定ポイントと倉橋惣三・フレーベルなど歴史上の人物はセットで覚えよう！',
  '教育原理':       '教育基本法と学校教育法の違い、ルソー・ペスタロッチ・フレーベルの思想を人物ごとに整理しよう！',
  '社会福祉':       'バイスティックの7原則（受容・自己決定・秘密保持など）は毎年頻出！声に出して覚えよう✅',
  '子ども家庭福祉': '子どもの権利条約の4つの権利と、里親・児童相談所の役割を整理しよう！',
  '社会的養護':     '里親の4種類（養育・専門・養子縁組・親族）と施設種別の違いを区別して覚えよう！',
  '保育の心理学':   'ピアジェ・ヴィゴツキー・エリクソン・ボウルビィの理論を人物名とセットで整理しよう！',
  '子どもの保健':   '感染症の出席停止期間と予防接種の定期・任意の区別は毎年頻出！繰り返し確認しよう✅',
  '子どもの食と栄養': '特定原材料8品目（卵・乳・小麦・えび・かに・落花生・そば・くるみ）をまず完璧に覚えよう！',
  '保育実習理論':   '楽典（移調・コードネーム・拍子記号）は繰り返し練習が合格への近道！音符の長さも確認しよう✅',
};

const SUBJECT_URLS = {
  '保育原理':       'https://hoikushi-quiz.com/flashcard/hoiku-genri/',
  '教育原理':       'https://hoikushi-quiz.com/flashcard/kyoiku-genri/',
  '社会福祉':       'https://hoikushi-quiz.com/flashcard/shakai-fukushi/',
  '子ども家庭福祉': 'https://hoikushi-quiz.com/flashcard/kodomo-katei-fukushi/',
  '社会的養護':     'https://hoikushi-quiz.com/flashcard/shakaiteki-yogo/',
  '保育の心理学':   'https://hoikushi-quiz.com/flashcard/hoiku-shinrigaku/',
  '子どもの保健':   'https://hoikushi-quiz.com/flashcard/kodomo-hoken/',
  '子どもの食と栄養': 'https://hoikushi-quiz.com/flashcard/shokuji-eiyou/',
  '保育実習理論':   'https://hoikushi-quiz.com/flashcard/jisshu-riron/',
};

const POLL_HOOKS = [
  '受験生が間違えやすい問題です👇\nアンケートで答えてみてください！',
  '正答率の低い頻出問題です👇\nアンケートで答えてみてください！',
  'あなたは解けますか？👇\nアンケートで回答してみてください！',
  '試験直前に確認したい問題です👇\nアンケートで答えてみてください！',
];

const TEXT_HOOKS = [
  '受験生が間違えやすい問題です\n②で選択肢を確認してみてください！',
  '正答率の低い頻出問題です\n②で選択肢を確認してみてください！',
  'あなたは解けますか？\n②の選択肢で確認してみてください！',
  '試験直前に確認したい問題です\n②の選択肢から選んでみてください！',
];

const POLL_CHOICE_LIMIT = 25;

function canUsePoll(q) {
  return q.choices.every(c => [...c].length <= POLL_CHOICE_LIMIT);
}

function charCount(text) {
  // URLを23文字として計算
  const withoutUrls = text.replace(/https?:\/\/\S+/g, '');
  const urlMatches = text.match(/https?:\/\/\S+/g) || [];
  return [...withoutUrls].length + urlMatches.length * URL_DISPLAY_LENGTH;
}

// 1文が maxLen を超える場合、読点（、）や句点で強制分割する
function hardSplitSentence(text, maxLen) {
  if (charCount(text) <= maxLen) return [text];
  const parts = [];
  let current = '';
  // 読点・句点・閉じ括弧後で分割を試みる
  const chunks = text.split(/(?<=[。、」）\)])/);
  for (const chunk of chunks) {
    const candidate = current + chunk;
    if (charCount(candidate) <= maxLen) {
      current = candidate;
    } else {
      if (current) parts.push(current);
      current = chunk;
    }
  }
  if (current) parts.push(current);
  return parts.length > 0 ? parts : [text];
}

// 日本語の文末（。！？）で分割しながら maxLen 以内のセグメントにまとめる
function splitByLength(text, maxLen) {
  const parts = [];
  let current = '';
  const sentences = text.match(/[^。！？]+[。！？]?/g) || [text];

  for (const sentence of sentences) {
    const candidate = current + sentence;
    if (charCount(candidate) <= maxLen) {
      current = candidate;
    } else {
      if (current) parts.push(current);
      if (charCount(sentence) <= maxLen) {
        current = sentence;
      } else {
        // 1文自体が長すぎる場合は強制分割
        const forced = hardSplitSentence(sentence, maxLen);
        for (let k = 0; k < forced.length - 1; k++) parts.push(forced[k]);
        current = forced[forced.length - 1];
      }
    }
  }
  if (current) parts.push(current);
  return parts.length > 0 ? parts : [text];
}

function buildQuestionText(q) {
  const choicesText = q.choices.map((c, i) => `${LABELS[i]}. ${c}`).join('\n');
  return `【${q.subject}】\n${q.question}\n\n${choicesText}`;
}

function buildAnswerText(q) {
  const correctLabel = LABELS[q.answer];
  const correctText = q.choices[q.answer];
  return `正解：${correctLabel}. ${correctText}\n\n【解説】\n${q.explanation}\n\n📝 全460問無料で練習！\n${SITE_URL}`;
}

// X（Twitter）投稿用のスレッドを生成（各ツイートは140文字以内）
function buildXPostTweets(q) {
  const tweets = [];
  const usePoll = canUsePoll(q);
  const hooks = usePoll ? POLL_HOOKS : TEXT_HOOKS;
  const hook = hooks[daysSinceEpoch % hooks.length];
  const subjectTag = SUBJECT_HASHTAGS[q.subject] || '';

  // ① フック＋問題ツイート（URL・ハッシュタグ付き）
  const subjectUrl = SUBJECT_URLS[q.subject] || SITE_URL;
  const questionHeader = `📝【${q.subject}・頻出問題】\n\n`;
  const footer = `\n\n${subjectUrl}\n\n${hook}`;
  const bodyMax = TWEET_LIMIT - charCount(questionHeader) - charCount(footer);
  const questionParts = splitByLength(q.question, bodyMax);
  tweets.push(questionHeader + questionParts[0] + footer);
  for (let k = 1; k < questionParts.length; k++) {
    tweets.push(questionParts[k]);
  }

  // アンケート不使用時: ②で選択肢をテキスト投稿（2択ずつまとめ、超えたら1択ずつ）
  if (!usePoll) {
    const choiceLines = q.choices.map((c, i) => `${LABELS[i]}. ${c}`);
    let i = 0;
    while (i < choiceLines.length) {
      if (i + 1 < choiceLines.length) {
        const combined = choiceLines[i] + '\n' + choiceLines[i + 1];
        if (charCount(combined) <= TWEET_LIMIT) {
          tweets.push(combined);
          i += 2;
          continue;
        }
      }
      tweets.push(choiceLines[i]);
      i++;
    }
  }

  // 正解＋解説ツイート（解説が長ければ続きのツイートに分割）
  const correctLabel = LABELS[q.answer];
  const correctChoice = q.choices[q.answer];
  const answerLine = `正解：${correctLabel}. ${correctChoice}`;
  const explanationHeader = '【解説】\n';
  const continuationHeader = '【解説：続き】\n';

  const firstSegmentMax = TWEET_LIMIT - charCount(answerLine + '\n\n' + explanationHeader);
  const continuationMax = TWEET_LIMIT - charCount(continuationHeader);

  // 解説を文単位で分割し、1件目は firstSegmentMax、続きは continuationMax でまとめる
  const sentences = q.explanation.match(/[^。！？]+[。！？]?/g) || [q.explanation];
  let firstSeg = '';
  let sentIdx = 0;
  while (sentIdx < sentences.length) {
    const candidate = firstSeg + sentences[sentIdx];
    if (charCount(candidate) <= Math.max(firstSegmentMax, 20)) {
      firstSeg = candidate;
      sentIdx++;
    } else {
      break;
    }
  }
  // 残りの文を continuationMax 以内でまとめる（1文が長すぎる場合は強制分割）
  const continuationSegs = [];
  let cur = '';
  while (sentIdx < sentences.length) {
    const sentence = sentences[sentIdx];
    const candidate = cur + sentence;
    if (charCount(candidate) <= continuationMax) {
      cur = candidate;
      sentIdx++;
    } else {
      if (cur) continuationSegs.push(cur);
      // 1文自体が長すぎる場合は強制分割して追加
      if (charCount(sentence) > continuationMax) {
        const forced = hardSplitSentence(sentence, continuationMax);
        for (let k = 0; k < forced.length - 1; k++) continuationSegs.push(forced[k]);
        cur = forced[forced.length - 1];
      } else {
        cur = sentence;
      }
      sentIdx++;
    }
  }
  if (cur) continuationSegs.push(cur);

  const firstTweet = `${answerLine}\n\n${explanationHeader}${firstSeg}`;
  if (charCount(firstTweet) <= TWEET_LIMIT) {
    tweets.push(firstTweet);
  } else {
    tweets.push(answerLine);
    const resplit = splitByLength(q.explanation, TWEET_LIMIT - charCount(explanationHeader));
    tweets.push(`${explanationHeader}${resplit[0]}`);
    for (let j = 1; j < resplit.length; j++) {
      tweets.push(`${continuationHeader}${resplit[j]}`);
    }
    const tip = buildTipTweet(q);
    return [...tweets, ...(tip ? [tip] : []), buildCtaTweet(subjectTag)];
  }

  for (const seg of continuationSegs) {
    tweets.push(`${continuationHeader}${seg}`);
  }

  // 学習ポイント
  const tipTweet = buildTipTweet(q);
  if (tipTweet) tweets.push(tipTweet);

  // 最後: CTA
  tweets.push(buildCtaTweet(subjectTag));

  return tweets;
}

function buildTipTweet(q) {
  const tip = SUBJECT_TIPS[q.subject];
  const subjectUrl = SUBJECT_URLS[q.subject] || SITE_URL;
  if (!tip) return null;
  const text = `📌【保育士試験 ${q.subject}】今日の学習ポイント\n\n${tip}\n\n${subjectUrl}`;
  return charCount(text) <= TWEET_LIMIT ? text : null;
}

function buildCtaTweet(subjectTag) {
  return `📚 全460問無料で練習できます！\n${X_URL}\n\n#保育士試験 #保育士試験2026 #保育士勉強垢 ${subjectTag}`.trimEnd();
}

function buildPollSection(q) {
  const pollRows = q.choices.map((c, i) => `<tr>
    <td style="padding:4px 8px;font-weight:bold;white-space:nowrap;">${LABELS[i]}.</td>
    <td style="padding:4px 8px;">${c}</td>
  </tr>`).join('\n');

  return `
<hr>
<h3>📊 アンケート設定（①のツイートにアンケートを追加してください）</h3>
<p style="color:#333;font-size:14px;">①のテキストを投稿する際、<strong>「アンケートを追加」</strong>から以下の4択をそのまま入力してください。</p>
<table style="border-collapse:collapse;background:#fff8e1;border:1px solid #f0b429;border-radius:8px;padding:8px;font-family:sans-serif;font-size:14px;line-height:1.8;width:100%;">
${pollRows}
</table>
`;
}

function buildXSection(q, tweets) {
  const usePoll = canUsePoll(q);
  const tweetBlocks = tweets.map((text, idx) => {
    const label = CIRCLED[idx] || `(${idx + 1})`;
    const count = charCount(text);
    let note;
    if (idx === 0) {
      note = usePoll ? 'スレッド1件目（アンケート付きで投稿）' : 'スレッド1件目';
    } else if (idx === tweets.length - 1) {
      note = `スレッド${idx + 1}件目 — ${CIRCLED[idx - 1]}にリプライ（最終）`;
    } else {
      note = `スレッド${idx + 1}件目 — ${CIRCLED[idx - 1]}にリプライ`;
    }
    return `<p style="color:#666;font-size:13px;">${label} ${note}（${count}文字）</p>
<pre style="background:#f0f8ff;border:1px solid #1d9bf0;border-radius:8px;padding:12px;font-family:sans-serif;font-size:14px;line-height:1.8;white-space:pre-wrap;">${text}</pre>`;
  }).join('\n');

  return `
<hr>
<h3>🐦 本日のXポスト用テキスト（コピペして投稿してください）</h3>
${tweetBlocks}
${usePoll ? buildPollSection(q) : ''}
`;
}

function buildXTextSection(tweets) {
  return tweets.map((text, idx) => {
    const label = CIRCLED[idx] || `(${idx + 1})`;
    return `【Xポスト用${label}】\n${text}`;
  }).join('\n\n');
}

async function main() {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.NOTIFY_GMAIL_USER,
      pass: process.env.NOTIFY_GMAIL_APP_PASSWORD,
    },
  });

  const today = new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const questionText = buildQuestionText(question);
  const answerText = buildAnswerText(question);
  const tweets = buildXPostTweets(question);

  const htmlBody = `
<h2>📚 今日の保育士試験1問（${today}）</h2>
<pre style="font-family:sans-serif;font-size:15px;line-height:1.8;">${questionText}</pre>
<hr>
<h3>✅ 解答・解説</h3>
<pre style="font-family:sans-serif;font-size:15px;line-height:1.8;">${answerText}</pre>
${buildXSection(question, tweets)}
`;

  const textBody = `今日の保育士試験1問（${today})\n\n${questionText}\n\n---\n\n${answerText}\n\n---\n\n${buildXTextSection(tweets)}`;

  const mailOptions = {
    from: process.env.NOTIFY_GMAIL_USER,
    to: process.env.NOTIFY_EMAIL_TO,
    subject: `📚【今日の保育士試験1問】${today}／${question.subject}`,
    text: textBody,
    html: htmlBody,
  };

  await transporter.sendMail(mailOptions);
  console.log('✅ メール送信完了');
}

main().catch((err) => {
  console.error('送信エラー:', err);
  process.exit(1);
});
