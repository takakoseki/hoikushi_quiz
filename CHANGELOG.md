# 変更履歴

## 2026-07-06

### SEO: トップページh1に「完全無料」を追加し「保育士試験 無料」キーワードを強化

- トップページの `<h1>` タグを「保育士試験 一問一答」から「保育士試験 完全無料 一問一答」に変更
- 「保育士 試験 無料」キーワード（12.9位・表示15回）の検索順位引き上げを目的とした施策
- h1タグに「無料」を自然に含めることで検索評価向上を狙う
- 対象ファイル：`flashcard/index.html`

---

### SEO: 全9科目ページのh1に「保育士試験」を追加

- 全9科目ページの `<h1>` タグを「○○ 一問一答」から「保育士試験 ○○ 一問一答」に変更
- 科目別ページのGSC検索流入が少ない問題に対応し、「保育士試験 ○○ 一問一答」キーワードでの検索評価を強化
- 対象ファイル：`hoiku-genri`, `kyoiku-genri`, `shakai-fukushi`, `kodomo-katei-fukushi`, `shakaiteki-yogo`, `hoiku-shinrigaku`, `kodomo-hoken`, `shokuji-eiyou`, `jisshu-riron`

---

### SEO: トップページのtitle・meta descriptionをCTR改善向けに更新

- `<title>` に「今すぐ」「全9科目」を追加しクリックを促す文言に変更
- `meta name="description"` にベネフィット（正答率記録・弱点克服）と具体数字を前面に
- `og:title` / `og:description` / `twitter:title` / `twitter:description` / `ld+json` も同様に更新
- 対象ファイル：`flashcard/index.html`

---

### feat: SEOレポートに直帰率・滞在時間・エンゲージメント率・PV/セッション比を追加

- `.github/scripts/seo_report.js` に4つの新しいメトリクスを追加
- `fetchGA4ByPage()` に bounceRate・averageSessionDuration・engagementRate を追加
- 流入元内訳テーブルに PV/セッション比・直帰率・平均滞在時間・エンゲージメント率の列を追加
- ページ別閲覧数テーブルに同指標の列を追加
- `fetchGSCByPage` の rowLimit を 20→25 に拡大
- GitHub Issue・HTMLメール両方の出力に反映

---

### docs: CLAUDE.mdに開発ルール追加

- SEO施策実施時の `CHANGELOG.md` 更新ルールを追加
- 毎回のマージ時にファイルを更新することを明記
- 開発チーム内での情報統一を強化

---

## 2026-06-29

### feat: 結果画面に「次に学ぶ科目はこちら」回遊導線を追加

- クイズ終了後の結果画面に他科目へのリンクセクションを追加
- 現在取り組んだ科目を除いた8科目をリンク表示
- 全9ページ（トップページを含む）に対応
- `flashcard/app.js` に回遊導線の生成ロジックを追加
- 各HTMLファイルに `#next-subjects-section` を追加
- `flashcard/style.css` にスタイルを追加

---

## 2026-06-29

### SEO: 内部リンク強化（PR #35）

**トップページ `/flashcard/index.html`**
- `subject-links-section`（`<a>` タグの科目リンク一覧）をページ上部に移動（`<button>` グリッドより前）
- アンカーテキストに「一問一答」を追加（例：「保育原理」→「保育原理 一問一答」）
- 問題数を最新値に更新（60問・59問など）

**全9科目ページ**
- 各ページ下部に「他の科目の一問一答」セクションを追加
- 自科目を除く8科目へのリンクを `<a>` タグで設置
- 対象ファイル：`hoiku-genri`, `kyoiku-genri`, `shakai-fukushi`, `kodomo-katei-fukushi`, `shakaiteki-yogo`, `hoiku-shinrigaku`, `kodomo-hoken`, `shokuji-eiyou`, `jisshu-riron`

---

### SEO: 全8科目別ページのmeta description改善（PR #32）

**変更前**
```
保育士試験の○○を4択形式で学習。○○など52問を無料で繰り返し練習できます。
```

**変更後**
```
保育士試験【○○】の頻出52問を今すぐ無料で練習。○○など出題範囲を網羅。スマホで隙間時間に対策できます。
```

- `meta name="description"`・`og:description`・`twitter:description` の3箇所を各ページで更新（計24箇所）
- 対象ファイル：`hoiku-genri`, `kyoiku-genri`, `shakai-fukushi`, `kodomo-katei-fukushi`, `hoiku-shinrigaku`, `kodomo-hoken`, `shokuji-eiyou`, `jisshu-riron`

---

## 2026-06-22

### SEO: `/flashcard/shakaiteki-yogo/` のmeta description改善（PR #31）

- `meta name="description"`・`og:description`・`twitter:description` を改善
- 「今すぐ無料で練習」「スマホで隙間時間に対策」の行動喚起ワードを追加

---

## 2026-06-16 以前

### feat: Xポスト①ツイートに科目別URLを追加

**`/.github/scripts/daily_tweet.js`**
- `SUBJECT_URLS` マッピングを追加（全9科目のURL）
- ①ツイートのfooterに科目別URLを挿入（bodyMaxを確保するためハッシュタグは最終ツイートに移動）
- `buildCtaTweet()` のテキストを「全460問無料で練習できます！」に変更、ハッシュタグを `#保育士試験2026` に更新

---

### feat: 科目ボタンクリック時にURLを遷移

**`/flashcard/app.js`**
- `SUBJECT_PAGE_URLS` マッピングを追加
- 科目ボタンクリック時に対応する科目別ページURLへ `window.location.href` で遷移

---

### SEO: トップページのキーワード強化

**`/flashcard/index.html`**
- meta description を「全9科目・460問・完全無料」に更新
- サブタイトルに「完全無料」を追加
- 科目リンクセクションに説明文を追加

---

### fix: sitemap.xml の lastmod 更新

**`/sitemap.xml`**
- 全10URLの `lastmod` を `2026-06-09` に更新

---

### docs: CLAUDE.md 作成

- プロジェクト概要・ディレクトリ構成・技術スタック・問題データ構造・開発ルール・よく使うコマンドを記載
- Stop hookによる自動ルール追記設定
