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
const SITE_URL = 'https://takakoseki.github.io/koseki-clinic/flashcard/';

function buildQuestionText(q) {
  const choicesText = q.choices.map((c, i) => `${LABELS[i]}. ${c}`).join('\n');
  return `【${q.subject}】\n${q.question}\n\n${choicesText}`;
}

function buildAnswerText(q) {
  const correctLabel = LABELS[q.answer];
  const correctText = q.choices[q.answer];
  return `正解：${correctLabel}. ${correctText}\n\n【解説】\n${q.explanation}\n\n📝 全300問無料で練習！\n${SITE_URL}`;
}

async function main() {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const today = new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const questionText = buildQuestionText(question);
  const answerText = buildAnswerText(question);

  const htmlBody = `
<h2>📚 今日の保育士試験1問（${today}）</h2>
<pre style="font-family:sans-serif;font-size:15px;line-height:1.8;">${questionText}</pre>
<hr>
<h3>✅ 解答・解説</h3>
<pre style="font-family:sans-serif;font-size:15px;line-height:1.8;">${answerText}</pre>
`;

  const textBody = `今日の保育士試験1問（${today}）\n\n${questionText}\n\n---\n\n${answerText}`;

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: process.env.MAIL_TO,
    subject: `📚【今日の保育士試験1問】${today}／${question.subject}`,
    text: textBody,
    html: htmlBody,
  };

  console.log('--- 送信内容 ---');
  console.log('件名:', mailOptions.subject);
  console.log(textBody);

  await transporter.sendMail(mailOptions);
  console.log('\n✅ メール送信完了');
}

main().catch((err) => {
  console.error('送信エラー:', err);
  process.exit(1);
});
