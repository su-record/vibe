/**
 * Provider 우선순위 설정 읽기/쓰기
 * config.json의 "priority" 키를 관리
 */

import path from 'path';
import fs from 'fs';

export type EmbeddingProvider = 'az' | 'gpt';
export type KimiProvider = 'az' | 'kimi';

export interface PriorityConfig {
  embedding: EmbeddingProvider[];
  kimi: KimiProvider[];
}

const DEFAULT_PRIORITY: PriorityConfig = {
  embedding: ['az', 'gpt'],
  kimi: ['az', 'kimi'],
};

interface ConfigJson {
  priority?: {
    embedding?: string[];
    kimi?: string[];
  };
  [key: string]: unknown;
}

/**
 * 프로젝트 config.json 경로
 */
function getConfigPath(): string {
  return path.join(process.cwd(), '.claude', 'vibe', 'config.json');
}

/**
 * config.json 읽기
 */
function readConfig(): ConfigJson {
  const configPath = getConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as ConfigJson;
    }
  } catch { /* ignore */ }
  return {};
}

/**
 * config.json 쓰기
 */
function writeConfig(config: ConfigJson): void {
  const configPath = getConfigPath();
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

/**
 * 유효한 임베딩 프로바이더인지 확인
 */
function isValidEmbeddingProvider(p: string): p is EmbeddingProvider {
  return p === 'az' || p === 'gpt';
}

/**
 * 유효한 Kimi 프로바이더인지 확인
 */
function isValidKimiProvider(p: string): p is KimiProvider {
  return p === 'az' || p === 'kimi';
}

/**
 * 우선순위 설정 로드
 */
export function loadPriorityConfig(): PriorityConfig {
  const config = readConfig();
  const priority = config.priority;

  const result: PriorityConfig = { ...DEFAULT_PRIORITY };

  if (priority?.embedding && Array.isArray(priority.embedding)) {
    const valid = priority.embedding.filter(isValidEmbeddingProvider);
    if (valid.length > 0) {
      result.embedding = valid;
    }
  }

  if (priority?.kimi && Array.isArray(priority.kimi)) {
    const valid = priority.kimi.filter(isValidKimiProvider);
    if (valid.length > 0) {
      result.kimi = valid;
    }
  }

  return result;
}

/**
 * 우선순위 설정 저장
 */
export function savePriorityConfig(update: Partial<PriorityConfig>): void {
  const config = readConfig();

  if (!config.priority) {
    config.priority = {};
  }

  if (update.embedding) {
    config.priority.embedding = update.embedding;
  }
  if (update.kimi) {
    config.priority.kimi = update.kimi;
  }

  writeConfig(config);
}
