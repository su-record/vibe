/**
 * 모델 최신화 — claude / openai(api+oauth) / gemini / zai 의 현재 사용 가능한 모델을
 * provider API 로 라이브 조회하고(실패 시 큐레이션 목록), 추천 모델을
 * ~/.vibe/config.json models(런타임 SSOT)에 반영한다.
 */

import { getGptApiKey, patchGlobalConfig, readGlobalConfig } from '../../infra/lib/config/GlobalConfigManager.js';
import { isCodexAvailable } from '../../infra/lib/llm-availability.js';
import { fetchAvailableModels as fetchZaiModels } from '../../infra/lib/zai/index.js';
import type { ModelOverrides } from '../types.js';

export type ProviderId = 'claude' | 'openai' | 'gemini' | 'zai';
export type FetchSource = 'live' | 'curated' | 'no-key';

export interface ProviderModels {
  provider: ProviderId;
  label: string;
  models: string[];
  recommended: string;
  source: FetchSource;
  /** OpenAI: API 키 없이 oauth(Codex)만 있는 경우 */
  oauthOnly?: boolean;
  /** refresh 시 갱신할 config.json models 키 (없으면 갱신하지 않음) */
  overrideKeys: Array<keyof ModelOverrides>;
}

interface Curated {
  label: string;
  models: string[];
  recommended: string;
  overrideKeys: Array<keyof ModelOverrides>;
}

const CURATED: Record<ProviderId, Curated> = {
  claude: {
    label: 'Claude (Anthropic)',
    models: ['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5-20251001'],
    recommended: 'claude-opus-4-8',
    overrideKeys: [], // Claude Code tier alias 로 관리 — 자동 덮어쓰지 않음
  },
  openai: {
    label: 'OpenAI (GPT)',
    models: ['gpt-5.5-pro', 'gpt-5.5', 'gpt-5.3-codex', 'gpt-5.3-codex-spark'],
    recommended: 'gpt-5.5',
    overrideKeys: ['gpt'],
  },
  gemini: {
    label: 'Gemini (Google)',
    models: ['gemini-3.1-pro-preview', 'gemini-2.5-pro', 'gemini-2.5-flash'],
    recommended: 'gemini-3.1-pro-preview',
    overrideKeys: ['gemini'],
  },
  zai: {
    label: 'ZAI (Z.ai / GLM)',
    models: ['glm-4.6', 'glm-4.5', 'glm-4.5-air', 'glm-4.5-flash', 'glm-4.5v'],
    recommended: 'glm-4.6',
    overrideKeys: ['zai', 'zaiCoding'],
  },
};

function pickRecommended(id: ProviderId, live: string[]): string {
  const { recommended } = CURATED[id];
  if (live.includes(recommended)) return recommended;
  if (live.length > 0) return [...live].sort((a, b) => b.localeCompare(a))[0];
  return recommended;
}

async function fetchJson(url: string, headers: Record<string, string>): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** OpenAI 호환 { data: [{id}] } 파서 */
function parseIdList(data: unknown): string[] {
  const list = (data as { data?: Array<{ id?: string }> } | null)?.data;
  if (!Array.isArray(list)) return [];
  return list.map((m) => m.id).filter((id): id is string => Boolean(id));
}

async function fetchClaude(): Promise<{ ids: string[]; source: FetchSource }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ids: [], source: 'no-key' };
  const data = await fetchJson('https://api.anthropic.com/v1/models?limit=100', {
    'x-api-key': key,
    'anthropic-version': '2023-06-01',
  });
  const ids = parseIdList(data);
  return ids.length ? { ids, source: 'live' } : { ids: [], source: 'curated' };
}

async function fetchOpenai(): Promise<{ ids: string[]; source: FetchSource; oauthOnly: boolean }> {
  const key = getGptApiKey() ?? process.env.OPENAI_API_KEY ?? null;
  const oauthOnly = !key && isCodexAvailable();
  if (!key) return { ids: [], source: oauthOnly ? 'curated' : 'no-key', oauthOnly };
  const data = await fetchJson('https://api.openai.com/v1/models', { Authorization: `Bearer ${key}` });
  const ids = parseIdList(data).filter((id) => id.startsWith('gpt') || id.startsWith('o'));
  return { ids, source: ids.length ? 'live' : 'curated', oauthOnly: false };
}

async function fetchGemini(): Promise<{ ids: string[]; source: FetchSource }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ids: [], source: 'no-key' };
  const data = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {});
  const list = (data as { models?: Array<{ name?: string }> } | null)?.models ?? [];
  const ids = list.map((m) => m.name?.replace(/^models\//, '')).filter((id): id is string => Boolean(id));
  return ids.length ? { ids, source: 'live' } : { ids: [], source: 'curated' };
}

async function fetchZai(): Promise<{ ids: string[]; source: FetchSource }> {
  const models = await fetchZaiModels('general');
  const ids = models.map((m) => m.id);
  // fetchAvailableModels 는 키가 없어도 큐레이션을 반환하므로 키 유무로 source 판별
  const hasKey = readGlobalConfig().credentials?.zai || process.env.ZAI_API_KEY || process.env.ZAI_CODING_API_KEY;
  return { ids, source: hasKey ? 'live' : 'no-key' };
}

/** 모든 provider 의 현재 모델 조회 */
export async function fetchAllProviders(): Promise<ProviderModels[]> {
  const [claude, openai, gemini, zai] = await Promise.all([
    fetchClaude(), fetchOpenai(), fetchGemini(), fetchZai(),
  ]);

  const build = (
    id: ProviderId,
    r: { ids: string[]; source: FetchSource; oauthOnly?: boolean },
  ): ProviderModels => {
    const models = r.ids.length ? r.ids : CURATED[id].models;
    return {
      provider: id,
      label: CURATED[id].label,
      models,
      recommended: pickRecommended(id, r.ids),
      source: r.source,
      oauthOnly: r.oauthOnly,
      overrideKeys: CURATED[id].overrideKeys,
    };
  };

  return [build('claude', claude), build('openai', openai), build('gemini', gemini), build('zai', zai)];
}

export interface RefreshChange {
  key: keyof ModelOverrides;
  from: string | undefined;
  to: string;
}

/** 추천 모델을 config.json models(SSOT)에 반영. 변경 목록 반환. */
export function applyToConfig(providers: ProviderModels[]): RefreshChange[] {
  const current = readGlobalConfig().models ?? {};
  const changes: RefreshChange[] = [];
  const patch: Partial<ModelOverrides> = {};

  for (const p of providers) {
    for (const key of p.overrideKeys) {
      const from = (current as Partial<ModelOverrides>)[key];
      if (from !== p.recommended) {
        (patch as Record<string, string>)[key] = p.recommended;
        changes.push({ key, from, to: p.recommended });
      }
    }
  }

  if (changes.length) patchGlobalConfig({ models: patch });
  return changes;
}
