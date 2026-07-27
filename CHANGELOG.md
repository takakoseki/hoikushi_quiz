# 変更履歴

## 2026-07-27

### fix: プライバシーポリシーの記載を実態に合わせ、訴求の表示回数に上限を設定

**プライバシーポリシーからGoogle AdSenseの記載を削除（`flashcard/privacy.html`）**
- 「以下の第三者サービスを利用しており」として Google AdSense を挙げていたが、実際には未実装だった
- 利用していないサービスを利用中と記載するのは不正確なため削除
- 導入する場合はあらためて追記する

**結果画面の訴求カードに表示回数の上限を設定（`flashcard/app.js`）**
- 「もう一度」「間違えた問題を復習」で結果画面を繰り返し見る利用者に、毎回同じ広告が表示されていた
- 滞在時間6分15秒・エンゲージメント率73%という反復利用者が、このサイトの最も価値ある層であるため体験を優先
- 1セッションあたり・案件ごとに **3回まで** に制限（`sessionStorage` で管理）
- `sessionStorage` が使えない環境ではメモリ上のカウンタにフォールバックし、制限が無効化されないようにした
- ページ内に常設する訴求（保育実習理論ページ）は対象外。ページの構成要素であり繰り返し表示にはあたらないため
- `renderPromo()` は実際に描画したときのみ `true` を返すよう変更し、描画されなかった場合はカウントしない

**CDNキャッシュ対策のバージョン更新**
- `app.js` を変更したため、読み込みURLのバージョンを `20260727a` → `20260727b` に更新（全10ページ・30箇所）

## 2026-07-27

### fix: CSS・JSの更新がCDNキャッシュで反映されない問題を修正

- 実技試験セクションと訴求カードをマージしたにもかかわらず、本番でスタイルが適用されず訴求も表示されない事象が発生
- 調査の結果、GitHub Pages の CDN（Fastly）が旧版の `style.css` / `app.js` を配信し続けていたことが原因と判明
  - HTMLは新しいがCSS・JSだけ旧版という状態
  - スーパーリロードはブラウザキャッシュにしか効かず、CDNキャッシュには無効
  - クエリ付きURL（`?v=1`）でオリジンを確認し、新しい内容が配信されていることを検証して原因を特定
- 恒久対策として、HTML内のCSS・JS読み込みURLにバージョンクエリを付与（全10ページ・計30箇所）
  - `../style.css` → `../style.css?v=20260727a`
  - 対象は `style.css` / `app.js` / `questions.js`
  - 既存のクエリがある場合は付け替える実装のため、重複付与は起こらない
- 今後CSS・JSを更新する際は、このバージョン番号も変更する必要がある（CLAUDE.md ルール16）

## 2026-07-27

### feat: 収益化の土台整備とアフィリエイト訴求動線の設置

**運営者情報・連絡先の整備（`flashcard/privacy.html`）**
- 「8. お問い合わせ」に「下記までご連絡ください」と記載がありながら、連絡先が存在しなかった問題を修正
- サイト名・URL・連絡先メールアドレス（hoikushi.quiz@gmail.com）を明記
- ASPの提携審査では運営者情報と連絡先が確認されるため、審査対策としても必要
- アフィリエイト参加ASPに「もしもアフィリエイト」を追記し、PR表示の方針を明記

**実技試験セクションの追加（`flashcard/jisshu-riron/index.html`）**
- 実技試験（音楽・造形・言語の3分野から2分野を選択）の解説を追加
- 「保育士試験 実技」「実技試験 ピアノ」等のクエリの受け皿になる学習コンテンツ
- 内容方針はFAQと同じ方針Aを適用。配点・合格基準・試験時間・課題曲名は陳腐化と誤記を避けるため記載しない
- 年度により変わる旨と公式情報（全国保育士養成協議会）の確認を促す注記を追加

**アフィリエイト訴求動線（`flashcard/app.js`・`flashcard/style.css`）**
- オンライン音楽教室（もしもアフィリエイト／実技試験の音楽対策）を2箇所に設置
  - 保育実習理論ページ（実技試験セクションの直下）
  - クイズ結果画面（**保育実習理論を明示的に選択した場合のみ**。「全科目」では表示しない）
