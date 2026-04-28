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

function truncate(text, max) {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

function buildQuestionText(q) {
  const choicesText = q.choices.map((c, i) => `${LABELS[i]}. ${c}`).join('\n');
  return `【${q.subject}】\n${q.question}\n\n${choicesText}`;
}

function buildAnswerText(q) {
  const correctLabel = LABELS[q.answer];
  const correctText = q.choices[q.answer];
  return `正解：${correctLabel}. ${correctText}\n\n【解説】\n${q.explanation}\n\n📝 全300問無料で練習！\n${SITE_URL}`;
}

// X（Twitter）に手動投稿するためのツイート文を生成
function buildXPostText(q) {
  const questionBody = truncate(q.question, 70);
  const choices = q.choices.map((c, i) => `${LABELS[i]}. ${truncate(c, 22)}`).join('\n');
  const tweet1 = `【今日の保育士試験1問】\n【${q.subject}】\n${questionBody}\n\n${choices}\n\n#保育士試験 #保育士勉強`;

  const correctLabel = LABELS[q.answer];
  const correctText = truncate(q.choices[q.answer], 30);
  const explanation = truncate(q.explanation, 110);
  const tweet2 = `✅ 正解：${correctLabel}. ${correctText}\n\n📖 ${explanation}\n\n📝 全300問無料で練習！\n${X_URL}`;

  return { tweet1, tweet2 };
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
  const { tweet1, tweet2 } = buildXPostText(question);

  const xSection = `
<hr>
<h3>🐦 本日のXポスト用テキスト（コピペして投稿してください）</h3>
<p style="color:#666;font-size:13px;">① 問題ツイート（スレッド1件目）</p>
<pre style="background:#f0f8ff;border:1px solid #1d9bf0;border-radius:8px;padding:12px;font-family:sans-serif;font-size:14px;line-height:1.8;white-space:pre-wrap;">${tweet1}</pre>
<p style="color:#666;font-size:13px;">② 解答ツイート（スレッド2件目 — ①にリプライ）</p>
<pre style="background:#f0f8ff;border:1px solid #1d9bf0;border-radius:8px;padding:12px;font-family:sans-serif;font-size:14px;line-height:1.8;white-space:pre-wrap;">${tweet2}</pre>
`;

  const htmlBody = `
<h2>📚 今日の保育士試験1問（${today}）</h2>
<pre style="font-family:sans-serif;font-size:15px;line-height:1.8;">${questionText}</pre>
<hr>
<h3>✅ 解答・解説</h3>
<pre style="font-family:sans-serif;font-size:15px;line-height:1.8;">${answerText}</pre>
${xSection}
`;

  const textBody = `今日の保育士試験1問（${today})\n\n${questionText}\n\n---\n\n${answerText}\n\n---\n\n【Xポスト用①（問題）】\n${tweet1}\n\n【Xポスト用②（解答・リプライ）】\n${tweet2}`;

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
