/**
 * `vibe llm` — LLM 모델 조회/최신화
 *
 *   vibe llm list       provider 별 현재 사용 가능한 모델 표시
 *   vibe llm refresh     라이브 조회 후 추천 모델을 ~/.vibe/config.json 에 반영
 *   vibe llm help
 */

import { fetchAllProviders, applyToConfig, type ProviderModels } from '../llm/model-refresh.js';

function sourceLabel(p: ProviderModels): string {
  if (p.source === 'no-key') return 'no key — curated list';
  if (p.oauthOnly) return 'oauth (Codex) — curated list';
  if (p.source === 'curated') return 'API unavailable — curated list';
  return 'live';
}

function printProvider(p: ProviderModels): void {
  console.log(`\n${p.label}  [${sourceLabel(p)}]`);
  for (const id of p.models) {
    const star = id === p.recommended ? ' ★' : '';
    console.log(`  ${id}${star}`);
  }
}

export async function llmList(): Promise<void> {
  console.log('Fetching available models from providers...');
  const providers = await fetchAllProviders();
  for (const p of providers) printProvider(p);
  console.log('\n★ = recommended (latest). Update SSOT: vibe llm refresh');
}

export async function llmRefresh(): Promise<void> {
  console.log('Refreshing models from provider APIs...');
  const providers = await fetchAllProviders();
  for (const p of providers) printProvider(p);

  const changes = applyToConfig(providers);
  console.log('\n─── SSOT update (~/.vibe/config.json models) ───');
  if (changes.length === 0) {
    console.log('  Already up to date — no changes.');
  } else {
    for (const c of changes) {
      console.log(`  ${c.key}: ${c.from ?? '(unset)'} → ${c.to}`);
    }
  }
  console.log('\nNote: Claude models are managed as Claude Code tiers (sonnet/opus/haiku) and are not auto-overwritten.');
}

export function llmHelp(): void {
  console.log(`
vibe llm — LLM model discovery & SSOT refresh

  vibe llm list       List currently available models per provider
                      (claude, openai api+oauth, gemini, zai)
  vibe llm refresh    Fetch latest models and update ~/.vibe/config.json models
  vibe llm help       Show this help

Live fetch uses each provider's key (or oauth); missing keys fall back to a
curated list. Recommended (★) models are written to the runtime model SSOT.
`);
}