- ステマ規制対応として全箇所に「PR」表記、リンクに `rel="sponsored nofollow noopener"` を付与
- GA4に `affiliate_click` イベントを送信し、CVR分析を可能にした（計測が失敗してもリンク遷移は妨げない）
- 案件設定を `PROMOS` に集約。**URLが未設定の案件は描画されない**ため、審査中の案件は承認後にURLを追加するだけで有効化できる

## 2026-07-27

### docs: プライバシーポリシーのアフィリエイト情報を更新

- `flashcard/privacy.html` の「アフィリエイトについて」セクションを更新
- もしもアフィリエイトを明記（A8.net、もしもアフィリエイト等に変更）
- PR表示に関する方針を追記：「広告を含むリンクには『PR』と表示。掲載内容は独自選定で、広告主からの指示を受けていない」
- 対象ファイル：`flashcard/privacy.html`

---

### SEO: 全9科目ページに「よくある質問」セクション（計45問）を追加

- 各科目ページの「頻出テーマと学習ポイント」直後、「他の科目の一問一答」の直前に配置
- 科目ごとに固有の5問（質問・回答とも45件すべてユニーク）を作成し、重複コンテンツ判定を回避
- 目的は長尾クエリ（「◯◯ 勉強法」「バイスティックの7原則」「カウプ指数 計算」等）の受け皿づくり
  - なおFAQリッチリザルトは2023年8月以降、一般サイトでは表示されない。可視コンテンツによる検索面の拡張が主目的
- 内容方針：学習法・出題傾向・用語解説に限定し、出題数・配点・試験時間などの制度的数値は記載しない
  - 科目により出題構成が異なり、一律の記述では誤りとなるリスクがあるため
  - 問題数などの可変な数値も本文に含めず、将来の陳腐化を防止
- `FAQPage` 構造化データを併せて追加。可視テキストと構造化データは同一データから生成し、完全一致を機械的に検証済み
- 既存の `.faq-section` スタイル（`style.css`）と `app.js` のアコーディオン処理を流用したため、CSS・JSの変更は不要
- 対象ファイル：全9科目の `index.html`

---

### fix: Supabase の読み込み失敗でアプリ全体が停止する問題を修正

- `app.js` が冒頭で `const { createClient } = supabase;` を実行しており、CDN（cdn.jsdelivr.net）の読み込みに失敗すると `ReferenceError` で以降の処理がすべて停止していた
- 影響範囲はクイズ機能・科目プリセット・FAQ開閉を含むアプリ全機能（実ブラウザで再現確認）
- 広告ブロッカーによるCDN遮断、企業・学校ネットワークの制限、jsDelivr の一時障害で発生しうる
- Supabase は問題報告機能でのみ使用する補助的な依存のため、初期化失敗を致命的エラーとして扱わないよう変更
  - `typeof` ガードと `try/catch` で初期化し、失敗時は `db = null` として続行
  - `db` が使えない場合は「誤りを報告」ボタンを非表示にし、送信処理にもガードを追加
- 対象ファイル：`flashcard/app.js`

---

### SEO: sitemap.xml の lastmod を実際の更新日（2026-07-22）に更新

- 全10URLの `lastmod` を `2026-07-13` → `2026-07-22` に更新
- 535問→700問への問題追加（165問）が Googlebot に通知できていなかったため
- 実際にコンテンツが最終更新された日付（`2026-07-22`）を設定し、実態と一致させた
- 対象ファイル：`sitemap.xml`

### docs: 作業開始時の main 差分確認ルール（14）を追加

- 古い作業ブランチのまま作業し、問題数を700問→535問に巻き戻す誤ったPRを作成する事故が発生
- 再発防止として、着手前に `git fetch` で main との差分を確認するルールを明文化
- 対象ファイル：`CLAUDE.md`

---

## 2026-07-21

