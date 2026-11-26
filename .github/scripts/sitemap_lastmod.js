// sitemap.xml の更新日（lastmod）を、各ページを最後に変えた日（git の記録、日本時間）に合わせる。
// 使い方：
//   node .github/scripts/sitemap_lastmod.js          … lastmod を書き換える
//   node .github/scripts/sitemap_lastmod.js --check  … ずれているページを表示し、ずれがあれば終了コード1
//   node .github/scripts/sitemap_lastmod.js --changed <比較元のコミット>
//     … 比較元から今までに HTML を変えたページだけを点検する（PR の自動チェック用）。
//       変えたページの lastmod が、そのページを最後に変えたコミットの日より前なら終了コード1。
//       PR を別の日にマージするとマージのコミットの日付がずれるため、PR で変えていないページは点検しない。
// ページの HTML（<path>/index.html）にコミットしていない変更があるときは、今日の日付（日本時間）を使う。
// git の履歴をたどるため、浅いクローン（fetch-depth: 1）では正しい日付にならない。CLAUDE.md ルール104・105・107。
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

// ---- PR で変えたページだけを点検する ----
const changedIdx = process.argv.indexOf('--changed');
if (changedIdx !== -1) {
  const base = process.argv[changedIdx + 1];
  if (!base) { console.error('--changed のあとに比較元のコミットを指定してください'); process.exit(2); }
  const inSitemap = new Map();
  for (const [, block] of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = (block.match(/<loc>([^<]+)<\/loc>/) || [])[1] || '';
    const rel = loc.startsWith(ORIGIN) ? loc.slice(ORIGIN.length) : '';
    const file = rel === '' || rel.endsWith('/') ? rel + 'index.html' : rel;
    inSitemap.set(file, { loc, lastmod: (block.match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1] || '' });
  }
  const changed = git(['diff', '--name-only', base, 'HEAD']).split('\n').filter((f) => /(^|\/)index\.html$/.test(f));
  const problems = [];
  const notes = [];
  for (const file of changed) {
    const page = inSitemap.get(file);
    if (!page) {
      // 転送用のページ（noindex・meta refresh）はサイトマップに載せないため除く
      const html = fs.existsSync(path.join(ROOT, file)) ? fs.readFileSync(path.join(ROOT, file), 'utf8') : '';
      if (html && !/noindex|http-equiv=["']refresh["']/i.test(html)) notes.push(`${file} は sitemap.xml に載っていません（新しいページなら sitemap に足してください）`);
      continue;
    }
    const want = git(['log', '-1', '--format=%cd', '--date=format-local:%Y-%m-%d', `${base}..HEAD`, '--', file]);
    if (!want) continue;
    const ok = page.lastmod >= want;
    console.log(`${ok ? '一致' : 'ずれ'}  ${page.loc}  sitemap=${page.lastmod || '（なし）'}  ページを変えた日=${want}`);
    if (!ok) problems.push(page.loc);
  }
  notes.forEach((n) => console.log('注意  ' + n));
  if (changed.length === 0) console.log('この変更では、ページの HTML は変わっていません');
  if (problems.length) {
    console.log(`更新日が古いままのページ: ${problems.length}件。node .github/scripts/sitemap_lastmod.js を実行し、sitemap.xml もコミットしてください（CLAUDE.md ルール105）`);
    process.exit(1);
  }
  console.log('変えたページの sitemap.xml の更新日は、すべて最新です');
  process.exit(0);
}

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
