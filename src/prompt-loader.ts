import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import yaml from "js-yaml";

// ── 型定義 ─────────────────────────────────────

export interface ModelConfig {
  model: string;
  temperature: number;
  max_tokens: number;
  prompt_file: string;
}

export interface PromptConfig {
  game_intro: ModelConfig;
  review_translation: ModelConfig;
  kansai_highlights: ModelConfig;
  kansai_catch: ModelConfig;
}

// ── プロジェクトルート ──────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

// ── 公開関数 ───────────────────────────────────

/**
 * prompts/config.yaml を読み込んでパースする
 */
export async function loadPromptConfig(): Promise<PromptConfig> {
  const configPath = path.join(PROJECT_ROOT, "prompts", "config.yaml");
  const raw = await readFile(configPath, "utf-8");
  const parsed = yaml.load(raw) as PromptConfig;
  return parsed;
}

/**
 * 指定された Markdown ファイルを読み込んで文字列として返す
 * @param promptFile プロジェクトルートからの相対パス (例: "prompts/game-intro.md")
 */
export async function loadPrompt(promptFile: string): Promise<string> {
  const filePath = path.join(PROJECT_ROOT, promptFile);
  const content = await readFile(filePath, "utf-8");
  return content;
}

/**
 * taskType に対応するプロンプト文字列と ModelConfig を返す
 */
export async function getPromptForTask(
  taskType: "game_intro" | "review_translation" | "kansai_highlights" | "kansai_catch",
): Promise<{ prompt: string; config: ModelConfig }> {
  const promptConfig = await loadPromptConfig();
  const config = promptConfig[taskType];
  const prompt = await loadPrompt(config.prompt_file);
  return { prompt, config };
}