### feat: 問題データを45問追加（ID 656〜700、全700問に）

- `flashcard/questions.js` の `QUESTIONS` 配列に問題を45問追加（全655問→全700問に）
- 追加内訳（全9科目）：教育原理6・保育原理5・社会福祉5・子ども家庭福祉5・保育の心理学5・子どもの保健5・社会的養護5・子どもの食と栄養5・保育実習理論4
- 追加後の科目別累計：教育原理79・保育原理78・社会福祉78・子ども家庭福祉78・保育の心理学78・子どもの保健78・社会的養護77・子どもの食と栄養77・保育実習理論77
- 実装後に `grep -oE 'subject: "[^"]+"' flashcard/questions.js | sort | uniq -c` で実データと突き合わせ済み（ルール11）
- あわせてサイト各所の問題数表記を実データ（全700問・科目別）に統一（ルール12を踏まえ、見落としがちな箇所を網羅的に更新）
  - トップページ `flashcard/index.html`：総数`655問`→`700問`、および「科目別に学習する」の科目カード9件
  - 各科目ページ：title/description/OGP/Twitter/JSON-LD/サブタイトルの自称問題数、`window.PRESET_SUBJECT_COUNT`、相互リンクカード、本文中の埋め込み数値（社会的養護・保育の心理学）
  - 自動ツイート `.github/scripts/daily_tweet.js`：`全655問`→`全700問`
- 対象ファイル：`flashcard/questions.js`、`flashcard/index.html`、`flashcard/<全9科目>/index.html`、`.github/scripts/daily_tweet.js`

### fix: 問題数表記の見落とし箇所を修正（トップページの科目カード・PRESET_SUBJECT_COUNT）

- 過去2回の問題数一括置換で見落としていた2種類の表示箇所を実データ(73問/72問)に修正
  - `flashcard/index.html` の「科目別に学習する」セクション内、科目カード9件（`535問`/`610問`等の文字列置換では拾えていなかった）
  - 各科目ページのインラインスクリプト `window.PRESET_SUBJECT_COUNT`（`app.js`がページ読込時にこの値でサブタイトル表示を上書きするため、HTML本文を直しても画面上は古い値に戻っていた）
  - `shakaiteki-yogo`・`hoiku-shinrigaku` の本文中に埋め込まれていた別パターンの古い問題数（59問）
- 対象ファイル：`flashcard/index.html`、`flashcard/<全9科目>/index.html`

### feat: 問題データを45問追加（ID 611〜655、全655問に）

- `flashcard/questions.js` の `QUESTIONS` 配列に問題を45問追加（全610問→全655問に）
- 追加内訳（全9科目）：保育原理6・教育原理6・社会的養護5・子どもの食と栄養5・子ども家庭福祉5・子どもの保健5・社会福祉5・保育の心理学4・保育実習理論4
- 追加後の科目別累計：保育原理73・教育原理73・社会福祉73・子ども家庭福祉73・保育の心理学73・子どもの保健73・保育実習理論73・社会的養護72・子どもの食と栄養72
- 実装後に `grep -oE 'subject: "[^"]+"' flashcard/questions.js | sort | uniq -c` で実データと突き合わせ済み（ルール11）
- あわせてサイト各所の問題数表記を実データ（全655問・科目別）に統一
  - トップページ `flashcard/index.html`：`610問`→`655問`
  - 各科目ページの自称問題数・相互リンクカードを実データに更新
  - 自動ツイート `.github/scripts/daily_tweet.js`：`全610問`→`全655問`
- 対象ファイル：`flashcard/questions.js`、`flashcard/index.html`、`flashcard/<全9科目>/index.html`、`.github/scripts/daily_tweet.js`

### docs: 問題追加時のカウント突き合わせルール（ルール11）を CLAUDE.md に追加

- 問題を追加したバッチごとに進捗表を作成する際は、実装後に `grep -oE 'subject: "[^"]+"' flashcard/questions.js | sort | uniq -c` で実データと突き合わせ、カウント誤りを検出することを規定
- 進捗表の累計ズレによる以降の影響を防ぐため、開発ルール11として明記
- 対象ファイル：`CLAUDE.md`

