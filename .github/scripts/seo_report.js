'use strict';

const { google } = require('googleapis');
const https = require('https');
const nodemailer = require('nodemailer');

const CLIENT_ID       = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET   = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN   = process.env.GOOGLE_REFRESH_TOKEN;
const GSC_SITE_URL    = process.env.GSC_SITE_URL;
const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID;
const GITHUB_TOKEN    = process.env.GITHUB_TOKEN;
const [REPO_OWNER, REPO_NAME] = (process.env.GITHUB_REPOSITORY || '/').split('/');

// ---- 目標値 ----
const TARGETS = {
  short: {
    label: '短期目標',
    deadline: '2026年7月31日',
    impressions: 100,
    clicks: 10,
    position: 5.0,
    sessions: 50,
  },
  mid: {
    label: '中期目標',
    deadline: '2026年9月30日',
    impressions: 500,
    clicks: 50,
    organicSessions: 30,
  },
};

function dateStr(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

function diffLabel(current, prev) {
  if (prev === 0 && current === 0) return '–';
  if (prev === 0) return `▲${current}`;
  const diff = current - prev;
  const pct = Math.round(diff / prev * 100);
  if (diff > 0) return `▲${diff} (+${pct}%)`;
  if (diff < 0) return `▼${Math.abs(diff)} (${pct}%)`;
  return `→0 (0%)`;
}

function shortUrl(url) {
  return url.replace(/^https?:\/\/[^/]+/, '') || '/';
}

function goalStatus(current, target, lowerIsBetter = false) {
  if (!target) return { pct: '–', icon: '–' };
  const ratio = lowerIsBetter
    ? (current > 0 ? target / current : 0)
    : (target > 0 ? current / target : 0);
  const achieved = lowerIsBetter ? current <= target : current >= target;
  const pct = achieved ? '✅ 達成' : `${Math.min(Math.round(ratio * 100), 99)}%`;
  const icon = achieved ? '🟢' : ratio >= 0.5 ? '🟡' : '🔴';
  return { pct, icon };
}

async function fetchGSCTotals(auth, startDate, endDate) {
  const webmasters = google.webmasters({ version: 'v3', auth });
  try {
    const res = await webmasters.searchanalytics.query({
      siteUrl: GSC_SITE_URL,
      requestBody: {
        startDate,
        endDate,
        // dimensionsなし = プライバシーフィルタを受けない正確な合計値
      },
    });
    const row = (res.data.rows || [])[0];
    return row
      ? { impressions: row.impressions, clicks: row.clicks, ctr: row.ctr, position: row.position }
      : { impressions: 0, clicks: 0, ctr: 0, position: 0 };
  } catch (e) {
    console.error('GSC totals error:', e.message);
    return { impressions: 0, clicks: 0, ctr: 0, position: 0 };
  }
}

async function fetchGSCByQuery(auth, startDate, endDate) {
  const webmasters = google.webmasters({ version: 'v3', auth });
  try {
    const res = await webmasters.searchanalytics.query({
      siteUrl: GSC_SITE_URL,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['query'],
        rowLimit: 100,
      },
    });
    return res.data.rows || [];
  } catch (e) {
    console.error('GSC query error:', e.message);
    return [];
  }
}

async function fetchGSCByPage(auth, startDate, endDate) {
  const webmasters = google.webmasters({ version: 'v3', auth });
  try {
    const res = await webmasters.searchanalytics.query({
      siteUrl: GSC_SITE_URL,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['page'],
        rowLimit: 20,
      },
    });
    return res.data.rows || [];
  } catch (e) {
    console.error('GSC page error:', e.message);
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

async function fetchGA4ByPage(auth, startDate, endDate) {
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
        dimensions: [{ name: 'pagePath' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      },
    });
    return (res.data.rows || []).map(r => ({
      path: r.dimensionValues[0].value,
      sessions: parseInt(r.metricValues[0].value),
      pageviews: parseInt(r.metricValues[1].value),
    }));
  } catch (e) {
    console.error('GA4 page error:', e.message);
    return [];
  }
}

