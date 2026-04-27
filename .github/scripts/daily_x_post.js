'use strict';

const { TwitterApi } = require('twitter-api-v2');
const fs = require('fs');
const path = require('path');
const os = require('os');

const questionsPath = path.join(__dirname, '../../flashcard/questions.js');
const questionsContent = fs.readFileSync(questionsPath, 'utf8');
const tmpPath = path.join(os.tmpdir(), '_hoikushi_questions_x.js');
fs.writeFileSync(tmpPath, questionsContent + '\nmodule.exports = QUESTIONS;');
const QUESTIONS = require(tmpPath);

const daysSinceEpoch = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
const question = QUESTIONS[daysSinceEpoch % QUESTIONS.length];

const LABELS = ['A', 'B', 'C', 'D'];
const SHARE_URL = 'https://hoikushi-quiz.com/flashcard/?utm_source=twitter&utm_medium=social&utm_campaign=daily_question';

function truncate(text, max) {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

function buildQuestionTweet(q) {
  const questionText = truncate(q.question, 70);
  const choices = q.choices.map((c, i) => `${LABELS[i]}. ${truncate(c, 22)}`).join('\n');
  return `【今日の保育士試験1問】\n【${q.subject}】\n${questionText}\n\n${choices}\n\n#保育士試験 #保育士勉強`;
}

function buildAnswerTweet(q) {
  const correctLabel = LABELS[q.answer];
  const correctText = truncate(q.choices[q.answer], 30);
  const explanation = truncate(q.explanation, 110);
  return `✅ 正解：${correctLabel}. ${correctText}\n\n📖 ${explanation}\n\n📝 全300問無料で練習！\n${SHARE_URL}`;
}

async function main() {
  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
  });

  const rwClient = client.readWrite;

  const tweet1 = buildQuestionTweet(question);
  const tweet2 = buildAnswerTweet(question);

  const response1 = await rwClient.v2.tweet(tweet1);
  console.log('✅ 問題ツイート投稿完了:', response1.data.id);

  await rwClient.v2.reply(tweet2, response1.data.id);
  console.log('✅ 解答ツイート投稿完了');
}

main().catch((err) => {
  console.error('X投稿エラー:', err);
  process.exit(1);
});