### feat: 問題データを75問追加（ID 536〜610）

- `flashcard/questions.js` の `QUESTIONS` 配列に問題を75問追加（全610問に）
- 追加内訳（全9科目）：保育の心理学10・保育実習理論10・社会福祉9・社会的養護8・子どもの食と栄養8・子ども家庭福祉8・子どもの保健8・保育原理7・教育原理7
- 問題数増加によるコンテンツ充実・検索流入強化を目的
- 対象ファイル：`flashcard/questions.js`

### fix: 問題数の表記を実データ（全610問／科目別）に統一

- 問題数追加に伴い、サイト各所にハードコードされていた問題数を実データに更新
- トップページ `flashcard/index.html`：`535問`→`610問`（title・description・OGP・Twitter・JSON-LD・サブタイトル・FAQ）
- 各科目ページの自称問題数を実データに更新（保育原理67・教育原理67・社会福祉68・子ども家庭福祉68・社会的養護67・保育の心理学69・子どもの保健68・子どもの食と栄養67・保育実習理論69）
- 各科目ページ下部の相互リンクカードの問題数も実データに統一
- 自動ツイート `.github/scripts/daily_tweet.js`：`全460問`→`全610問`
- 対象ファイル：`flashcard/index.html`、`flashcard/<全9科目>/index.html`、`.github/scripts/daily_tweet.js`

---

## 2026-07-13

### feat: daily_tweet.jsに科目別学習ポイントツイート機能を追加

- 新規関数 `buildTipTweet(q)` を実装し、科目別の学習ポイントをツイート
- `SUBJECT_TIPS` オブジェクトに各科目の重要ポイント（9科目分）を定義
- 毎日の自動ツイート機能の多様化により、ユーザーエンゲージメント向上を目的
- 対象ファイル：`.github/scripts/daily_tweet.js`

---

## 2026-07-13

### feat: 全9科目ページに「頻出テーマと学習ポイント」セクションを追加

- 各科目ページのsubject-intro直下に3テーマ×（タイトル・解説・キーワードタグ）のカードセクションを追加
- 科目別の検索流入強化とページコンテンツ充実を目的とした新機能
- 全9科目のHTMLファイルにカード要素を実装（各ファイル25行追加）
- style.cssに新規スタイルルール（57行追加）を追加
- 対象ファイル：
  - `flashcard/hoiku-genri/index.html`
  - `flashcard/kyoiku-genri/index.html`
  - `flashcard/shakai-fukushi/index.html`
  - `flashcard/kodomo-katei-fukushi/index.html`
  - `flashcard/shakaiteki-yogo/index.html`
  - `flashcard/hoiku-shinrigaku/index.html`
  - `flashcard/kodomo-hoken/index.html`
  - `flashcard/shokuji-eiyou/index.html`
  - `flashcard/jisshu-riron/index.html`
  - `flashcard/style.css`

---

### SEO: 「保育士試験 無料」と「保育の心理学 一問一答」のキーワード強化

- 保育の心理学ページの説明文（subject-intro）を充実
  - 文に「保育士試験【保育の心理学】」「一問一答」「無料」「59問」を追加（SEO強化）
  - キーワード・検索意図をより明確に反映した説明に更新
- トピックリストを6項目から7項目に拡充
  - 既存項目にキーワードを追加（エリクソン→ヴィゴツキー・コールバーグ・パーテンなど）
  - 新規項目「保育における観察・記録・省察」を追加
- トップページのh2「保育士試験を無料で対策する」追加は取り消し（その後revert済み）
- 対象ファイル：`flashcard/hoiku-shinrigaku/index.html`、`flashcard/index.html`（revert）

---

## 2026-07-06

### fix: sitemap.xmlのlastmodを2026-07-06に更新

- 全10URLの `lastmod` を `2026-07-06` に更新
- 今週のSEO施策（h1更新・title/description改善）をGooglebotに通知

---

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
