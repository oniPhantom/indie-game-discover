# Green Man Gaming アフィリエイトプログラム セットアップガイド

このドキュメントは、Green Man Gaming（GMG）アフィリエイトプログラムの登録から運用開始までの手順をまとめたものです。

---

## 📋 目次

1. [概要](#概要)
2. [登録手順](#登録手順)
3. [審査](#審査)
4. [審査通過後の設定手順](#審査通過後の設定手順)
5. [リンク形式](#リンク形式)
6. [支払い条件](#支払い条件)
7. [運用チェックリスト](#運用チェックリスト)
8. [参考リンク](#参考リンク)

---

## 概要

### Green Man Gaming アフィリエイトとは

Green Man Gaming（GMG）は、PCゲームのデジタル配信プラットフォームで、7,000以上のゲームを450以上のパブリッシャーから提供しています。アフィリエイトプログラムに参加することで、ゲーム販売の紹介報酬を得ることができます。

### 報酬率

- **通常商品**: 最大 **5%**
- **バンドル商品**: **10%**
- パフォーマンスに応じて報酬率アップの可能性あり

### Cookie期間

- **30日間**
- ユーザーがあなたのリンクをクリックしてから30日以内に購入すれば、報酬が発生します
- 最終クリック（last-click）による報酬付与

---

## 登録手順

### 方法1: 公式サイトから直接申請（推奨）

Green Man Gamingは2つのアフィリエイトプログラムを提供しています：

#### Business Affiliate Program（Webサイト・ブログ向け）

1. **公式ページにアクセス**
   [Green Man Gaming Affiliates](https://www.greenmangaming.com/affiliates/)

2. **申請フォームを入力**
   以下の情報が必要です：
   - サイト名・URL
   - サイトの説明（どんなコンテンツを扱っているか）
   - 月間訪問者数（PV）
   - オーディエンス属性（ゲーマー層、インディーゲームファン等）
   - コンテンツの種類（レビュー、ニュース、攻略等）
   - 連絡先情報（メールアドレス、SNSアカウント）

3. **申請を送信**
   フォーム送信後、数日以内にGMGから審査結果のメールが届きます。

#### Ambassador Affiliate Program（SNS・インフルエンサー向け）

SNS（YouTube、Twitch、Twitter等）で活動している場合、こちらのプログラムも選択できます。

- 特典: 週次ゲーム配布、Discordアクセス、プロモーションサポート
- 申請方法は公式ページから同様に行います

### 方法2: FlexOffersネットワーク経由

代替手段として、アフィリエイトネットワーク経由での登録も可能です。

1. **FlexOffersに登録**
   [FlexOffers.com](https://www.flexoffers.com/) でアカウントを作成

2. **Green Man Gaming US Affiliate Programを検索**
   [Green Man Gaming US Affiliate Program](https://www.flexoffers.com/affiliate-programs/green-man-gaming-us-affiliate-program/)

3. **プログラムに申請**
   FlexOffersのダッシュボードから申請を行います

**注意**: FlexOffers経由の場合、報酬の受け取りや管理もFlexOffers経由になります。

### 方法3: その他のネットワーク

- **Impact** プラットフォーム（パートナーネットワーク経由でアクセス可能）
- **Skimlinks**, **Admitad** でも提供されている場合があります

---

## 審査

### 審査期間の目安

- **通常**: 数日〜1週間程度
- 申請が多い時期は遅れる可能性があります

### 審査通過のコツ

#### 1. **コンテンツの充実**
   - 最低10記事以上のゲームレビュー・記事を公開
   - インディーゲームに関する専門性をアピール
   - 記事の質（文字数、画像、詳細な説明）を高める

#### 2. **サイトの見た目**
   - プロフェッショナルなデザイン
   - ナビゲーションが分かりやすい
   - モバイル対応

#### 3. **トラフィック**
   - 月間100PV以上が望ましい（絶対条件ではない）
   - SNSフォロワーがいる場合はその数もアピール

#### 4. **規約遵守**
   - 違法コンテンツがないこと
   - ゲームの海賊版を推奨していないこと
   - 透明性のあるアフィリエイト開示

#### 5. **連絡先の明記**
   - サイトに「お問い合わせ」ページを設置
   - プライバシーポリシーを掲載

### 審査に落ちた場合

- サイトを改善して再申請可能
- FlexOffers等の代替ネットワークを試す

---

## 審査通過後の設定手順

### 1. アフィリエイトIDの取得

審査通過後、GMGからアフィリエイトダッシュボードへのアクセス権が付与されます。

1. **ダッシュボードにログイン**
   メールで送られてくるリンクからログイン

2. **アフィリエイトIDを確認**
   ダッシュボードの「Account Settings」や「Tracking」セクションに記載されています。
   - 例: `your-affiliate-id-123`

3. **トラッキングリンクを生成**
   - ゲームごとのリンクをダッシュボードで生成できます
   - カスタムsub-IDで複数のトラフィックソースを追跡可能

### 2. `.env` への設定

プロジェクトのルートディレクトリにある `.env` ファイルに、取得したアフィリエイトIDを追加します。

```bash
# Green Man Gaming Affiliate
GMG_AFFILIATE_ID=your-affiliate-id-123
```

**注意**: `.env` ファイルは `.gitignore` に含まれているため、リポジトリにコミットされません。本番環境（Vercel等）では環境変数として設定してください。

### 3. コード側の修正箇所

#### `src/components/AffiliateLink.astro`

アフィリエイトリンクを生成するコンポーネントを修正します。

```astro
---
interface Props {
  store: 'steam' | 'humble' | 'gog' | 'gmg';
  appId?: string;
  url?: string;
  text?: string;
}

const { store, appId, url, text = 'ストアページ' } = Astro.props;
const gmgAffiliateId = import.meta.env.GMG_AFFILIATE_ID;

let affiliateUrl = '';

switch (store) {
  case 'steam':
    affiliateUrl = `https://store.steampowered.com/app/${appId}/`;
    break;
  case 'gmg':
    // GMGアフィリエイトリンク（sub-ID付き）
    if (gmgAffiliateId) {
      affiliateUrl = url
        ? `${url}?tap_a=${gmgAffiliateId}&tap_s=indie-game-discover`
        : `https://www.greenmangaming.com/?tap_a=${gmgAffiliateId}`;
    } else {
      affiliateUrl = url || 'https://www.greenmangaming.com/';
    }
    break;
  // 他のストア...
}
---

<a href={affiliateUrl} target="_blank" rel="noopener noreferrer">
  {text}
</a>
```

**ポイント**:
- `tap_a`: アフィリエイトID（必須）
- `tap_s`: sub-ID（トラッキング用、任意）

### 4. 動作確認

1. **ローカル環境で確認**
   ```bash
   npm run dev
   ```

2. **リンクをクリックして確認**
   - GMGのサイトに正しく遷移するか
   - URLにアフィリエイトパラメータが含まれているか（ブラウザのアドレスバーで確認）

3. **ダッシュボードで確認**
   - 数時間後、GMGアフィリエイトダッシュボードでクリック数が記録されているか確認

---

## リンク形式

### 基本的なURL構造

Green Man Gamingアフィリエイトリンクは以下の形式です：

```
https://www.greenmangaming.com/{game-url}?tap_a={affiliate-id}&tap_s={sub-id}
```

### パラメータ

| パラメータ | 説明 | 必須 |
|-----------|------|------|
| `tap_a` | アフィリエイトID（ダッシュボードで確認） | ✅ 必須 |
| `tap_s` | sub-ID（トラフィックソース識別用） | ❌ 任意 |

### 例

**ゲーム個別ページ**:
```
https://www.greenmangaming.com/games/hades/?tap_a=12345&tap_s=blog-review
```

**トップページ**:
```
https://www.greenmangaming.com/?tap_a=12345&tap_s=homepage-banner
```

### sub-IDの活用

sub-IDを使うことで、トラフィックソースごとのコンバージョンを追跡できます。

**例**:
- `tap_s=blog-review` → ブログレビュー記事からのクリック
- `tap_s=youtube` → YouTubeからのクリック
- `tap_s=newsletter` → メールマガジンからのクリック

ダッシュボードで各sub-IDごとのパフォーマンスを確認できます。

---

## 支払い条件

### 最低支払額

- **$50**
- この金額に達するまで、報酬は繰り越されます

### 支払い方法

以下のいずれかを選択できます：
- **PayPal**（推奨、手数料が低い）
- **銀行振込**

### 支払いサイクル

- **月次払い**
- 月末締め、翌月中旬〜下旬に支払い
- 例: 1月の報酬 → 2月15日〜28日頃に支払い

### 国際送金について

- 日本からの参加も可能（グローバル対応）
- PayPalが最も簡単（日本の銀行口座に出金可能）
- 銀行振込の場合、手数料がかかる可能性あり

---

## 運用チェックリスト

以下の手順で、アフィリエイトプログラムを開始できます。

### ステップ1: 登録

- [ ] GMG公式サイトまたはFlexOffersから申請
- [ ] 申請フォームに必要情報を入力
- [ ] サイトのコンテンツを充実させる（10記事以上推奨）

### ステップ2: 審査待ち

- [ ] 審査結果のメールを待つ（数日〜1週間）
- [ ] 審査中もコンテンツを充実させる

### ステップ3: アフィリエイトID取得

- [ ] 審査通過メールを確認
- [ ] ダッシュボードにログイン
- [ ] アフィリエイトIDをコピー

### ステップ4: 設定

- [ ] `.env` ファイルに `GMG_AFFILIATE_ID` を追加
- [ ] `AffiliateLink.astro` コンポーネントを修正
- [ ] 本番環境（Vercel等）に環境変数を設定

### ステップ5: 動作確認

- [ ] ローカル環境でリンクをテスト
- [ ] URLにアフィリエイトパラメータが含まれているか確認
- [ ] GMGダッシュボードでクリック数を確認

### ステップ6: 公開

- [ ] サイトを公開
- [ ] 記事にGMGアフィリエイトリンクを追加
- [ ] SNSで宣伝

### ステップ7: 運用

- [ ] 週次でダッシュボードを確認
- [ ] sub-IDごとのパフォーマンスを分析
- [ ] 報酬が$50に達したら支払い申請

---

## 参考リンク

### 公式ドキュメント
- [Green Man Gaming Affiliates 公式ページ](https://www.greenmangaming.com/affiliates/)
- [Become an Affiliate（GMG公式FAQ）](https://greenmangaming.zendesk.com/hc/en-us/articles/221625407-Become-an-Affiliate)

### アフィリエイトネットワーク
- [FlexOffers - Green Man Gaming US Affiliate Program](https://www.flexoffers.com/affiliate-programs/green-man-gaming-us-affiliate-program/)
- [Green Man Gaming Affiliate Program（The Affiliate Monkey）](https://theaffiliatemonkey.com/affiliate/green-man-gaming-affiliate-program/)

### レビュー・詳細情報
- [Green Man Gaming Affiliate Program: Commission & Program Details](https://getlasso.co/affiliate/green-man-gaming/)
- [Green Man Gaming Affiliate Program + Commissions Rates](https://linkclicky.com/affiliate-program/green-man-gaming/)

---

## トラブルシューティング

### Q: リンクをクリックしても報酬が記録されない

**A**: 以下を確認してください：
- アフィリエイトIDが正しく設定されているか
- URLに `tap_a` パラメータが含まれているか
- Cookie がブロックされていないか
- ダッシュボードの反映は数時間〜1日遅れる場合があります

### Q: 審査に落ちた

**A**: 以下を改善して再申請してください：
- コンテンツを10記事以上に増やす
- 記事の質を向上させる（画像、詳細な説明、独自の視点）
- サイトデザインを改善
- プライバシーポリシーを追加

### Q: 支払いが届かない

**A**: 以下を確認してください：
- 報酬が$50に達しているか
- PayPal/銀行口座情報が正しく登録されているか
- ダッシュボードで支払いステータスを確認
- GMGサポートに問い合わせ（通常2-3営業日で返信）

---

## 更新履歴

- **2026-02-14**: 初版作成

---

このガイドに従って、Green Man Gamingアフィリエイトプログラムを開始してください。不明点があれば、GMG公式サポートに問い合わせることをお勧めします。
