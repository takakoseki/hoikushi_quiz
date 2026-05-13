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

  // ① 問題ツイート（問題文が長い場合は文単位で複数ツイートに分割）
  const questionHeader = `📷 今日の保育士試験1問\n【${q.subject}】\n`;
  const questionHeaderLen = charCount(questionHeader);
  const questionParts = splitByLength(q.question, TWEET_LIMIT - questionHeaderLen);
  tweets.push(questionHeader + questionParts[0]);
  for (let k = 1; k < questionParts.length; k++) {
    tweets.push(questionParts[k]);
  }

  // ②③ 選択肢ツイート（2択ずつまとめ、超えたら1択ずつ）
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

  // ④ 正解＋解説ツイート（解説が長ければ続きのツイートに分割）
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
    return [...tweets, buildCtaTweet()];
  }

  for (const seg of continuationSegs) {
    tweets.push(`${continuationHeader}${seg}`);
  }

  // 最後: CTA
  tweets.push(buildCtaTweet());

  return tweets;
}

function buildCtaTweet() {
  return `📷 全460問無料で練習！\n${X_URL}\n\n#保育士試験 #保育士勉強`;
}

function buildXSection(tweets) {
  const tweetBlocks = tweets.map((text, idx) => {
    const label = CIRCLED[idx] || `(${idx + 1})`;
    const count = charCount(text);
    const note = idx === 0
      ? 'スレッド1件目'
      : idx === tweets.length - 1
        ? `スレッド${idx + 1}件目 — ${CIRCLED[idx - 1]}にリプライ（最終）`
        : `スレッド${idx + 1}件目 — ${CIRCLED[idx - 1]}にリプライ`;
    return `<p style="color:#666;font-size:13px;">${label} ${note}（${count}文字）</p>
<pre style="background:#f0f8ff;border:1px solid #1d9bf0;border-radius:8px;padding:12px;font-family:sans-serif;font-size:14px;line-height:1.8;white-space:pre-wrap;">${text}</pre>`;
  }).join('\n');

  return `
<hr>
<h3>🐦 本日のXポスト用テキスト（コピペして投稿してください）</h3>
${tweetBlocks}
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
${buildXSection(tweets)}
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
