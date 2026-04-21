'use strict';

const { TwitterApi } = require('twitter-api-v2');
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

// ツイート本文を生成（140字制限を考慮して日本語は短めに）
function buildMainTweet(q) {
  const choicesText = q.choices.map((c, i) => `${LABELS[i]}. ${c}`).join('\n');
  const header = `📚【今日の保育士試験1問】\n【${q.subject}】\n`;
  const footer = `\n\n答えは↓のリプライ！\n#保育士試験 #保育士勉強垢 #保育士試験2026`;

  // 問題文が長い場合は省略（日本語140字目安）
  let questionText = q.question;
  const baseLen = header.length + choicesText.length + footer.length;
  if (baseLen + questionText.length > 220) {
    questionText = questionText.slice(0, 220 - baseLen - 3) + '…';
  }

  return header + questionText + '\n\n' + choicesText + footer;
}

function buildReplyTweet(q) {
  const correctLabel = LABELS[q.answer];
  const correctText = q.choices[q.answer];
  const header = `✅ 正解：${correctLabel}. ${correctText}\n\n【解説】\n`;
  const footer = `\n\n📝 全300問無料で練習！\n${SITE_URL}`;

  let explanation = q.explanation;
  if (header.length + explanation.length + footer.length > 270) {
    explanation = explanation.slice(0, 270 - header.length - footer.length - 3) + '…';
  }

  return header + explanation + footer;
}

async function main() {
  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
  });

  const mainText = buildMainTweet(question);
  const replyText = buildReplyTweet(question);

  console.log('--- 問題ツイート ---');
  console.log(mainText);
  console.log('\n--- 解説リプライ ---');
  console.log(replyText);

  const { data: mainTweet } = await client.v2.tweet(mainText);
  console.log('\n✅ 問題ツイート投稿完了:', mainTweet.id);

  await client.v2.reply(replyText, mainTweet.id);
  console.log('✅ 解説リプライ投稿完了');
}

main().catch((err) => {
  console.error('投稿エラー:', err);
  process.exit(1);
});
