// アドホック調査：Search Console・GA4 から指定した切り口のデータを取得し、メールで送る。
//
// 使い方（GitHub Actions「アドホック調査」→ Run workflow）
//   kind   : 調査の種類（下の RECIPES のキー）
//   target : 調査対象（種類ごとに意味が異なる。各レシピのコメント参照）
//   days   : 集計日数（既定90）。終端はデータ確定を待つため3日前
//   limit  : 表の最大行数（既定30）
//
// 運営数値は公開リポジトリに残さない方針のため（CLAUDE.md ルール55）、結果はメールだけで送る。
// 公開リポジトリの Actions ログは誰でも見られるため、ログには数値を一切出さない。
// 新しい切り口が必要になったら RECIPES に関数を1つ追加し、ワークフローの kind の選択肢にも足す。
const { google } = require('googleapis');
const nodemailer = require('nodemailer');

const env = process.env;
const SITE_ORIGIN = 'https://hoikushi-quiz.com';
const KIND = (env.ADHOC_KIND || '').trim();
const TARGET = (env.ADHOC_TARGET || '').trim();
const DAYS = clamp(parseInt(env.ADHOC_DAYS || '90', 10), 1, 480, 90);   // GSC の保持期間は16か月
const LIMIT = clamp(parseInt(env.ADHOC_LIMIT || '30', 10), 1, 200, 30);

function clamp(n, lo, hi, fallback) {
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
}
function dateStr(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}
// GSC は2〜3日、GA4 は1〜2日データ確定に要するため、3日前を終端にする（週次レポートと同じ）
const END = dateStr(3);
const START = dateStr(3 + DAYS - 1);

