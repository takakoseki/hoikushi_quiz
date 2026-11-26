// sitemap.xml の更新日（lastmod）を、各ページを最後に変えた日（git の記録、日本時間）に合わせる。
// 使い方：
//   node .github/scripts/sitemap_lastmod.js          … lastmod を書き換える
//   node .github/scripts/sitemap_lastmod.js --check  … ずれているページを表示し、ずれがあれば終了コード1
// ページの HTML（<path>/index.html）にコミットしていない変更があるときは、今日の日付（日本時間）を使う。
// git の履歴をたどるため、浅いクローン（fetch-depth: 1）では正しい日付にならない。CLAUDE.md ルール104・105。
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SITEMAP = path.join(ROOT, 'sitemap.xml');
const ORIGIN = 'https://hoikushi-quiz.com/';
const check = process.argv.includes('--check');

const env = { ...process.env, TZ: 'Asia/Tokyo' };
const git = (args) => execFileSync('git', args, { cwd: ROOT, env, encoding: 'utf8' }).trim();
const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());

if (git(['rev-parse', '--is-shallow-repository']) === 'true') {
  console.error('浅いクローンのため、ページを変えた日をたどれません（fetch-depth: 0 で取得してください）');
  process.exit(2);
}

function lastChanged(file) {
  if (!fs.existsSync(path.join(ROOT, file))) throw new Error('ページのファイルが見つかりません: ' + file);
  if (git(['status', '--porcelain', '--', file]) !== '') return today;
  const d = git(['log', '-1', '--format=%cd', '--date=format-local:%Y-%m-%d', '--', file]);
  if (!d) throw new Error('git の記録が見つかりません: ' + file);
  return d;
}

const xml = fs.readFileSync(SITEMAP, 'utf8');
const diffs = [];
const out = xml.replace(/<url>([\s\S]*?)<\/url>/g, (block) => {
  const loc = (block.match(/<loc>([^<]+)<\/loc>/) || [])[1];
  if (!loc || !loc.startsWith(ORIGIN)) throw new Error('想定外の loc: ' + loc);
  const rel = loc.slice(ORIGIN.length);
  const file = rel === '' || rel.endsWith('/') ? rel + 'index.html' : rel;
  const want = lastChanged(file);
  const cur = (block.match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1];
  if (!cur) throw new Error('lastmod がありません: ' + loc);
  if (cur !== want) diffs.push({ loc, cur, want });
  return block.replace(/<lastmod>[^<]+<\/lastmod>/, '<lastmod>' + want + '</lastmod>');
});

for (const d of diffs) console.log(`${d.loc}  ${d.cur} → ${d.want}`);
if (check) {
  console.log(diffs.length ? `更新日がずれているページ: ${diffs.length}件` : 'sitemap.xml の更新日は、すべてのページで最後に変えた日と一致しています');
  process.exit(diffs.length ? 1 : 0);
}
fs.writeFileSync(SITEMAP, out);
console.log(diffs.length ? `${diffs.length}件の更新日を書き換えました` : '書き換えるページはありませんでした');
