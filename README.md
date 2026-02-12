# Indie Game Discover

AIが見つけたインディーゲームを関西弁レビューで紹介する自動生成サイト。

## 仕組み

1. **Steam Store API** + **SteamSpy API** から注目のインディーゲームを取得
2. **GitHub Models API** (GPT-4o-mini) でゲーム紹介文を生成
3. ユーザーレビューを**関西弁**に翻訳
4. **Astro** で静的サイトを生成し **Cloudflare Pages** にデプロイ

## セットアップ

```bash
# 依存関係インストール
npm install

# 記事生成（GitHub Models APIトークンが必要）
GH_MODELS_TOKEN=your_token npm run generate

# 開発サーバー起動
npm run dev

# 静的サイトビルド
npm run build
```

## プロンプトカスタマイズ

`prompts/` ディレクトリ内のMarkdownファイルを編集:

- `prompts/game-intro.md` - ゲーム紹介文の生成プロンプト
- `prompts/review-kansai.md` - 関西弁翻訳のプロンプト
- `prompts/config.yaml` - 使用モデル・パラメータ設定

## Cloudflare Pages デプロイ

1. GitHub リポジトリを Cloudflare Pages に接続
2. ビルド設定:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Node.js version**: `20`
3. GitHub Actions が週2回（月・木）PR を自動作成
4. PR をレビュー・マージすると自動デプロイ

## GitHub Actions

`.github/workflows/generate.yml` により週2回（月曜・木曜 03:00 UTC）記事生成PRが自動作成されます。

- `workflow_dispatch` で手動実行も可能
- 生成された記事は PR として作成され、レビュー後にマージ

## 技術スタック

- **記事生成**: TypeScript + tsx
- **サイト**: Astro 5 (静的生成)
- **ホスティング**: Cloudflare Pages
- **データソース**: Steam Store API, SteamSpy API
- **AI**: GitHub Models (GPT-4o-mini)

## ライセンス

MIT
