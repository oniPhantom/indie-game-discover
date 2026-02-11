// src/generator.ts - GitHub Models テキスト生成モジュール

import type { ModelConfig } from "./prompt-loader.js";
import type { GameDetails } from "./steam.js";

// ---------- 型定義 ----------

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

// ---------- 定数 ----------

const GITHUB_MODELS_ENDPOINT =
  "https://models.github.ai/inference/chat/completions";

// ---------- ヘルパー ----------

function getToken(): string {
  const token = process.env.GH_MODELS_TOKEN;
  if (!token) {
    throw new Error(
      "GH_MODELS_TOKEN が設定されていません。GitHub Models APIの認証にはこの環境変数が必須です。",
    );
  }
  return token;
}

function formatGameDetails(game: GameDetails): string {
  const lines = [
    `ゲーム名: ${game.name}`,
    `ジャンル: ${game.genres.join(", ")}`,
    `価格: ${game.price}`,
    `開発者: ${game.developer}`,
    `Steam評価: ${game.reviewScore} (${game.reviewPercentage}%)`,
    `説明: ${game.description}`,
  ];
  return lines.join("\n");
}

// ---------- 公開API ----------

/**
 * GitHub Models API を呼び出してテキストを生成する。
 * Rate limit (429) 時は Retry-After ヘッダーに従い1回リトライする。
 */
export async function generateText(
  systemPrompt: string,
  userContent: string,
  config: ModelConfig,
): Promise<string> {
  const token = getToken();

  const body = JSON.stringify({
    model: config.model,
    temperature: config.temperature,
    max_tokens: config.max_tokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  });

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  let res = await fetch(GITHUB_MODELS_ENDPOINT, { method: "POST", headers, body });

  // Rate limit: Retry-After に従って1回だけリトライ
  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After");
    const waitSec = retryAfter ? parseInt(retryAfter, 10) : 5;
    const waitMs = (Number.isNaN(waitSec) ? 5 : waitSec) * 1000;
    await new Promise((r) => setTimeout(r, waitMs));
    res = await fetch(GITHUB_MODELS_ENDPOINT, { method: "POST", headers, body });
  }

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(
      `GitHub Models API エラー (HTTP ${res.status}): ${errorBody || res.statusText}`,
    );
  }

  const data = (await res.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("GitHub Models API からの応答が空です。生成されたテキストがありません。");
  }

  return content;
}

/**
 * ゲーム詳細情報から紹介文を生成する。
 */
export async function generateGameIntro(
  gameDetails: GameDetails,
  systemPrompt: string,
  config: ModelConfig,
): Promise<string> {
  const userContent = formatGameDetails(gameDetails);
  return generateText(systemPrompt, userContent, config);
}

/**
 * 英語レビューを関西弁に翻訳する。
 */
export async function translateReviewToKansai(
  review: string,
  systemPrompt: string,
  config: ModelConfig,
): Promise<string> {
  return generateText(systemPrompt, review, config);
}