async function fetchGA4ByDevice(auth, startDate, endDate) {
  const analyticsdata = google.analyticsdata({ version: 'v1beta', auth });
  try {
    const res = await analyticsdata.properties.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        metrics: [{ name: 'sessions' }],
        dimensions: [{ name: 'deviceCategory' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      },
    });
    const deviceMap = { mobile: 'スマホ', desktop: 'PC', tablet: 'タブレット' };
    return (res.data.rows || []).map(r => ({
      device: deviceMap[r.dimensionValues[0].value] || r.dimensionValues[0].value,
      sessions: parseInt(r.metricValues[0].value),
    }));
  } catch (e) {
    console.error('GA4 device error:', e.message);
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

async function sendEmail(reportData, issueBody) {
  const { today, curr, prev, ga4Rows, ga4PageRows, ga4DeviceRows, topPages, lowCtr, opportunity, goals, organicSessions } = reportData;

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.NOTIFY_GMAIL_USER,
      pass: process.env.NOTIFY_GMAIL_APP_PASSWORD,
    },
  });

  const td = (v) => `<td style="padding:4px 8px;text-align:right;">${v}</td>`;
  const th = (v) => `<th style="padding:4px 8px;">${v}</th>`;
  const tdl = (v) => `<td style="padding:4px 8px;">${v}</td>`;

  const summaryHtml = `
    <tr>${tdl('表示回数（GSC）')}${td(curr.impressions)}${td(prev.impressions)}${td(diffLabel(curr.impressions, prev.impressions))}</tr>
    <tr>${tdl('クリック数（GSC）')}${td(curr.clicks)}${td(prev.clicks)}${td(diffLabel(curr.clicks, prev.clicks))}</tr>
    <tr>${tdl('平均CTR')}${td(curr.ctr + '%')}${td(prev.ctr + '%')}${td('–')}</tr>
    <tr>${tdl('平均順位')}${td(curr.position + '位')}${td(prev.position + '位')}${td('–')}</tr>
    <tr style="background:#f0f8ff;">${tdl('セッション（GA4）')}${td(curr.sessions)}${td(prev.sessions)}${td(diffLabel(curr.sessions, prev.sessions))}</tr>
    <tr style="background:#f0f8ff;">${tdl('ページビュー（GA4）')}${td(curr.pageviews)}${td(prev.pageviews)}${td(diffLabel(curr.pageviews, prev.pageviews))}</tr>`;

  const channelHtml = ga4Rows.length > 0
    ? ga4Rows.map(r => `<tr>${tdl(r.channel)}${td(r.sessions)}</tr>`).join('')
    : `<tr><td colspan="2" style="padding:4px 8px;">データなし</td></tr>`;

  const deviceHtml = ga4DeviceRows.length > 0
    ? ga4DeviceRows.map(r => `<tr>${tdl(r.device)}${td(r.sessions)}</tr>`).join('')
    : `<tr><td colspan="2" style="padding:4px 8px;">データなし</td></tr>`;

  const ga4PageHtml = ga4PageRows.length > 0
    ? ga4PageRows.map(r => `<tr>${tdl(r.path)}${td(r.sessions)}${td(r.pageviews)}</tr>`).join('')
    : `<tr><td colspan="3" style="padding:4px 8px;">データなし</td></tr>`;

  const pageHtml = topPages.length > 0
    ? topPages.map(r => `<tr>${tdl(shortUrl(r.keys[0]))}${td(r.clicks)}${td(r.impressions)}${td((r.ctr*100).toFixed(1)+'%')}${td(r.position.toFixed(1)+'位')}</tr>`).join('')
    : `<tr><td colspan="5" style="padding:4px 8px;">データなし</td></tr>`;

  const lowCtrHtml = lowCtr.map(r =>
    `<tr>${tdl(r.keys[0])}${td(r.impressions)}${td((r.ctr*100).toFixed(1)+'%')}${td(r.position.toFixed(1)+'位')}</tr>`
  ).join('');

  const opportunityHtml = opportunity.map(r =>
    `<tr>${tdl(r.keys[0])}${td(r.position.toFixed(1)+'位')}${td(r.impressions)}</tr>`
  ).join('');

  const html = `
<h2>📊 週次SEOレポート（${today}）</h2>

<h3>📈 今週 vs 先週</h3>
<table border="1" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
  <tr style="background:#f0f0f0;">${th('指標')}${th('今週')}${th('先週')}${th('前週比')}</tr>
  ${summaryHtml}
</table>

<h3>📱 流入元内訳（GA4）</h3>
<table border="1" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
  <tr style="background:#f0f0f0;">${th('チャネル')}${th('セッション')}</tr>
  ${channelHtml}
</table>

<h3>💻 デバイス別内訳（GA4）</h3>
<table border="1" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
  <tr style="background:#f0f0f0;">${th('デバイス')}${th('セッション')}</tr>
  ${deviceHtml}
</table>

<h3>📄 ページ別閲覧数（GA4）</h3>
<table border="1" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
  <tr style="background:#f0f0f0;">${th('ページ')}${th('セッション')}${th('PV')}</tr>
  ${ga4PageHtml}
</table>

<h3>📄 ページ別パフォーマンス（GSC）</h3>
<table border="1" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
  <tr style="background:#f0f0f0;">${th('ページ')}${th('クリック')}${th('表示')}${th('CTR')}${th('順位')}</tr>
  ${pageHtml}
</table>

${lowCtr.length > 0 ? `
<h3>🔴 要対応：CTRが低いクエリ</h3>
<table border="1" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
  <tr style="background:#fdd;">${th('クエリ')}${th('表示')}${th('CTR')}${th('順位')}</tr>
  ${lowCtrHtml}
