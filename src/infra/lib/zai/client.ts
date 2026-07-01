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

// OpenAI 호환 엔드포인트 (POST {base}/chat/completions — base 에 /v1 을 붙이면 404)
export const ZAI_BASE_GENERAL = 'https://api.z.ai/api/paas/v4';
export const ZAI_BASE_CODING = 'https://api.z.ai/api/coding/paas/v4';
// 참고: GLM Coding Plan 은 Anthropic 호환 엔드포인트(Claude Code 용)도 제공한다.
//   ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic (요청 포맷은 /v1/messages)
// 본 클라이언트는 OpenAI 호환 coding 엔드포인트를 사용한다.
export const ZAI_BASE_CODING_ANTHROPIC = 'https://api.z.ai/api/anthropic';

/** 큐레이션된 알려진 모델 (list-models 미지원/무네트워크 시 fallback) */
export const ZAI_MODELS: Record<string, ZaiModelInfo> = {
  'glm-5.2': { id: 'glm-5.2', name: 'GLM-5.2', description: 'Flagship — latest, top coding (coding plan)', top: true },
  'glm-5-turbo': { id: 'glm-5-turbo', name: 'GLM-5-Turbo', description: 'Fast agentic model' },
  'glm-5.1': { id: 'glm-5.1', name: 'GLM-5.1', description: 'General API top model' },
  'glm-4.7': { id: 'glm-4.7', name: 'GLM-4.7', description: 'Prior-gen coding model' },
};

/** flagship(최고) 모델 id — UI 개발 등 최고 품질이 필요한 작업에 사용 (coding plan) */
export const ZAI_TOP_MODEL = 'glm-5.2';
/** coding plan 기본 모델 */
export const DEFAULT_CODING_MODEL = 'glm-5.2';
/** 일반 API 기본 모델 (일반 요금제는 현재 5.1 이 상한) */
export const DEFAULT_GENERAL_MODEL = 'glm-5.1';
/** 하위 호환용 기본값 */
export const DEFAULT_MODEL = DEFAULT_CODING_MODEL;

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
  const fallback = plan === 'coding' ? DEFAULT_CODING_MODEL : DEFAULT_GENERAL_MODEL;
  return getModelOverride(key) || fallback;
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
