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

## よく使うコマンド

```bash
# ローカルで確認（静的サーバが必要）
npx serve .

# 特定ファイルの問題数確認
grep -c '"id":' flashcard/questions.js
```
