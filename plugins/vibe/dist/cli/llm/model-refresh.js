/**
 * 모델 최신화 — claude / openai(api+oauth) / gemini / zai 의 현재 사용 가능한 모델을
 * provider API 로 라이브 조회하고(실패 시 큐레이션 목록), 추천 모델을
 * ~/.vibe/config.json models(런타임 SSOT)에 반영한다.
 */
import { getGptApiKey, patchGlobalConfig, readGlobalConfig } from '../../infra/lib/config/GlobalConfigManager.js';
import { isCodexAvailable } from '../../infra/lib/llm-availability.js';
import { fetchAvailableModels as fetchZaiModels } from '../../infra/lib/zai/index.js';
const CURATED = {
    claude: {
        label: 'Claude (Anthropic)',
        models: ['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5'],
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
        models: ['glm-5.2', 'glm-5-turbo', 'glm-5.1', 'glm-4.7'],
        recommended: 'glm-5.2',
        overrideKeys: ['zaiCoding'], // flagship 5.2 → coding(UI). general(zai)은 client 기본 5.1 유지
    },
};
function pickRecommended(id, live) {
    const { recommended } = CURATED[id];
    if (live.includes(recommended))
        return recommended;
    if (live.length > 0)
        return [...live].sort((a, b) => b.localeCompare(a))[0];
    return recommended;
}
async function fetchJson(url, headers) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
        const res = await fetch(url, { headers, signal: controller.signal });
        if (!res.ok)
            return null;
        return await res.json();
    }
    catch {
        return null;
    }
    finally {
        clearTimeout(timer);
    }
}
/** OpenAI 호환 { data: [{id}] } 파서 */
function parseIdList(data) {
    const list = data?.data;
    if (!Array.isArray(list))
        return [];
    return list.map((m) => m.id).filter((id) => Boolean(id));
}
async function fetchClaude() {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key)
        return { ids: [], source: 'no-key' };
    const data = await fetchJson('https://api.anthropic.com/v1/models?limit=100', {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
    });
    const ids = parseIdList(data);
    return ids.length ? { ids, source: 'live' } : { ids: [], source: 'curated' };
}
async function fetchOpenai() {
    const key = getGptApiKey() ?? process.env.OPENAI_API_KEY ?? null;
    const oauthOnly = !key && isCodexAvailable();
    if (!key)
        return { ids: [], source: oauthOnly ? 'curated' : 'no-key', oauthOnly };
    const data = await fetchJson('https://api.openai.com/v1/models', { Authorization: `Bearer ${key}` });
    const ids = parseIdList(data).filter((id) => id.startsWith('gpt') || id.startsWith('o'));
    return { ids, source: ids.length ? 'live' : 'curated', oauthOnly: false };
}
async function fetchGemini() {
    const key = process.env.GEMINI_API_KEY;
    if (!key)
        return { ids: [], source: 'no-key' };
    const data = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {});
    const list = data?.models ?? [];
    const ids = list.map((m) => m.name?.replace(/^models\//, '')).filter((id) => Boolean(id));
    return ids.length ? { ids, source: 'live' } : { ids: [], source: 'curated' };
}
async function fetchZai() {
    const models = await fetchZaiModels('general');
    const ids = models.map((m) => m.id);
    // fetchAvailableModels 는 키가 없어도 큐레이션을 반환하므로 키 유무로 source 판별
    const hasKey = readGlobalConfig().credentials?.zai || process.env.ZAI_API_KEY || process.env.ZAI_CODING_API_KEY;
    return { ids, source: hasKey ? 'live' : 'no-key' };
}
/** 모든 provider 의 현재 모델 조회 */
export async function fetchAllProviders() {
    const [claude, openai, gemini, zai] = await Promise.all([
        fetchClaude(), fetchOpenai(), fetchGemini(), fetchZai(),
    ]);
    const build = (id, r) => {
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
/** 추천 모델을 config.json models(SSOT)에 반영. 변경 목록 반환. */
export function applyToConfig(providers) {
    const current = readGlobalConfig().models ?? {};
    const changes = [];
    const patch = {};
    for (const p of providers) {
        for (const key of p.overrideKeys) {
            const from = current[key];
            if (from !== p.recommended) {
                patch[key] = p.recommended;
                changes.push({ key, from, to: p.recommended });
            }
        }
    }
    if (changes.length)
        patchGlobalConfig({ models: patch });
    return changes;
}
//# sourceMappingURL=model-refresh.js.map