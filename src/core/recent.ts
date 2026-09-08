import type { GithubClient } from './github.js';
import type { Candidate } from './research.js';

/**
 * The research window — what moved in the last N days ranks first. A repository's latest
 * releases, and when none falls inside the window its latest commit, are one or two requests
 * per candidate. Evidence outside the window is demoted, never dropped.
 */
export interface Recent {
  releases: Array<{ tag: string; at: string }>;
  lastCommitAt: string | null;
  /** true inside the window, false outside, null when nothing about the repository could be read — unknown is not demoted. */
  inWindow: boolean | null;
}

const DAY_MS = 86_400_000;

interface ReleaseItem {
  tag_name?: string;
  published_at?: string | null;
  created_at?: string | null;
  draft?: boolean;
}
interface CommitItem {
  commit?: { committer?: { date?: string }; author?: { date?: string } };
}

export function daysAgo(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / DAY_MS));
}

function ago(iso: string, now: number): string {
  const d = daysAgo(iso, now);
  if (d < 1) return 'today';
  if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`;
  const months = Math.floor(d / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}

/** One line on what moved, in the `why` of a candidate. */
export function recentLine(recent: Recent, days: number, now: number): string {
  const inside = recent.releases.filter((r) => daysAgo(r.at, now) <= days);
  if (inside.length === 1) return `released ${inside[0]!.tag} ${ago(inside[0]!.at, now)}`;
  if (inside.length > 1) return `${inside.length} releases in ${days} days, latest ${inside[0]!.tag} ${ago(inside[0]!.at, now)}`;
  if (!recent.lastCommitAt && recent.releases.length === 0) return 'activity unknown';
  const commit = recent.lastCommitAt ? `last commit ${ago(recent.lastCommitAt, now)}` : 'no commit found';
  return `${commit}, no release in ${days} days`;
}

/** Releases, then the latest commit when nothing was released inside the window. A failed request is an empty answer, not an error. */
export async function fetchRecent(client: GithubClient, fullName: string, days: number, now: number): Promise<Recent> {
  let releases: Recent['releases'] = [];
  try {
    const items = (await client.get(`/repos/${fullName}/releases?per_page=3`)) as ReleaseItem[];
    if (Array.isArray(items)) {
      releases = items.filter((r) => !r.draft && (r.published_at || r.created_at)).map((r) => ({ tag: r.tag_name ?? '(untagged)', at: (r.published_at ?? r.created_at) as string }));
    }
  } catch {
    /* no releases readable — the commits say what moved */
  }
  const insideRelease = releases.some((r) => daysAgo(r.at, now) <= days);
  let lastCommitAt: string | null = null;
  if (!insideRelease) {
    try {
      const items = (await client.get(`/repos/${fullName}/commits?per_page=1`)) as CommitItem[];
      const c = Array.isArray(items) ? items[0] : undefined;
      lastCommitAt = c?.commit?.committer?.date ?? c?.commit?.author?.date ?? null;
    } catch {
      /* nothing readable */
    }
  }
  const known = releases.length > 0 || lastCommitAt !== null;
  const inWindow = known ? insideRelease || (lastCommitAt !== null && daysAgo(lastCommitAt, now) <= days) : null;
  return { releases, lastCommitAt, inWindow };
}

/** Enrich repository candidates with their window and order: inside the window first, then by score; skills keep their score order after the groups. */
export async function applyWindow(client: GithubClient, candidates: Candidate[], days: number, now = Date.now()): Promise<Candidate[]> {
  const out: Candidate[] = [];
  for (const c of candidates) {
    if (c.kind !== 'repo') {
      out.push(c);
      continue;
    }
    const recent = await fetchRecent(client, c.ref, days, now);
    out.push({ ...c, recent, why: `${c.why} · ${recentLine(recent, days, now)}` });
  }
  // inside the window first; skills and repositories whose activity could not be read keep their score order; known-stale last
  const rank = (c: Candidate): number => (c.kind === 'repo' && c.recent?.inWindow === true ? 0 : c.kind === 'repo' && c.recent?.inWindow === false ? 2 : 1);
  return out.sort((a, b) => rank(a) - rank(b) || b.score - a.score);
}
