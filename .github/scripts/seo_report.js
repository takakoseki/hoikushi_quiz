'use strict';

const { google } = require('googleapis');
const https = require('https');

const CLIENT_ID       = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET   = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN   = process.env.GOOGLE_REFRESH_TOKEN;
const GSC_SITE_URL    = process.env.GSC_SITE_URL;
const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID;
const GITHUB_TOKEN    = process.env.GITHUB_TOKEN;
const [REPO_OWNER, REPO_NAME] = (process.env.GITHUB_REPOSITORY || '/').split('/');

function dateStr(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

async function fetchGSC(auth, startDate, endDate) {
  const webmasters = google.webmasters({ version: 'v3', auth });
  try {
    const res = await webmasters.searchanalytics.query({
      siteUrl: GSC_SITE_URL,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['query'],
        rowLimit: 50,
      },
    });
    return res.data.rows || [];
  } catch (e) {
    console.error('GSC error:', e.message);
    return [];
  }
}

async function fetchGA4(auth, startDate, endDate) {
  const analyticsdata = google.analyticsdata({ version: 'v1beta', auth });
  try {
    const res = await analyticsdata.properties.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        metrics: [
          { name: 'sessions' },
          { name: 'screenPageViews' },
        ],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      },
    });
    const channelMap = {
      'Organic Search': '検索',
      'Organic Social': 'SNS',
      'Direct': 'ダイレクト',
      'Referral': '参照',
      'Unassigned': 'その他',
    };
    const rows = (res.data.rows || []).map(r => ({
      channel: channelMap[r.dimensionValues[0].value] || r.dimensionValues[0].value,
      sessions: parseInt(r.metricValues[0].value),
      pageviews: parseInt(r.metricValues[1].value),
    })).sort((a, b) => b.sessions - a.sessions);
    return rows;
  } catch (e) {
    console.error('GA4 error:', e.message);
    return [];
  }
}

function createIssue(title, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ title, body });
    const req = https.request({
      hostname: 'api.github.com',
      path: `/repos/${REPO_OWNER}/${REPO_NAME}/issues`,
      method: 'POST',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'hoikushi-quiz-seo-bot',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode === 201) resolve();
        else reject(new Error(`GitHub API ${res.statusCode}: ${body}`));
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
  auth.setCredentials({ refresh_token: REFRESH_TOKEN });

  const endDate   = dateStr(1);
  const startDate = dateStr(7);
  const today = new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });

  const [gscRows, ga4Rows] = await Promise.all([
    fetchGSC(auth, startDate, endDate),
    fetchGA4(auth, startDate, endDate),
  ]);

  // GSC集計
  const totalImpressions = gscRows.reduce((s, r) => s + r.impressions, 0);
  const totalClicks      = gscRows.reduce((s, r) => s + r.clicks, 0);
  const avgCtr = totalImpressions > 0
    ? (totalClicks / totalImpressions * 100).toFixed(1) : '0.0';
  const avgPosition = gscRows.length > 0
    ? (gscRows.reduce((s, r) => s + r.position, 0) / gscRows.length).toFixed(1) : '-';

  // GA4集計
  const totalSessions  = ga4Rows.reduce((s, r) => s + r.sessions, 0);
  const totalPageviews = ga4Rows.reduce((s, r) => s + r.pageviews, 0);

  // 分析：CTR低いクエリ（10回以上・CTR3%未満）
  const lowCtr = gscRows
    .filter(r => r.impressions >= 10 && r.ctr < 0.03)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 5);

  // 分析：チャンスクエリ（順位5～20位）
  const opportunity = gscRows
    .filter(r => r.position >= 5 && r.position <= 20)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 5);

  // 分析：好調クエリ（クリック数上位）
  const topQueries = [...gscRows]
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 5);

  // Issue本文
  const lines = [
    `## 📊 週次SEOレポート（${today}）`,
    `集計期間：${startDate} 〜 ${endDate}`,
    '',
    '## 🔢 今週のサマリー',
    '',
    '### 検索流入（GSC）',
    '| 表示回数 | クリック数 | 平均CTR | 平均順位 |',
    '|---------|-----------|--------|---------|',
    `| ${totalImpressions} | ${totalClicks} | ${avgCtr}% | ${avgPosition}位 |`,
    '',
    '### アクセス（GA4）',
    '| セッション | ページビュー |',
    '|-----------|------------|',
    `| ${totalSessions} | ${totalPageviews} |`,
    '',
  ];

  if (ga4Rows.length > 0) {
    lines.push('### 流入元内訳');
    lines.push('| チャネル | セッション |');
    lines.push('|---------|-----------|');
    ga4Rows.forEach(r => lines.push(`| ${r.channel} | ${r.sessions} |`));
    lines.push('');
  }

  if (lowCtr.length > 0) {
    lines.push('---', '');
    lines.push('## 🔴 要対応：表示されているがクリックされていないクエリ');
    lines.push('title・descriptionを改善してCTRを上げましょう。', '');
    lines.push('| クエリ | 表示回数 | クリック | CTR | 順位 |');
    lines.push('|-------|---------|--------|-----|-----|');
    lowCtr.forEach(r => lines.push(
      `| ${r.keys[0]} | ${r.impressions} | ${r.clicks} | ${(r.ctr*100).toFixed(1)}% | ${r.position.toFixed(1)}位 |`
    ));
    lines.push('');
  }

  if (opportunity.length > 0) {
    lines.push('---', '');
    lines.push('## 🟡 チャンス：順位5～20位のクエリ');
    lines.push('Xでの発信強化や問題の充実で上位表示が狙えます。', '');
    lines.push('| クエリ | 順位 | 表示回数 | クリック |');
    lines.push('|-------|-----|---------|--------|');
    opportunity.forEach(r => lines.push(
      `| ${r.keys[0]} | ${r.position.toFixed(1)}位 | ${r.impressions} | ${r.clicks} |`
    ));
    lines.push('');
  }

  if (topQueries.length > 0) {
    lines.push('---', '');
    lines.push('## 🟢 好調：クリック数トップクエリ', '');
    lines.push('| クエリ | クリック | 表示回数 | CTR | 順位 |');
    lines.push('|-------|--------|---------|-----|-----|');
    topQueries.forEach(r => lines.push(
      `| ${r.keys[0]} | ${r.clicks} | ${r.impressions} | ${(r.ctr*100).toFixed(1)}% | ${r.position.toFixed(1)}位 |`
    ));
    lines.push('');
  }

  lines.push('---', '');
  lines.push('## ✅ 今週の対応チェックリスト');
  lines.push('- [ ] 🔴 CTRが低いクエリのtitle/descriptionを見直す');
  lines.push('- [ ] 🟡 チャンスクエリをXで重点的に発信する');
  lines.push('- [ ] 流入元を確認し、弱いチャネルへの施策を検討する');

  await createIssue(`[SEOレポート] ${today}`, lines.join('\n'));
  console.log('✅ SEOレポートIssue作成完了');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
