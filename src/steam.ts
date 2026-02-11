// src/steam.ts - Steam API クライアント

const USER_AGENT = "IndieGameDiscover/1.0";
const STORE_API_BASE = "https://store.steampowered.com";
const API_BASE = "https://api.steampowered.com";

// ---------- 型定義 ----------

export interface SteamGame {
  appId: number;
  name: string;
}

export interface GameDetails {
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
}

export interface SteamReview {
  reviewText: string;
  votedUp: boolean;
  playtimeHours: number;
  authorSteamId: string;
}

// ---------- ヘルパー ----------

class SteamApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "SteamApiError";
  }
}

async function fetchWithRetry(
  url: string,
  maxRetries = 3,
): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
      });

      if (res.status === 429) {
        const wait = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }

      if (!res.ok) {
        throw new SteamApiError(
          `HTTP ${res.status}: ${res.statusText}`,
          res.status,
        );
      }

      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries - 1) {
        const wait = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }

  throw lastError ?? new SteamApiError("Unknown fetch error");
}

// ---------- 公開API ----------

/**
 * 最近リリースされたインディーゲームを取得する。
 * Steam Store の storesearch エンドポイント（認証不要）を使用。
 */
export async function fetchNewIndieGames(
  limit: number = 10,
): Promise<SteamGame[]> {
  const url = new URL(`${STORE_API_BASE}/api/storesearch/`);
  url.searchParams.set("term", "");
  url.searchParams.set("category1", "998"); // ゲームカテゴリ
  url.searchParams.set("tags", "indie");
  url.searchParams.set("sort_by", "Released_DESC");
  url.searchParams.set("count", String(limit));

  const res = await fetchWithRetry(url.toString());
  const data = (await res.json()) as {
    items?: Array<{ id: number; name: string }>;
  };

  if (!data.items) {
    return [];
  }

  return data.items.map((item) => ({
    appId: item.id,
    name: item.name,
  }));
}

/**
 * 指定したappIdのゲーム詳細を取得する。
 * 日本語ロケールで取得。
 */
export async function fetchGameDetails(
  appId: number,
): Promise<GameDetails> {
  const url = `${STORE_API_BASE}/api/appdetails?appids=${appId}&l=japanese`;
  const res = await fetchWithRetry(url);
  const data = (await res.json()) as Record<
    string,
    { success: boolean; data?: Record<string, unknown> }
  >;

  const entry = data[String(appId)];
  if (!entry?.success || !entry.data) {
    throw new SteamApiError(`Game not found: appId=${appId}`, 404);
  }

  const d = entry.data as Record<string, unknown>;
  const priceOverview = d.price_overview as
    | { final_formatted?: string; final?: number }
    | undefined;
  const releaseInfo = d.release_date as
    | { date?: string }
    | undefined;
  const developers = d.developers as string[] | undefined;
  const genres = d.genres as Array<{ description: string }> | undefined;
  const categories = d.categories as Array<{ description: string }> | undefined;

  // レビュー情報の取得
  const reviewDesc = typeof d.review_score_desc === "string"
    ? d.review_score_desc
    : "";
  const metacritic = d.metacritic as { score?: number } | undefined;

  return {
    appId,
    name: typeof d.name === "string" ? d.name : "",
    description: typeof d.short_description === "string"
      ? d.short_description
      : "",
    genres: genres?.map((g) => g.description) ?? [],
    tags: categories?.map((c) => c.description) ?? [],
    price: priceOverview?.final_formatted
      ?? (d.is_free ? "無料" : "価格不明"),
    releaseDate: releaseInfo?.date ?? "",
    developer: developers?.[0] ?? "",
    headerImage: typeof d.header_image === "string" ? d.header_image : "",
    reviewScore: reviewDesc,
    reviewPercentage: metacritic?.score ?? 0,
  };
}

/**
 * 指定したappIdの英語レビュー（高評価順）を取得する。
 */
export async function fetchGameReviews(
  appId: number,
  count: number = 10,
): Promise<SteamReview[]> {
  const url = new URL(`${STORE_API_BASE}/appreviews/${appId}`);
  url.searchParams.set("json", "1");
  url.searchParams.set("language", "english");
  url.searchParams.set("num_per_page", String(count));
  url.searchParams.set("filter", "toprated");

  const res = await fetchWithRetry(url.toString());
  const data = (await res.json()) as {
    success?: number;
    reviews?: Array<{
      review: string;
      voted_up: boolean;
      author: {
        steamid: string;
        playtime_forever: number;
      };
    }>;
    query_summary?: {
      total_positive: number;
      total_negative: number;
      total_reviews: number;
    };
  };

  if (data.success !== 1 || !data.reviews) {
    return [];
  }

  return data.reviews.map((r) => ({
    reviewText: r.review,
    votedUp: r.voted_up,
    playtimeHours: Math.round(r.author.playtime_forever / 60),
    authorSteamId: r.author.steamid,
  }));
}