</table>` : ''}

${opportunity.length > 0 ? `
<h3>🟡 チャンス：順位5〜20位のクエリ</h3>
<table border="1" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
  <tr style="background:#ffe;">${th('クエリ')}${th('順位')}${th('表示')}</tr>
  ${opportunityHtml}
</table>` : ''}

<h3>🎯 目標達成状況</h3>
<p style="font-size:13px;font-weight:bold;">${TARGETS.short.label}（${TARGETS.short.deadline}まで）</p>
<table border="1" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
  <tr style="background:#f0f0f0;">${th('指標')}${th('現在')}${th('目標')}${th('達成率')}</tr>
  <tr>${tdl('週間表示回数')}${td(curr.impressions)}${td(TARGETS.short.impressions)}${td(`${goals.short.impressions.icon} ${goals.short.impressions.pct}`)}</tr>
  <tr>${tdl('週間クリック数')}${td(curr.clicks)}${td(TARGETS.short.clicks)}${td(`${goals.short.clicks.icon} ${goals.short.clicks.pct}`)}</tr>
  <tr>${tdl('平均順位')}${td(curr.position + '位')}${td(TARGETS.short.position + '位以内')}${td(`${goals.short.position.icon} ${goals.short.position.pct}`)}</tr>
  <tr>${tdl('セッション（週）')}${td(curr.sessions)}${td(TARGETS.short.sessions)}${td(`${goals.short.sessions.icon} ${goals.short.sessions.pct}`)}</tr>
</table>
<p style="font-size:13px;font-weight:bold;margin-top:12px;">${TARGETS.mid.label}（${TARGETS.mid.deadline}まで）</p>
<table border="1" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
  <tr style="background:#f0f0f0;">${th('指標')}${th('現在')}${th('目標')}${th('達成率')}</tr>
  <tr>${tdl('週間表示回数')}${td(curr.impressions)}${td(TARGETS.mid.impressions)}${td(`${goals.mid.impressions.icon} ${goals.mid.impressions.pct}`)}</tr>
  <tr>${tdl('週間クリック数')}${td(curr.clicks)}${td(TARGETS.mid.clicks)}${td(`${goals.mid.clicks.icon} ${goals.mid.clicks.pct}`)}</tr>
  <tr>${tdl('オーガニックセッション（週）')}${td(organicSessions)}${td(TARGETS.mid.organicSessions)}${td(`${goals.mid.organicSessions.icon} ${goals.mid.organicSessions.pct}`)}</tr>
</table>

<hr>
<p style="font-size:12px;color:#666;">詳細はGitHub Issueを確認してください。</p>
`;

  await transporter.sendMail({
    from: process.env.NOTIFY_GMAIL_USER,
    to: process.env.NOTIFY_EMAIL_TO,
    subject: `📊【週次SEOレポート】${today}`,
    html,
    text: issueBody,
  });
}

