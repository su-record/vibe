/**
 * ZAI (Z.ai / GLM) 클라이언트 — OpenAI 호환 chat completions
 *
 * 두 요금제를 지원한다:
 *   - coding  : GLM Coding Plan (별도 키). Anthropic/Codex 호환 코딩 엔드포인트.
 *   - general : 일반 pay-as-you-go v4 엔드포인트.
 */

import {
  getZaiApiKey,
  getZaiCodingApiKey,
  getModelOverride,
} from '../config/GlobalConfigManager.js';
import { createTimeoutSignal, DEFAULT_LLM_TIMEOUT_MS } from '../llm/timeout.js';
import type { ZaiPlan, ZaiModelInfo, ZaiChatOptions, ZaiChatResponse } from './types.js';

export const ZAI_BASE_GENERAL = 'https://api.z.ai/api/paas/v4';
export const ZAI_BASE_CODING = 'https://api.z.ai/api/coding/paas/v4';

/** 큐레이션된 알려진 모델 (list-models 미지원/무네트워크 시 fallback) */
export const ZAI_MODELS: Record<string, ZaiModelInfo> = {
  'glm-4.6': { id: 'glm-4.6', name: 'GLM-4.6', description: 'Flagship — top reasoning & coding (200K context)', top: true },
  'glm-4.5': { id: 'glm-4.5', name: 'GLM-4.5', description: 'High-capability general model' },
  'glm-4.5-air': { id: 'glm-4.5-air', name: 'GLM-4.5 Air', description: 'Lightweight, fast' },
  'glm-4.5-flash': { id: 'glm-4.5-flash', name: 'GLM-4.5 Flash', description: 'Free, fast tier' },
  'glm-4.5v': { id: 'glm-4.5v', name: 'GLM-4.5V', description: 'Vision-language multimodal' },
};

/** flagship(최고) 모델 id — UI 개발 등 최고 품질이 필요한 작업에 사용 */
export const ZAI_TOP_MODEL = 'glm-4.6';
export const DEFAULT_MODEL = 'glm-4.6';

export function resolveApiKey(plan: ZaiPlan): string | null {
  if (plan === 'coding') return getZaiCodingApiKey() ?? process.env.ZAI_CODING_API_KEY ?? null;
  return getZaiApiKey() ?? process.env.ZAI_API_KEY ?? null;
}

export function baseUrlFor(plan: ZaiPlan): string {
  return plan === 'coding' ? ZAI_BASE_CODING : ZAI_BASE_GENERAL;
}

/** 코딩플랜 또는 일반 키가 하나라도 있으면 사용 가능 */
export function isZaiConfigured(): boolean {
  return Boolean(resolveApiKey('coding') || resolveApiKey('general'));
}

/** 요청에 쓸 요금제 결정 — 명시값 우선, 없으면 coding 키가 있으면 coding */
function pickPlan(requested?: ZaiPlan): ZaiPlan {
  if (requested) return requested;
  return resolveApiKey('coding') ? 'coding' : 'general';
}

function resolveModel(plan: ZaiPlan, explicit?: string): string {
  if (explicit) return explicit;
  const key = plan === 'coding' ? 'zaiCoding' : 'zai';
  return getModelOverride(key) || DEFAULT_MODEL;
}

interface OpenAiChatResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
}

/** OpenAI 호환 chat completions */
export async function chat(opts: ZaiChatOptions): Promise<ZaiChatResponse> {
  const plan = pickPlan(opts.plan);
  const apiKey = resolveApiKey(plan);
  if (!apiKey) {
    const cmd = plan === 'coding' ? 'coding-key' : 'key';
    throw new Error(`ZAI API key not found (${plan}). Run: vibe zai ${cmd} <key> or set ZAI_${plan === 'coding' ? 'CODING_' : ''}API_KEY.`);
  }

  const model = resolveModel(plan, opts.model);
  const messages = opts.systemPrompt
    ? [{ role: 'system' as const, content: opts.systemPrompt }, ...opts.messages]
    : opts.messages;

  const { signal, cleanup } = createTimeoutSignal(opts.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS, opts.signal);
  try {
    const res = await fetch(`${baseUrlFor(plan)}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: opts.maxTokens ?? 4096,
        temperature: opts.temperature ?? 0,
      }),
      signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`ZAI API ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as OpenAiChatResponse;
    return {
      content: data.choices?.[0]?.message?.content ?? '',
      model: data.model || model,
      finishReason: data.choices?.[0]?.finish_reason,
    };
  } finally {
    cleanup();
  }
}

/** live: 사용 가능한 모델 조회 (OpenAI 호환 GET /models). 실패 시 큐레이션 목록. */
export async function fetchAvailableModels(plan: ZaiPlan = 'general'): Promise<ZaiModelInfo[]> {
  const curated = Object.values(ZAI_MODELS);
  const apiKey = resolveApiKey(plan) || resolveApiKey('coding') || resolveApiKey('general');
  if (!apiKey) return curated;

  const { signal, cleanup } = createTimeoutSignal(15_000);
  try {
    const res = await fetch(`${baseUrlFor(plan)}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal,
    });
    if (!res.ok) return curated;
    const data = (await res.json()) as { data?: Array<{ id?: string }> };
    const ids = (data.data ?? []).map((m) => m.id).filter((id): id is string => Boolean(id));
    if (!ids.length) return curated;
    return ids.map((id) => ZAI_MODELS[id] ?? { id, name: id, description: 'Reported by ZAI /models' });
  } catch {
    return curated;
  } finally {
    cleanup();
  }
}
