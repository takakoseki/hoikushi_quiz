// 科目ページの「例題」を flashcard/questions.js から作り直す。
//
// 例題は検索から来た人に見せる静的なHTMLで、問題データのコピーになっている。
// 問題を直しても例題が古いまま残ると、直したはずの誤りや「知識なしで解ける作り」が
// ページ上に残り続けるため、問題データを正として例題を生成し直す。
//
// 使い方:
//   node .github/scripts/sync_samples.js          例題を問題データに合わせて書き換える
//   node .github/scripts/sync_samples.js --check  ずれがあれば一覧を出して終了コード1で終わる
//
// 例題は <article class="sample-q" data-qid="問題ID"> で問題を指定する。
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DIR = path.join(ROOT, 'flashcard');
const CHECK = process.argv.includes('--check');

const QUESTIONS = new Function(fs.readFileSync(path.join(DIR, 'questions.js'), 'utf8') + ';return QUESTIONS;')();
const byId = new Map(QUESTIONS.map((q) => [q.id, q]));

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const LETTERS = ['A', 'B', 'C', 'D'];

function render(q, no, indent) {
  const i1 = indent + '  ';
  const i2 = indent + '    ';
  // 見出しの「正解：X」と重ならないよう、解説の書き出しの「正解はX。」は外す
  const explanation = q.explanation.replace(/^正解は[A-D]。/, '');
  return [
    `<article class="sample-q" data-qid="${q.id}">`,
    `${i1}<p>例題 ${no}</p>`,
    `${i1}<h3>${esc(q.question)}</h3>`,
    `${i1}<ol>`,
    ...q.choices.map((c, k) => `${i2}<li${k === q.answer ? ' class="is-answer"' : ''}>${esc(c)}</li>`),
    `${i1}</ol>`,
    `${i1}<p class="sample-a"><b>正解：${LETTERS[q.answer]}</b>　${esc(explanation)}</p>`,
    `${indent}</article>`,
  ].join('\n');
}

const problems = [];
let changed = 0;
for (const name of fs.readdirSync(DIR)) {
  const file = path.join(DIR, name, 'index.html');
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, 'utf8');
  if (!html.includes('class="sample-q"')) continue;
  let no = 0;
  const out = html.replace(/([ \t]*)<article class="sample-q"([^>]*)>[\s\S]*?<\/article>/g, (block, indent, attrs) => {
    no += 1;
    const m = attrs.match(/data-qid="(\d+)"/);
    if (!m) { problems.push(`${name}: 例題${no} に data-qid がない`); return block; }
    const q = byId.get(Number(m[1]));
    if (!q) { problems.push(`${name}: 例題${no} の問題ID ${m[1]} が問題データにない`); return block; }
    if (q.question.includes('\n')) { problems.push(`${name}: 例題${no}（ID${q.id}）は改行を含む問題で、例題に使えない`); return block; }
    return indent + render(q, no, indent);
  });
  if (out !== html) {
    changed += 1;
    if (CHECK) problems.push(`${name}: 例題が問題データと一致していない（node .github/scripts/sync_samples.js で更新）`);
    else fs.writeFileSync(file, out);
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(CHECK ? '例題は問題データと一致しています' : `例題を更新したページ: ${changed}`);
