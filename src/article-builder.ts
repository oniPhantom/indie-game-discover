// src/article-builder.ts - Markdown記事組み立て

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// ── 型定義 ─────────────────────────────────────

export interface KansaiReview {
  original: string;
  translated: string;
  playtimeHours: number;
  votedUp: boolean;
}

export interface ArticleData {
  appId: number;
  name: string;
  description: string;
  genres: string[];
  tags: string[];
  price: string;
  releaseDate: string;
  developer: string;
  headerImage: string;
  reviewScore: string;
  reviewPercentage: number;
  generatedIntro: string;
  kansaiReviews: KansaiReview[];
}

// ── プロジェクトルート ──────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

// ── 公開関数 ───────────────────────────────────

/**
 * ゲーム名からURL用スラグを生成する。
 * 小文字化、スペース→ハイフン、特殊文字除去。
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
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
    `generatedAt: "${new Date().toISOString()}"`,
    "---",
  ].join("\n");

  const infoTable = [
    "| 項目 | 詳細 |",
    "|------|------|",
    `| ジャンル | ${data.genres.join(", ")} |`,
    `| 価格 | ${data.price} |`,
    `| リリース日 | ${data.releaseDate} |`,
    `| 開発者 | ${data.developer} |`,
    `| Steam評価 | ${data.reviewScore} (${data.reviewPercentage}%) |`,
  ].join("\n");

  const reviews = data.kansaiReviews
    .map((r) => formatReview(r))
    .join("\n\n");

  return `${frontmatter}

# 🎮 ${data.name}

![${data.name}](${data.headerImage})

${infoTable}

## 💡 このゲームの魅力

${data.generatedIntro}

## 💬 ユーザーレビュー（関西弁）

${reviews}

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
  const gamesDir = path.join(PROJECT_ROOT, "content", "games");
  await mkdir(gamesDir, { recursive: true });

  const filePath = path.join(gamesDir, `${slug}.md`);
  await writeFile(filePath, content, "utf-8");
}

// ── ヘルパー ───────────────────────────────────

function formatReview(review: KansaiReview): string {
  const emoji = review.votedUp ? "⭐" : "👎";
  return [
    `> ${emoji} "${review.translated}"`,
    ">",
    `> — プレイ時間: ${review.playtimeHours}時間`,
  ].join("\n");
}

function escapeYaml(value: string): string {
  return value.replace(/"/g, '\\"');
}
