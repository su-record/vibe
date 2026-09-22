import type { Candidate } from './research.js';

export interface SkillSearchClient { search(query: string): Promise<Candidate[]> }
const ENDPOINT = 'https://skillsmp.com/api/v1/skills/search';
const MAX_BYTES = 131_072;

/** Catalog metadata is a discovery hint. Installation still resolves and previews GitHub source. */
export function skillsmpCandidate(value: unknown): Candidate | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (typeof item.githubUrl !== 'string' || item.githubUrl.length > 1000) return null;
  const match = /^https:\/\/github\.com\/([\w-]+)\/([\w.-]+)(?:\/(tree|blob)\/([\w.-]+)\/([\w./-]+))?\/?$/.exec(item.githubUrl);
  if (!match) return null;
  let dir = (match[5] ?? '').replace(/\/$/, '');
  if (match[3] === 'blob') {
    if (dir !== 'SKILL.md' && !dir.endsWith('/SKILL.md')) return null;
    dir = dir.replace(/\/?SKILL\.md$/, '');
  }
  if ([match[2], ...dir.split('/')].some(p => p === '.' || p === '..')) return null;
  const name = dir.replace(/^skills\//, '');
  const ref = `${match[1]}/${match[2]}${name ? `@${name}` : ''}`;
  const description = typeof item.description === 'string' ? item.description.replace(/[\r\n\t|]/g, ' ').slice(0, 400) : '';
  return { kind: 'skill', ref, url: item.githubUrl, why: `SkillsMP discovery (unverified): ${description}`,
    stars: null, updatedAt: null, license: null, action: `vibe skill add ${ref}`, score: 3 };
}

export function skillsmpClient(request: typeof fetch = fetch): SkillSearchClient {
  return { search: async query => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const key = process.env['SKILLSMP_API_KEY']?.trim();
    if (key) headers.Authorization = `Bearer ${key}`;
    const url = new URL(ENDPOINT);
    url.searchParams.set('q', query.slice(0, 500));
    url.searchParams.set('limit', '5');
    try {
      const response = await request(url, { headers, redirect: 'error', signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const reader = response.body?.getReader();
      if (!reader) throw new Error('missing response');
      const chunks: Uint8Array[] = []; let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_BYTES) throw new Error('response too large');
          chunks.push(value);
        }
      } finally { await reader.cancel().catch(() => {}); }
      const doc = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (doc?.success !== true || !Array.isArray(doc.data?.skills)) throw new Error('invalid response');
      return doc.data.skills.slice(0, 5).map(skillsmpCandidate).filter((c: Candidate | null): c is Candidate => c !== null);
    } catch {
      // Never copy response bodies or transport errors: either may contain the API key.
      throw new Error('SkillsMP unavailable, limited or invalid; using existing GitHub search');
    }
  } };
}
