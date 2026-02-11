// src/state.ts - 前回チェック状態の管理

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// ── 型定義 ─────────────────────────────────────

export interface State {
  lastRunAt: string;
  processedAppIds: number[];
}

// ── プロジェクトルート ──────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

const STATE_FILE = path.join(PROJECT_ROOT, "state.json");

// ── デフォルト値 ───────────────────────────────

function defaultState(): State {
  return {
    lastRunAt: "",
    processedAppIds: [],
  };
}

// ── 公開関数 ───────────────────────────────────

/**
 * state.json を読み込んで State を返す。
 * ファイルが存在しない場合はデフォルト値を返す。
 */
export async function loadState(): Promise<State> {
  try {
    const raw = await readFile(STATE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as State;
    return parsed;
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === "ENOENT") {
      return defaultState();
    }
    throw err;
  }
}

/**
 * State を state.json に保存する。
 */
export async function saveState(state: State): Promise<void> {
  const json = JSON.stringify(state, null, 2) + "\n";
  await writeFile(STATE_FILE, json, "utf-8");
}

// ── ヘルパー ───────────────────────────────────

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
