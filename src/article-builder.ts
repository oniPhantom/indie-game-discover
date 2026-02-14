// src/article-builder.ts - Markdown記事組み立て

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { toRomaji } from "wanakana";

// ── 型定義 ─────────────────────────────────────

export interface EnglishReview {
  reviewText: string;
  playtimeHours: number;
  votedUp: boolean;
}

export interface ArticleData {
  appId: number;
  name: string;
  description: string;
  detailedDescription: string;
  genres: string[];
  tags: string[];
  price: string;
  releaseDate: string;
  developer: string;
  headerImage: string;
  reviewScore: string;
  reviewPercentage: number;
  englishReviews: EnglishReview[];
  kansaiHighlights: string;
  kansaiCatch: string;
}

// ── プロジェクトルート ──────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

// ── 公開関数 ───────────────────────────────────

/**
 * ゲーム名からURL用スラグを生成する。
 * WanaKana でカナ→ローマ字変換後、appId プレフィックスを付与して一意性を保証。
 * 例: "ゼルダの伝説" (appId: 12345) → "12345-zerudano"
 * 例: "Hollow Knight" (appId: 67890) → "67890-hollow-knight"
 */
export function generateSlug(name: string, appId: number): string {
  const romanized = toRomaji(name);
  const slug = romanized
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `${appId}-${slug}`;
}

/**
 * ゲーム情報からMarkdown形式の記事文字列を組み立てる。
 */
export function buildArticle(data: ArticleData): string {
  const frontmatter = [
    "---",
    `title: "${escapeYaml(data.name)}"`,
    `appId: ${data.appId}`,
    `genres: [${data.genres.map((g) => `"${escapeYaml(g)}"`).join(", ")}]`,
    `price: "${escapeYaml(data.price)}"`,
    `releaseDate: "${escapeYaml(data.releaseDate)}"`,
    `developer: "${escapeYaml(data.developer)}"`,
    `reviewScore: "${escapeYaml(data.reviewScore)}"`,
    `reviewPercentage: ${data.reviewPercentage}`,
    `headerImage: "${data.headerImage}"`,
    `kansaiCatch: "${escapeYaml(data.kansaiCatch)}"`,
    `generatedAt: "${new Date().toISOString()}"`,
    "---",
  ].join("\n");

  const reviewDisplay = data.reviewScore
    ? `${data.reviewScore} (${data.reviewPercentage}%)`
    : `好評率 ${data.reviewPercentage}%`;

  const infoTable = [
    "| 項目 | 詳細 |",
    "|------|------|",
    `| ジャンル | ${data.genres.join(", ")} |`,
    `| 価格 | ${data.price} |`,
    `| リリース日 | ${data.releaseDate} |`,
    `| 開発者 | ${data.developer} |`,
    `| Steam評価 | ${reviewDisplay} |`,
  ].join("\n");

  const reviews = data.englishReviews
    .map((r, i) => formatReview(r, i))
    .join("\n\n");

  return `${frontmatter}

# 🎮 ${data.name}

![${data.name}](${data.headerImage})

${infoTable}

## 公式説明

${data.detailedDescription}

## ユーザーレビュー

${reviews}

## ここがおもろい！

${data.kansaiHighlights}

---

🔗 [Steamストアページ](https://store.steampowered.com/app/${data.appId}/)
`;
}

/**
 * content/games/{slug}.md にMarkdown記事を保存する。
 * ディレクトリが存在しない場合は自動作成。
 */
export async function saveArticle(
  slug: string,
  content: string,
): Promise<void> {
  const gamesDir = path.join(PROJECT_ROOT, "src", "content", "games");
  await mkdir(gamesDir, { recursive: true });

  const filePath = path.join(gamesDir, `${slug}.md`);
  await writeFile(filePath, content, "utf-8");
}

// ── ヘルパー ───────────────────────────────────

function formatReview(review: EnglishReview, index: number): string {
  const emoji = review.votedUp ? "👍" : "👎";
  const sentiment = review.votedUp ? "Recommended" : "Not Recommended";
  const playtimeLabel = getPlaytimeLabel(review.playtimeHours);
  return [
    `### ${emoji} Review ${index + 1} (${sentiment})`,
    ``,
    `> ${review.reviewText}`,
    ``,
    `🕐 ${review.playtimeHours} hours played ${playtimeLabel}`,
  ].join("\n");
}

function getPlaytimeLabel(hours: number): string {
  if (hours >= 500) return "(Hardcore)";
  if (hours >= 100) return "(Veteran)";
  if (hours >= 30) return "(Experienced)";
  if (hours >= 10) return "(Moderate)";
  return "";
}

function escapeYaml(value: string): string {
  return value.replace(/"/g, '\\"');
}
