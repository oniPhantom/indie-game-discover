// src/index.ts - インディーゲーム発掘 メインエントリポイント

import { fetchNewIndieGames, fetchPopularIndieGames, fetchGameDetails, fetchGameReviews } from "./steam.js";
import { getPromptForTask } from "./prompt-loader.js";
import { generateGameIntro, translateReviewToKansai } from "./generator.js";
import {
  buildArticle,
  saveArticle,
  generateSlug,
  type ArticleData,
  type KansaiReview,
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

// ---------- メイン ----------

async function main(): Promise<void> {
  console.log("[index] インディーゲーム発掘ツール 開始");

  // 1. 前回状態読み込み
  const state = await loadState();
  console.log(
    `[index] 前回実行: ${state.lastRunAt || "(初回実行)"}, 処理済み: ${state.processedAppIds.length}件`,
  );

  // 2. プロンプト読み込み
  const [introPrompt, reviewPrompt] = await Promise.all([
    getPromptForTask("game_intro"),
    getPromptForTask("review_translation"),
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
      const reviews = await fetchGameReviews(game.appId, REVIEWS_PER_GAME * 2);
      await sleep(API_DELAY);

      // 面白いレビューを選別（ある程度のプレイ時間＋長さのあるレビュー）
      const selectedReviews = reviews
        .filter((r) => r.reviewText.length > 30 && r.playtimeHours >= 1)
        .slice(0, REVIEWS_PER_GAME);

      if (selectedReviews.length === 0) {
        console.log("[index] 良質なレビューが見つからず、スキップ");
        processedIds.push(game.appId);
        continue;
      }

      // 5c. AI紹介文生成
      console.log("[index] AI紹介文を生成中...");
      const generatedIntro = await generateGameIntro(
        details,
        introPrompt.prompt,
        introPrompt.config,
      );
      await sleep(API_DELAY);

      // 5d. レビューを関西弁に翻訳
      console.log(
        `[index] ${selectedReviews.length} 件のレビューを関西弁に翻訳中...`,
      );
      const kansaiReviews: KansaiReview[] = [];

      for (const review of selectedReviews) {
        const translated = await translateReviewToKansai(
          review.reviewText,
          reviewPrompt.prompt,
          reviewPrompt.config,
        );
        kansaiReviews.push({
          original: review.reviewText,
          translated,
          playtimeHours: review.playtimeHours,
          votedUp: review.votedUp,
        });
        await sleep(API_DELAY);
      }

      // 5e. 記事を組み立て
      console.log("[index] 記事を組み立て中...");
      const articleData: ArticleData = {
        ...details,
        generatedIntro,
        kansaiReviews,
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