// ---- 表示用 ----
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (v) => (v * 100).toFixed(1) + '%';
const pos = (v) => v.toFixed(1) + '位';
const dur = (sec) => { const s = Math.round(sec); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const shortUrl = (u) => u.replace(SITE_ORIGIN, '') || '/';

function table(headers, rows, emptyMsg) {
  const th = headers.map((h) => `<th style="padding:4px 8px;background:#f0f0f0;">${esc(h)}</th>`).join('');
  if (rows.length === 0) {
    // 0件でも表を消さず、該当なしと明示する（ルール43）
    return `<table border="1" cellspacing="0" style="border-collapse:collapse;font-size:14px;"><tr>${th}</tr>`
      + `<tr><td colspan="${headers.length}" style="padding:4px 8px;">${esc(emptyMsg)}</td></tr></table>`;
  }
  const body = rows.map((r) => '<tr>' + r.map((v, i) =>
    `<td style="padding:4px 8px;${i === 0 ? '' : 'text-align:right;'}">${esc(v)}</td>`).join('') + '</tr>').join('');
  return `<table border="1" cellspacing="0" style="border-collapse:collapse;font-size:14px;"><tr>${th}</tr>${body}</table>`;
}
const failed = (what, e) => `<p style="color:#b00;">${esc(what)}を取得できませんでした：${esc(e.message || e)}</p>`;

// 「kodomo-hoken」「/flashcard/kodomo-hoken/」「https://…」「top」のどれでも受け付ける
function toPath(s) {
  s = s.trim();
  if (!s) return null;
  if (/^https?:\/\//.test(s)) return new URL(s).pathname;
  if (s === 'top') return '/flashcard/';
  if (s.startsWith('/')) return s.endsWith('/') || /\.[a-z]+$/.test(s) ? s : s + '/';
  return '/flashcard/' + s.replace(/\/$/, '') + '/';
}

// ---- API ----
async function gscRows(auth, requestBody) {
  const webmasters = google.webmasters({ version: 'v3', auth });
  const res = await webmasters.searchanalytics.query({
    siteUrl: env.GSC_SITE_URL,
    requestBody: { startDate: START, endDate: END, ...requestBody },
  });
  return res.data.rows || [];
}
const gscFilter = (dimension, operator, expression) =>
  ({ dimensionFilterGroups: [{ filters: [{ dimension, operator, expression }] }] });

async function ga4Rows(auth, requestBody) {
  const analyticsdata = google.analyticsdata({ version: 'v1beta', auth });
  const res = await analyticsdata.properties.runReport({
    property: `properties/${env.GA4_PROPERTY_ID}`,
    requestBody: { dateRanges: [{ startDate: START, endDate: END }], ...requestBody },
  });
  return res.data.rows || [];
}

// ---- 調査の種類 ----
const RECIPES = {
  // target: ページ（カンマ区切り）。例「kodomo-hoken,shokuji-eiyou」「top」
  // ページごとに、合計・検索語別の成績・URL検査（登録状態と Google が選んだ正規URL）を出す
  'gsc-pages': {
    label: 'ページ別の検索成績とURL検査',
    async run(auth) {
      const paths = TARGET.split(',').map(toPath).filter(Boolean);
      if (paths.length === 0) throw new Error('target にページを指定してください（例: kodomo-hoken,shokuji-eiyou）');
      const searchconsole = google.searchconsole({ version: 'v1', auth });
      let html = '';
      for (const p of paths) {
        const url = SITE_ORIGIN + p;
        html += `<h3>${esc(p)}</h3>`;

        try {
          const [t] = await gscRows(auth, gscFilter('page', 'equals', url));
          html += t
            ? `<p>合計：表示 ${t.impressions} 回／クリック ${t.clicks}／CTR ${pct(t.ctr)}／平均 ${pos(t.position)}</p>`
            : '<p>合計：この期間の表示はありません。</p>';
        } catch (e) { html += failed('合計', e); }

        try {
          const rows = (await gscRows(auth, { dimensions: ['query'], rowLimit: 1000, ...gscFilter('page', 'equals', url) }))
            .sort((a, b) => b.impressions - a.impressions).slice(0, LIMIT);
          html += '<p><strong>検索語別（表示回数の多い順）</strong></p>'
            + table(['検索語', '表示回数', 'クリック', 'CTR', '平均順位'],
              rows.map((r) => [r.keys[0], r.impressions, r.clicks, pct(r.ctr), pos(r.position)]),
              'この期間に表示された検索語はありません。');
        } catch (e) { html += failed('検索語別の成績', e); }

        try {
          const res = await searchconsole.urlInspection.index.inspect({
            requestBody: { inspectionUrl: url, siteUrl: env.GSC_SITE_URL, languageCode: 'ja-JP' },
          });
          const s = (res.data.inspectionResult || {}).indexStatusResult || {};
          const same = s.googleCanonical && s.userCanonical && s.googleCanonical === s.userCanonical;
          html += '<p><strong>URL検査</strong></p>' + table(['項目', '結果'], [
            ['判定', s.verdict || '–'],
            ['登録の状態', s.coverageState || '–'],
            ['Google が選択した正規URL', s.googleCanonical || '–'],
            ['サイトで指定した正規URL', s.userCanonical || '–'],
            ['正規URLの一致', s.googleCanonical ? (same ? '一致' : '⚠️ 不一致') : '–'],
            ['最終クロール', s.lastCrawlTime || '–'],
            ['取得の状態', s.pageFetchState || '–'],
          ], '–');
        } catch (e) { html += failed('URL検査の結果', e); }
      }
      return html;
    },
  },

  // target: 検索語に含まれる文字。例「子どもの保健」
  // その文字を含む検索語ごとに、どのページが何位で表示されているかを出す（ページの取り合いの確認）
  'gsc-query': {
    label: '検索語ごとの表示ページ',
    async run(auth) {
      if (!TARGET) throw new Error('target に検索語に含まれる文字を指定してください（例: 子どもの保健）');
      const rows = (await gscRows(auth, { dimensions: ['query', 'page'], rowLimit: 1000, ...gscFilter('query', 'contains', TARGET) }))
        .sort((a, b) => b.impressions - a.impressions).slice(0, LIMIT);
      return table(['検索語', 'ページ', '表示回数', 'クリック', '平均順位'],
        rows.map((r) => [r.keys[0], shortUrl(r.keys[1]), r.impressions, r.clicks, pos(r.position)]),
        `「${TARGET}」を含む検索語での表示はありません。`);
    },
  },

  // target: GA4 のイベント名。例「promo_view」「affiliate_click」
  // ページ別と、訴求の案件×設置場所別のイベント数を出す
  'ga4-event': {
    label: 'GA4 イベントの内訳',
    async run(auth) {
      if (!TARGET) throw new Error('target にイベント名を指定してください（例: promo_view）');
      const filter = { dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { value: TARGET } } } };
      const order = { orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }], limit: LIMIT };
      let html = '';
      try {
        const rows = await ga4Rows(auth, { dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'eventCount' }], ...filter, ...order });
        html += '<p><strong>ページ別</strong></p>' + table(['ページ', '回数'],
          rows.map((r) => [r.dimensionValues[0].value, r.metricValues[0].value]), `「${TARGET}」の記録はありません。`);
      } catch (e) { html += failed('ページ別の回数', e); }
      try {
        const rows = await ga4Rows(auth, {
          dimensions: [{ name: 'customEvent:promo_id' }, { name: 'customEvent:placement' }],
          metrics: [{ name: 'eventCount' }], ...filter, ...order,
        });
        html += '<p><strong>案件 × 設置場所別</strong>（訴求のイベントのみ意味を持つ）</p>' + table(['案件', '設置場所', '回数'],
          rows.map((r) => [r.dimensionValues[0].value, r.dimensionValues[1].value, r.metricValues[0].value]), '記録はありません。');
      } catch (e) { html += failed('案件×設置場所別の回数', e); }
      return html;
    },
  },

  // target: ページのパスに含まれる文字。例「/flashcard/」「kodomo-hoken」
  // ページごとのセッション・PV・直帰率・滞在時間・エンゲージメント率を出す
  'ga4-pages': {
    label: 'GA4 ページ別の利用状況',
    async run(auth) {
      const rows = await ga4Rows(auth, {
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'sessions' }, { name: 'screenPageViews' }, { name: 'bounceRate' },
          { name: 'averageSessionDuration' }, { name: 'engagementRate' }],
        dimensionFilter: { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'CONTAINS', value: TARGET || '/' } } },
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: LIMIT,
      });
      return table(['ページ', 'セッション', 'PV', '直帰率', '平均滞在', 'エンゲージメント率'],
        rows.map((r) => {
          const m = r.metricValues.map((v) => parseFloat(v.value));
          return [r.dimensionValues[0].value, m[0], m[1], pct(m[2]), dur(m[3]), pct(m[4])];
        }), `パスに「${TARGET}」を含むページの記録はありません。`);
    },
  },
};

