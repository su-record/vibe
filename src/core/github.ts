import { spawnSync } from 'node:child_process';
import { readJson } from './store.js';
import { usage } from './errors.js';

/**
 * GitHub over its REST API. A token comes from GITHUB_TOKEN / GH_TOKEN or the gh CLI; without one
 * the public limits apply. Tests inject a client; VIBE_GITHUB_FIXTURE points the CLI at a JSON map
 * of path fragments to responses so nothing touches the network.
 */
export interface GithubClient {
  get(apiPath: string): Promise<unknown>;
  authenticated: boolean;
}

const API = 'https://api.github.com';

export function githubToken(): string | null {
  const env = process.env['GITHUB_TOKEN'] ?? process.env['GH_TOKEN'];
  if (env) return env;
  const result = spawnSync('gh', ['auth', 'token'], { encoding: 'utf-8' });
  const token = result.status === 0 ? result.stdout.trim() : '';
  return token || null;
}

export function fixtureClient(file: string): GithubClient {
  const map = readJson<Record<string, unknown>>(file) ?? {};
  return {
    authenticated: true,
    get: (apiPath) => {
      const key = Object.keys(map).find((k) => apiPath.includes(k));
      if (key === undefined) return Promise.reject(usage(`fixture has no response for ${apiPath}`));
      return Promise.resolve(map[key]);
    },
  };
}

export function githubClient(): GithubClient {
  const fixture = process.env['VIBE_GITHUB_FIXTURE'];
  if (fixture) return fixtureClient(fixture);
  const token = githubToken();
  const headers: Record<string, string> = { accept: 'application/vnd.github+json', 'user-agent': 'vibe-4' };
  if (token) headers['authorization'] = `Bearer ${token}`;
  return {
    authenticated: token !== null,
    get: async (apiPath) => {
      let response: Response;
      try {
        response = await fetch(`${API}${apiPath}`, { headers });
      } catch (error) {
        throw usage(`no network: ${(error as Error).message}`);
      }
      if (!response.ok) throw usage(`github ${response.status} for ${apiPath.split('?')[0]}`);
      return response.json() as Promise<unknown>;
    },
  };
}
