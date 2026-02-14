// src/index.ts - インディーゲーム発掘 メインエントリポイント

import { fetchNewIndieGames, fetchPopularIndieGames, fetchGameDetails, fetchGameReviews } from "./steam.js";
import { getPromptForTask } from "./prompt-loader.js";
import { generateKansaiHighlights, generateKansaiCatch } from "./generator.js";
import {
  buildArticle,
  saveArticle,
  generateSlug,
  type ArticleData,
  type EnglishReview,
} from "./article-builder.js";
import { loadState, saveState, type FailedApp } from "./state.js";

// ---------- 設定 ----------

/** 1回の実行で処理するゲーム数の上限 */
const MAX_GAMES_PER_RUN = 3;

/** 1ゲームあたり翻訳するレビュー数 */
const REVIEWS_PER_GAME = 3;

/** API呼び出し間の待機時間（ms） */
const API_DELAY = 1500;

/** failCount がこの値以上のゲームはスキップ */
const MAX_FAIL_COUNT = 3;

// ---------- ヘルパー ----------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * レビューパーセンテージから日本語のレビューラベルを生成する
 */
function getJapaneseReviewLabel(percentage: number): string {
  if (percentage >= 95) return "圧倒的に好評";
  if (percentage >= 80) return "非常に好評";
  if (percentage >= 70) return "ほぼ好評";
  if (percentage >= 40) return "賛否両論";
  return "不評";
}

/**
 * レビューの品質をスコアリングする（適度な長さを優先）
 */
function scoreReview(review: { reviewText: string; playtimeHours: number; votedUp: boolean }): number {
  const length = review.reviewText.length;
  let score = 0;

  // 長さスコア（150-500文字が最適）
  if (length >= 150 && length <= 500) {
    score += 10;
  } else if (length >= 100 && length < 150) {
    score += 7;
  } else if (length > 500 && length <= 800) {
    score += 5;
  } else {
    score += 2;
  }

  // プレイ時間スコア（5時間以上を優先）
  if (review.playtimeHours >= 50) {
    score += 5;
  } else if (review.playtimeHours >= 10) {
    score += 3;
  } else if (review.playtimeHours >= 5) {
    score += 2;
  }

  return score;
}

// ---------- メイン ----------

