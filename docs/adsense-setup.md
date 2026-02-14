# Google AdSense セットアップ

## 手順

1. https://www.google.com/adsense/ でアカウント作成
2. サイト（indie-game-discover.pages.dev）を登録
3. 審査通過後、パブリッシャーID（ca-pub-XXXX）を取得
4. GameLayout.astro の以下を更新:
   - <head>内のAdSenseスクリプトのコメントアウトを解除
   - ca-pub-XXXXXXXXXXXXXXXX を実際のIDに置換
5. 広告スロットの設定:
   - AdSenseダッシュボードで広告ユニットを作成
   - data-ad-slot の値を設定
   - .ad-placeholder を削除し、<ins>タグのコメントアウトを解除

## 広告配置ガイドライン

- 記事コンテンツの邪魔にならない位置に配置
- モバイルではレスポンシブ広告を使用
- 過度な広告は避ける（UX最優先）

## 注意事項

- AdSenseポリシーに準拠すること
- 自己クリック禁止
- コンテンツが十分にあること（審査基準: 通常10-20記事以上）