async function main() {
  const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
  auth.setCredentials({ refresh_token: REFRESH_TOKEN });

  // 今週: 1〜7日前、先週: 8〜14日前
  const endDate       = dateStr(1);
  const startDate     = dateStr(7);
  const prevEndDate   = dateStr(8);
  const prevStartDate = dateStr(14);
  const today = new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });

  const [
    gscTotals, prevGscTotals,
    gscRows, ga4Rows, prevGscRows, prevGa4Rows, gscPageRows, ga4PageRows, ga4DeviceRows,
  ] = await Promise.all([
    fetchGSCTotals(auth, startDate, endDate),
    fetchGSCTotals(auth, prevStartDate, prevEndDate),
    fetchGSCByQuery(auth, startDate, endDate),
    fetchGA4(auth, startDate, endDate),
    fetchGSCByQuery(auth, prevStartDate, prevEndDate),
    fetchGA4(auth, prevStartDate, prevEndDate),
    fetchGSCByPage(auth, startDate, endDate),
    fetchGA4ByPage(auth, startDate, endDate),
    fetchGA4ByDevice(auth, startDate, endDate),
  ]);

  // 今週 GSC 集計（合計値はdimensionsなしの正確な値を使用）
  const totalImpressions = gscTotals.impressions;
  const totalClicks      = gscTotals.clicks;
  const avgCtr = totalImpressions > 0
    ? (totalClicks / totalImpressions * 100).toFixed(1) : '0.0';
  const avgPosition = gscTotals.position > 0 ? gscTotals.position.toFixed(1) : '-';

  // 先週 GSC 集計
  const prevImpressions = prevGscTotals.impressions;
  const prevClicks      = prevGscTotals.clicks;
  const prevCtr = prevImpressions > 0
    ? (prevClicks / prevImpressions * 100).toFixed(1) : '0.0';
  const prevPosition = prevGscTotals.position > 0 ? prevGscTotals.position.toFixed(1) : '-';

  // 今週・先週 GA4 集計
  const totalSessions  = ga4Rows.reduce((s, r) => s + r.sessions, 0);
  const totalPageviews = ga4Rows.reduce((s, r) => s + r.pageviews, 0);
  const prevSessions   = prevGa4Rows.reduce((s, r) => s + r.sessions, 0);
  const prevPageviews  = prevGa4Rows.reduce((s, r) => s + r.pageviews, 0);

  const curr = { impressions: totalImpressions, clicks: totalClicks, ctr: avgCtr, position: avgPosition, sessions: totalSessions, pageviews: totalPageviews };
  const prev = { impressions: prevImpressions, clicks: prevClicks, ctr: prevCtr, position: prevPosition, sessions: prevSessions, pageviews: prevPageviews };

  // ページ別上位（クリック数順）
  const topPages = [...gscPageRows]
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);

  // 分析：CTR低いクエリ（10回以上・CTR3%未満）
  const lowCtr = gscRows
    .filter(r => r.impressions >= 10 && r.ctr < 0.03)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 5);

  // 分析：チャンスクエリ（順位5～20位）
  const opportunity = gscRows
    .filter(r => r.position >= 5 && r.position <= 20)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);

  // 分析：好調クエリ（クリック数上位）
  const topQueries = [...gscRows]
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 5);

  // 目標達成状況
  const organicSessions = ga4Rows.find(r => r.channel === '検索')?.sessions || 0;
  const posNum = parseFloat(curr.position) || 0;
  const goals = {
    short: {
      impressions: goalStatus(curr.impressions, TARGETS.short.impressions),
      clicks:      goalStatus(curr.clicks,      TARGETS.short.clicks),
      position:    goalStatus(posNum,            TARGETS.short.position, true),
      sessions:    goalStatus(curr.sessions,     TARGETS.short.sessions),
    },
    mid: {
      impressions:     goalStatus(curr.impressions, TARGETS.mid.impressions),
      clicks:          goalStatus(curr.clicks,      TARGETS.mid.clicks),
      organicSessions: goalStatus(organicSessions,  TARGETS.mid.organicSessions),
    },
  };

  // Issue 本文
  const lines = [
    `## 📊 週次SEOレポート（${today}）`,
    `集計期間：${startDate} 〜 ${endDate}`,
    '',
    '## 📈 今週 vs 先週',
    '',
    '| 指標 | 今週 | 先週 | 前週比 |',
    '|------|------|------|--------|',
    `| 表示回数（GSC） | ${curr.impressions} | ${prev.impressions} | ${diffLabel(curr.impressions, prev.impressions)} |`,
    `| クリック数（GSC） | ${curr.clicks} | ${prev.clicks} | ${diffLabel(curr.clicks, prev.clicks)} |`,
    `| 平均CTR | ${curr.ctr}% | ${prev.ctr}% | – |`,
    `| 平均順位 | ${curr.position}位 | ${prev.position}位 | – |`,
    `| セッション（GA4） | ${curr.sessions} | ${prev.sessions} | ${diffLabel(curr.sessions, prev.sessions)} |`,
    `| ページビュー（GA4） | ${curr.pageviews} | ${prev.pageviews} | ${diffLabel(curr.pageviews, prev.pageviews)} |`,
    '',
  ];

  lines.push('### 📱 流入元内訳（GA4）');
  lines.push('| チャネル | セッション |');
  lines.push('|---------|-----------|');
  if (ga4Rows.length > 0) {
    ga4Rows.forEach(r => lines.push(`| ${r.channel} | ${r.sessions} |`));
  } else {
    lines.push('| データなし | – |');
  }
  lines.push('');

  if (ga4DeviceRows.length > 0) {
    lines.push('### 📱 デバイス別内訳（GA4）');
    lines.push('| デバイス | セッション |');
    lines.push('|---------|-----------|');
    ga4DeviceRows.forEach(r => lines.push(`| ${r.device} | ${r.sessions} |`));
    lines.push('');
  }

  if (ga4PageRows.length > 0) {
    lines.push('### 📄 ページ別閲覧数（GA4）');
    lines.push('| ページ | セッション | PV |');
    lines.push('|-------|-----------|-----|');
    ga4PageRows.forEach(r => lines.push(`| ${r.path} | ${r.sessions} | ${r.pageviews} |`));
    lines.push('');
  }

  if (topPages.length > 0) {
    lines.push('---', '');
    lines.push('## 📄 ページ別パフォーマンス（GSC）', '');
    lines.push('| ページ | クリック | 表示回数 | CTR | 順位 |');
    lines.push('|-------|--------|---------|-----|-----|');
    topPages.forEach(r => lines.push(
      `| ${shortUrl(r.keys[0])} | ${r.clicks} | ${r.impressions} | ${(r.ctr*100).toFixed(1)}% | ${r.position.toFixed(1)}位 |`
    ));
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
  lines.push('## 🎯 目標達成状況', '');
  lines.push(`### ${TARGETS.short.label}（${TARGETS.short.deadline}まで）`, '');
  lines.push('| 指標 | 現在 | 目標 | 達成率 |');
  lines.push('|------|------|------|--------|');
  lines.push(`| 週間表示回数 | ${curr.impressions} | ${TARGETS.short.impressions} | ${goals.short.impressions.icon} ${goals.short.impressions.pct} |`);
  lines.push(`| 週間クリック数 | ${curr.clicks} | ${TARGETS.short.clicks} | ${goals.short.clicks.icon} ${goals.short.clicks.pct} |`);
  lines.push(`| 平均順位 | ${curr.position}位 | ${TARGETS.short.position}位以内 | ${goals.short.position.icon} ${goals.short.position.pct} |`);
  lines.push(`| セッション（週） | ${curr.sessions} | ${TARGETS.short.sessions} | ${goals.short.sessions.icon} ${goals.short.sessions.pct} |`);
  lines.push('');
  lines.push(`### ${TARGETS.mid.label}（${TARGETS.mid.deadline}まで）`, '');
  lines.push('| 指標 | 現在 | 目標 | 達成率 |');
  lines.push('|------|------|------|--------|');
  lines.push(`| 週間表示回数 | ${curr.impressions} | ${TARGETS.mid.impressions} | ${goals.mid.impressions.icon} ${goals.mid.impressions.pct} |`);
  lines.push(`| 週間クリック数 | ${curr.clicks} | ${TARGETS.mid.clicks} | ${goals.mid.clicks.icon} ${goals.mid.clicks.pct} |`);
  lines.push(`| オーガニックセッション（週） | ${organicSessions} | ${TARGETS.mid.organicSessions} | ${goals.mid.organicSessions.icon} ${goals.mid.organicSessions.pct} |`);
  lines.push('');

  lines.push('---', '');
  lines.push('## ✅ 今週の対応チェックリスト');
  lines.push('- [ ] 🔴 CTRが低いクエリのtitle/descriptionを見直す');
  lines.push('- [ ] 🟡 チャンスクエリをXで重点的に発信する');
  lines.push('- [ ] 流入元を確認し、弱いチャネルへの施策を検討する');
  lines.push('- [ ] 📄 ページ別パフォーマンスで科目ページの効果を確認する');

  const issueBody = lines.join('\n');
  await createIssue(`[SEOレポート] ${today}`, issueBody);
  console.log('✅ SEOレポートIssue作成完了');

  await sendEmail({ today, curr, prev, ga4Rows, ga4PageRows, ga4DeviceRows, topPages, lowCtr, opportunity, goals, organicSessions }, issueBody);
  console.log('✅ SEOレポートメール送信完了');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
