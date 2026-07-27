# hoikushi_quiz プロジェクト

## 概要

保育士試験対策フラッシュカードWebアプリ。
静的HTMLサイトとして動作し、GitHub Pages でホスティングされている。
本番URL: https://hoikushi-quiz.com/flashcard/

## ディレクトリ構成

```
/
├── index.html          # リダイレクト（/flashcard/ へ転送）
├── script.js           # トップページ用スクリプト
├── style.css           # トップページ用スタイル
└── flashcard/
    ├── index.html      # アプリ本体HTML
    ├── app.js          # アプリロジック（クイズ・ストリーク・Supabase連携）
    ├── questions.js    # 問題データ（QUESTIONS 配列）
    ├── style.css       # アプリ用スタイル
    ├── privacy.html    # プライバシーポリシー
    ├── favicon.svg
    ├── ogp.png
    ├── hoiku-genri/        # 保育原理 科目別ページ
    ├── hoiku-shinrigaku/   # 保育心理学
    ├── jisshu-riron/       # 実習理論
    ├── kodomo-hoken/       # 子どもの保健
    ├── kodomo-katei-fukushi/ # 子ども家庭福祉
    ├── kyoiku-genri/       # 教育原理
    ├── shakai-fukushi/     # 社会福祉
    ├── shakaiteki-yogo/    # 社会的養護
    └── shokuji-eiyou/      # 食事・栄養
```

## 技術スタック

- **フロントエンド**: 素のHTML / CSS / JavaScript（フレームワークなし）
- **データ**: `questions.js` に問題データを直接定義（`QUESTIONS` 配列）
- **バックエンド**: Supabase（匿名クライアント、ランキング等の集計用）
- **ホスティング**: GitHub Pages
- **テスト**: なし

## 問題データの構造

`flashcard/questions.js` の `QUESTIONS` 配列に問題を追加する。

```js
{
  id: <number>,          // 一意のID（末尾の最大値+1）
  subject: "<科目名>",   // 例: "保育原理"
  question: "<問題文>",
  choices: ["選択肢A", "選択肢B", "選択肢C", "選択肢D"],
  answer: <number>,      // 正解のインデックス（0始まり）
  explanation: "<解説文>"
}
```

## 開発ルール

1. 変更前に何を変更するか説明してから実施すること
2. `questions.js` は巨大ファイル（500KB超）のため、編集時は対象箇所を絞って操作すること
3. Supabase の接続情報（URL・anon key）はパブリックキーなので公開リポジトリへのコミットは許容されている
4. デプロイはmainブランチへのpushで GitHub Pages が自動更新される
5. 科目別ディレクトリ（例: `hoiku-genri/`）内の `index.html` は科目フィルタ付きのエントリーポイント
6. 問題データの科目カバー状況を提案する際は、`grep` で必ず最新のカバー状況を確認してから提案すること。全9科目は常にカバーされている
7. mainブランチで直接作業した場合は、ユーザーに「マージ完了」「追加の作業は不要」と明確に伝え、実施状況をできるだけ簡潔に報告すること
8. SEO施策の実施内容は `CHANGELOG.md` に時系列で記録し、毎回マージの際にもファイルを更新すること
9. 複数ファイルへの大きな変更や構成変更を実装する場合は、説明だけでなく実際の位置をスクリーンショットやHTML構造図で視覚的に示してから実施すること
10. UIやコンテンツの構成変更を提案する際は、実装前に必ずビジュアル（イメージ図やスクリーンショット）を先に共有して、ユーザーの承認を得てから実装すること
11. 問題を追加したバッチごとに進捗表を作成する際は、実装後に必ず `grep -oE 'subject: "[^"]+"' flashcard/questions.js | sort | uniq -c` で実データと突き合わせ、カウント誤りを検出すること。進捗表の累計が誤ると以降すべてのバッチで累計ズレが生じるため注意
12. 各科目ページの `<script>window.PRESET_SUBJECT_COUNT = NN;</script>` はページ読み込み時に `app.js` が app-subtitle の表示を強制上書きするため、HTMLの数値だけ変更しても画面に反映されない。数値更新時は HTML・PRESET_SUBJECT_COUNT の両方を修正し、再帰検索で見落としを防ぐこと
13. mainへマージ後、GitHub Pagesへの反映には数分の遅延がある。変更が古い表示のままの場合はブラウザキャッシュが残っている可能性があるため、ユーザーにスーパーリロード（Ctrl+Shift+R / Cmd+Shift+R）を案内すること
14. 作業開始時に必ず `git fetch` で main との差分を確認すること。ローカルのファイル状態だけ見ていると、main で既に解消された問題を重複報告したり、古いデータで提案するリスクがある
15. CSS・JS の変更がHTML から反映されていない場合、ブラウザキャッシュ以前に **GitHub Pages の CDN（Fastly）キャッシュ** が問題になる可能性が高い。ブラウザでクエリ付きURL（`?v=1`など）を開いて確認し、検証なしに仮説で判断しないこと
16. CDN キャッシュ問題の恒久対策として、HTML内のCSS・JS読み込みURLにバージョン番号クエリを付ける：`<link href="../style.css?v=20260727">` など。更新のたびに番号を変えることで、CDNとブラウザ両方の新しいファイル取得を保証できる

## よく使うコマンド

```bash
# ローカルで確認（静的サーバが必要）
npx serve .

# 特定ファイルの問題数確認
grep -c '"id":' flashcard/questions.js
```