async function main(): Promise<void> {
  console.log("[index] インディーゲーム発掘ツール 開始");

  // 1. 前回状態読み込み
  const state = await loadState();
  console.log(
    `[index] 前回実行: ${state.lastRunAt || "(初回実行)"}, 処理済み: ${state.processedAppIds.length}件`,
  );

  // 2. プロンプト読み込み
  const [highlightsPrompt, catchPrompt] = await Promise.all([
    getPromptForTask("kansai_highlights"),
    getPromptForTask("kansai_catch"),
  ]);
  console.log("[index] プロンプト読み込み完了");

  // 3. 新しいインディーゲーム一覧取得（Steam Store + SteamSpy をマージ）
  const [storeGames, spyGames] = await Promise.all([
    fetchNewIndieGames(20),
    fetchPopularIndieGames(20).catch((err) => {
      console.warn("[index] SteamSpy API エラー（Steam Store のみ使用）:", err);
      return [];
    }),
  ]);

  // 重複排除してマージ（Store が先、SteamSpy で補完）
  const seenIds = new Set(storeGames.map((g) => g.appId));
  const mergedGames = [...storeGames];
  for (const g of spyGames) {
    if (!seenIds.has(g.appId)) {
      seenIds.add(g.appId);
      mergedGames.push(g);
    }
  }
  console.log(
    `[index] Steam Store: ${storeGames.length}件, SteamSpy: ${spyGames.length}件 → マージ後: ${mergedGames.length}件`,
  );

  // 4. 処理済み・リトライ上限超えを除外
  const skippedAppIds = new Set(
    state.failedAppIds
      .filter((f) => f.failCount >= MAX_FAIL_COUNT)
      .map((f) => f.appId),
  );
  const newGames = mergedGames.filter(
    (g) => !state.processedAppIds.includes(g.appId) && !skippedAppIds.has(g.appId),
  );
  console.log(`[index] 未処理: ${newGames.length} 件 (リトライ上限超え: ${skippedAppIds.size} 件)`);

  if (newGames.length === 0) {
    console.log("[index] 新しいゲームはありません");
    await saveState({ ...state, lastRunAt: new Date().toISOString(), failedAppIds: state.failedAppIds });
    return;
  }

  // 5. 上限数だけ処理
  const targets = newGames.slice(0, MAX_GAMES_PER_RUN);
  const processedIds: number[] = [];
  const failedAppIds: FailedApp[] = [...state.failedAppIds];

  for (const game of targets) {
    console.log(`\n[index] === ${game.name} (appId: ${game.appId}) ===`);

    try {
      // 5a. ゲーム詳細取得
      console.log("[index] ゲーム詳細を取得中...");
      const details = await fetchGameDetails(game.appId);
      await sleep(API_DELAY);

      // 5b. レビュー取得
      console.log("[index] レビューを取得中...");
      const { reviews: rawReviews, reviewSummary } = await fetchGameReviews(game.appId, REVIEWS_PER_GAME * 3);
      await sleep(API_DELAY);

      // reviewPercentage と reviewScore を上書き
      if (reviewSummary.percentage > 0) {
        details.reviewPercentage = reviewSummary.percentage;
      }
      if (!details.reviewScore && reviewSummary.percentage > 0) {
        details.reviewScore = getJapaneseReviewLabel(reviewSummary.percentage);
      }

      // 面白いレビューを選別（適度な長さ＋品質スコアリング）
      const validReviews = rawReviews
        .filter((r) => r.reviewText.length >= 50 && r.reviewText.length <= 800 && r.playtimeHours >= 1)
        .map((r) => ({ ...r, score: scoreReview(r) }))
        .sort((a, b) => b.score - a.score);

      // 肯定・否定のバランスを取る
      const positiveReviews = validReviews.filter((r) => r.votedUp);
      const negativeReviews = validReviews.filter((r) => !r.votedUp);

      const selectedReviews = [
        ...positiveReviews.slice(0, REVIEWS_PER_GAME - 1),
        ...(negativeReviews.length > 0 ? negativeReviews.slice(0, 1) : positiveReviews.slice(REVIEWS_PER_GAME - 1, REVIEWS_PER_GAME)),
      ].slice(0, REVIEWS_PER_GAME);

      if (selectedReviews.length === 0) {
        console.log("[index] 良質なレビューが見つからず、スキップ");
        processedIds.push(game.appId);
        continue;
      }

      // 5c. 関西弁おもろいポイント生成
      console.log("[index] 関西弁おもろいポイントを生成中...");
      const kansaiHighlights = await generateKansaiHighlights(
        selectedReviews,
        highlightsPrompt.prompt,
        highlightsPrompt.config,
      );
      await sleep(API_DELAY);

      // 5d. 関西弁キャッチ生成
      console.log("[index] 関西弁キャッチを生成中...");
      const kansaiCatch = await generateKansaiCatch(
        details,
        catchPrompt.prompt,
        catchPrompt.config,
      );
      await sleep(API_DELAY);

      // 5e. 英語レビューをEnglishReview型に変換
      const englishReviews: EnglishReview[] = selectedReviews.map((r) => ({
        reviewText: r.reviewText,
        playtimeHours: r.playtimeHours,
        votedUp: r.votedUp,
      }));

      // 5f. 記事を組み立て
      console.log("[index] 記事を組み立て中...");
      const articleData: ArticleData = {
        ...details,
        englishReviews,
        kansaiHighlights,
        kansaiCatch,
      };
      const markdown = buildArticle(articleData);

      // 5f. 記事を保存
      const slug = generateSlug(details.name, details.appId);
      await saveArticle(slug, markdown);
      console.log(`[index] 記事を保存: src/content/games/${slug}.md`);

      processedIds.push(game.appId);
    } catch (err) {
      console.error(`[index] ${game.name} の処理でエラー:`, err);
      // failedAppIds に記録（リトライ可能にするため processedIds には入れない）
      const existing = failedAppIds.find((f) => f.appId === game.appId);
      if (existing) {
        existing.failCount += 1;
      } else {
        failedAppIds.push({ appId: game.appId, failCount: 1 });
      }
    }
  }

  // 6. 状態を保存
  await saveState({
    lastRunAt: new Date().toISOString(),
    processedAppIds: [...state.processedAppIds, ...processedIds],
    failedAppIds,
  });

  console.log(
    `\n[index] 完了: ${processedIds.length} 件処理`,
  );
}

main().catch(console.error);
