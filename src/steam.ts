// src/steam.ts - Steam API クライアント

const USER_AGENT = "IndieGameDiscover/1.0";
const STORE_API_BASE = "https://store.steampowered.com";
const STEAMSPY_API_BASE = "https://steamspy.com/api.php";

// ---------- 型定義 ----------

export interface SteamGame {
  appId: number;
  name: string;
}

export interface GameDetails {
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
}

export interface SteamReview {
  reviewText: string;
  votedUp: boolean;
  playtimeHours: number;
  authorSteamId: string;
}

export interface ReviewSummary {
  totalPositive: number;
  totalNegative: number;
  totalReviews: number;
  percentage: number;
}

// ---------- ヘルパー ----------

/**
 * レビューテキストからBBCode/HTMLタグを除去して正規化する
 */
function sanitizeReviewText(text: string): string {
  return text
    .replace(/\[\/?\w+(?:=[^\]]+)?\]/g, '')  // BBCode除去
    .replace(/<[^>]+>/g, '')                   // HTMLタグ除去
    .replace(/\n{3,}/g, '\n\n')               // 連続改行正規化
    .trim();
}

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

// ---------- シードリスト（storesearch が空の場合のフォールバック） ----------

const INDIE_SEED_APP_IDS = [
  367520,  // Hollow Knight
  1145360, // Hades
  413150,  // Stardew Valley
  105600,  // Terraria
  251570,  // 7 Days to Die
  261550,  // Mount & Blade II: Bannerlord
  1966720, // Lethal Company
  1794680, // Vampire Survivors
  2379780, // Balatro
  1868140, // Dave the Diver
  1332010, // Stray
  1245620, // Elden Ring
  892970,  // Valheim
  1313140, // Unpacking
  1966900, // Brotato
  824270,  // Inscryption
  646570,  // Slay the Spire
  632360,  // Risk of Rain 2
  1061090, // Spiritfarer
  955050,  // Cult of the Lamb
  1623730, // Palworld
  2420510, // Hades II
  1172470, // Apex Legends
  2358720, // Black Myth: Wukong
  1144200, // Ready or Not
  534380,  // Dying Light 2
  548430,  // Deep Rock Galactic
  1174180, // Red Dead Redemption 2
  257850,  // Hyper Light Drifter
  504230,  // Celeste
];

// ---------- 公開API ----------

/**
 * 最近リリースされたインディーゲームを取得する。
 * Steam Store の storesearch エンドポイント（認証不要）を使用。
 * storesearch が空の場合、シードリストにフォールバック。
 */
export async function fetchNewIndieGames(
  limit: number = 10,
): Promise<SteamGame[]> {
  // まず storesearch を試す
  try {
    const url = new URL(`${STORE_API_BASE}/api/storesearch/`);
    url.searchParams.set("term", "");
    url.searchParams.set("category1", "998");
    url.searchParams.set("tags", "indie");
    url.searchParams.set("sort_by", "Released_DESC");
    url.searchParams.set("count", String(limit));

    const res = await fetchWithRetry(url.toString());
    const data = (await res.json()) as {
      items?: Array<{ id: number; name: string }>;
    };

    if (data.items && data.items.length > 0) {
      return data.items.map((item) => ({
        appId: item.id,
        name: item.name,
      }));
    }
  } catch {
    // storesearch 失敗 → フォールバック
  }

  // フォールバック: シードリストから appdetails で名前を解決
  console.log("[steam] storesearch が空のためシードリストを使用");
  const selected = INDIE_SEED_APP_IDS.slice(0, limit);
  const games: SteamGame[] = [];

  for (const appId of selected) {
    try {
      const url = `${STORE_API_BASE}/api/appdetails?appids=${appId}`;
      const res = await fetchWithRetry(url);
      const data = (await res.json()) as Record<
        string,
        { success: boolean; data?: { name?: string } }
      >;
      const entry = data[String(appId)];
      if (entry?.success && entry.data?.name) {
        games.push({ appId, name: entry.data.name });
      }
      // Rate limit: 少し待つ
      await new Promise((r) => setTimeout(r, 300));
    } catch {
      // 個別のゲーム取得失敗はスキップ
    }
  }

  return games;
}

/**
 * SteamSpy API からオーナー数の多い人気インディーゲームを取得する。
 * 認証不要。Rate limit: 1req/sec。
 */
export async function fetchPopularIndieGames(
  limit: number = 10,
): Promise<SteamGame[]> {
  const url = `${STEAMSPY_API_BASE}?request=genre&genre=Indie`;

  const res = await fetchWithRetry(url);
  const data = (await res.json()) as Record<
    string,
    { appid: number; name: string; owners: string; players_forever: number }
  >;

  // オーナー数の中央値でソート（"1,000,000 .. 2,000,000" → 下限の数値を使う）
  const entries = Object.values(data)
    .map((entry) => ({
      appId: entry.appid,
      name: entry.name,
      ownerCount: parseOwnerCount(entry.owners),
    }))
    .sort((a, b) => b.ownerCount - a.ownerCount)
    .slice(0, limit);

  return entries.map((e) => ({ appId: e.appId, name: e.name }));
}

function parseOwnerCount(owners: string): number {
  // "1,000,000 .. 2,000,000" → 1000000
  const match = owners.replace(/,/g, "").match(/^(\d+)/);
  return match ? Number(match[1]) : 0;
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

  return {
    appId,
    name: typeof d.name === "string" ? d.name : "",
    description: typeof d.short_description === "string"
      ? d.short_description
      : "",
    detailedDescription: typeof d.detailed_description === "string"
      ? d.detailed_description
      : "",
    genres: genres?.map((g) => g.description) ?? [],
    tags: categories?.map((c) => c.description) ?? [],
    price: priceOverview?.final_formatted
      ?? (d.is_free ? "無料" : "価格不明"),
    releaseDate: releaseInfo?.date ?? "",
    developer: developers?.[0] ?? "",
    headerImage: typeof d.header_image === "string" ? d.header_image : "",
    reviewScore: reviewDesc,
    reviewPercentage: 0,
  };
}

/**
 * 指定したappIdの英語レビュー（高評価順）を取得する。
 * レビュー一覧とレビューサマリーを返す。
 */
export async function fetchGameReviews(
  appId: number,
  count: number = 10,
): Promise<{ reviews: SteamReview[]; reviewSummary: ReviewSummary }> {
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
    return {
      reviews: [],
      reviewSummary: {
        totalPositive: 0,
        totalNegative: 0,
        totalReviews: 0,
        percentage: 0,
      },
    };
  }

  // query_summaryからレビューサマリーを計算
  const querySummary = data.query_summary;
  const totalPositive = querySummary?.total_positive ?? 0;
  const totalNegative = querySummary?.total_negative ?? 0;
  const totalReviews = querySummary?.total_reviews ?? 0;
  const percentage = totalPositive + totalNegative > 0
    ? Math.round((totalPositive / (totalPositive + totalNegative)) * 100)
    : 0;

  const reviewSummary: ReviewSummary = {
    totalPositive,
    totalNegative,
    totalReviews,
    percentage,
  };

  const reviews = data.reviews.map((r) => ({
    reviewText: sanitizeReviewText(r.review),
    votedUp: r.voted_up,
    playtimeHours: Math.round(r.author.playtime_forever / 60),
    authorSteamId: r.author.steamid,
  }));

  return { reviews, reviewSummary };
}