async function main() {
  const recipe = RECIPES[KIND];
  if (!recipe) throw new Error(`kind が不正です: ${KIND}（${Object.keys(RECIPES).join(' / ')}）`);

  const auth = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: env.GOOGLE_REFRESH_TOKEN });

  const body = await recipe.run(auth);
  const today = new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const html = `
<h2>🔎 アドホック調査：${esc(recipe.label)}</h2>
<p style="font-size:13px;color:#555;">種類：${esc(KIND)}／対象：${esc(TARGET || '（指定なし）')}／集計期間：${START} 〜 ${END}（${DAYS}日間）／最大 ${LIMIT} 行</p>
${body}
<hr>
<p style="font-size:12px;color:#666;">この調査結果はメールのみで配信しています（運営数値を公開リポジトリに残さないため）。</p>`;

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 587, secure: false,
    auth: { user: env.NOTIFY_GMAIL_USER, pass: env.NOTIFY_GMAIL_APP_PASSWORD },
  });
  await transporter.sendMail({
    from: env.NOTIFY_GMAIL_USER,
    to: env.NOTIFY_EMAIL_TO,
    subject: `🔎【アドホック調査】${recipe.label}：${TARGET || '指定なし'}（${today}）`,
    html,
  });
  // 数値はログに出さない（公開リポジトリのログは誰でも見られる）
  console.log(`✅ 調査メールを送信しました（${KIND}）`);
}

main().catch((err) => {
  console.error('❌ 調査に失敗しました:', err.message);
  process.exit(1);
});
