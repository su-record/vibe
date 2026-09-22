import { afterEach, describe, expect, it, vi } from 'vitest';
import { skillsmpCandidate, skillsmpClient } from './skillsmp.js';

afterEach(() => vi.unstubAllEnvs());
const item = { githubUrl: 'https://github.com/acme/tools/tree/main/skills/pdf', description: 'Read PDFs', stars: 99999 };
const response = () => Response.json({ success: true, data: { skills: [item] } });

describe('SkillsMP discovery boundary', () => {
  it('uses anonymous bounded search and produces a preview command, not an installation', async () => {
    vi.stubEnv('SKILLSMP_API_KEY', '');
    const request = vi.fn<typeof fetch>().mockResolvedValue(response());
    const candidates = await skillsmpClient(request).search('pdf 한국어');
    const [url, options] = request.mock.calls[0]!;
    expect(String(url)).toContain('https://skillsmp.com/api/v1/skills/search?');
    expect(new URL(String(url)).searchParams.get('q')).toBe('pdf 한국어');
    expect(new URL(String(url)).searchParams.get('limit')).toBe('5');
    expect(options).toMatchObject({ headers: { Accept: 'application/json' }, redirect: 'error' });
    expect(options?.headers).not.toHaveProperty('Authorization');
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(candidates[0]).toMatchObject({ ref: 'acme/tools@pdf', action: 'vibe skill add acme/tools@pdf', stars: null, license: null });
    expect(candidates[0]?.why).toContain('unverified');
  });

  it('sends the optional key only to the fixed endpoint and hides transport error details', async () => {
    vi.stubEnv('SKILLSMP_API_KEY', 'secret-test');
    const request = vi.fn<typeof fetch>().mockRejectedValue(new Error('secret-test'));
    await expect(skillsmpClient(request).search('pdf')).rejects.toThrow(/^SkillsMP unavailable, limited or invalid; using existing GitHub search$/);
    expect(new URL(String(request.mock.calls[0]![0])).origin).toBe('https://skillsmp.com');
    expect(request.mock.calls[0]![1]).toMatchObject({ headers: { Authorization: 'Bearer secret-test' }, redirect: 'error' });
  });

  it.each([401, 429, 500])('rejects HTTP %s so the caller can fall back', async status => {
    await expect(skillsmpClient(vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status }))).search('pdf')).rejects.toThrow('SkillsMP unavailable');
  });

  it.each(['not json', '{"success":true,"data":{}}', 'x'.repeat(131073)])('rejects malformed or excessive response (%#)', async body => {
    await expect(skillsmpClient(vi.fn<typeof fetch>().mockResolvedValue(new Response(body))).search('pdf')).rejects.toThrow('SkillsMP unavailable');
  });

  it('accepts source paths and rejects unsafe or ambiguous links', () => {
    expect(skillsmpCandidate({ githubUrl: 'https://github.com/acme/tools/blob/main/skills/pdf/SKILL.md' })?.ref).toBe('acme/tools@pdf');
    for (const githubUrl of ['https://evil.example/acme/tools', 'https://github.com/acme/tools?x=1', 'https://github.com/acme/tools/tree/main/../pdf', 'https://github.com/acme/tools/tree/main/%2e%2e/pdf', 'https://github.com/acme/tools/blob/main/index.js', 'https://github.com/acme/tools/tree/main/pdf;touch']) {
      expect(skillsmpCandidate({ githubUrl })).toBeNull();
    }
  });
});
