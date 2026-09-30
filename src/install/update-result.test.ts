import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('node:child_process', () => ({ spawnSync: vi.fn() }));
import { syncUpdatedIntegrations } from './update.js';

const mockSpawn = vi.mocked(spawnSync);
function result(stdout: string, extra: Record<string, unknown> = {}): ReturnType<typeof spawnSync> {
  return { status: 0, signal: null, pid: 1, output: [], stdout, stderr: '', ...extra } as ReturnType<typeof spawnSync>;
}
beforeEach(() => {
  mockSpawn.mockReset();
  mockSpawn.mockReturnValueOnce(result(path.resolve('installed modules')));
});
it.each([
  { clients: [] }, { clients: 'invalid' }, { clients: { claude: null } },
  { clients: { claude: { current: 'true' } } },
  { clients: { claude: { current: true, mode: 'plugin', pluginVersion: '4.2.4' } } },
])('rejects incomplete or contradictory installation evidence: %j', body => {
  mockSpawn.mockReturnValueOnce(result(JSON.stringify({ version: '4.2.9', ...body })));
  expect(syncUpdatedIntegrations('4.2.9')).toMatchObject({ ok: false, phase: 'verify' });
});
it('preserves partial failure details and points at setup rather than another npm install', () => {
  mockSpawn.mockReturnValueOnce(result(JSON.stringify({ version: '4.2.9', clients: { claude: { current: false }, codex: { current: true } }, details: { claude: 'registration rejected' } }), { status: 2 }));
  const report = syncUpdatedIntegrations('4.2.9');
  expect(report).toMatchObject({ ok: false, phase: 'verify' });
  expect(report.detail).toContain('registration rejected');
  expect(report.detail).toContain('not the npm install');
});
it('treats timeout after a possible write as unknown and never retries automatically', () => {
  mockSpawn.mockReturnValueOnce(result('', { status: null, signal: 'SIGTERM', error: Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }) }));
  expect(syncUpdatedIntegrations('4.2.9')).toMatchObject({ ok: false, phase: 'execute', detail: expect.stringContaining('inspect `vibe status`') });
  expect(mockSpawn).toHaveBeenCalledTimes(2);
});
it('reports no detected clients without claiming any plugin was synchronized', () => {
  mockSpawn.mockReturnValueOnce(result(JSON.stringify({ version: '4.2.9', clients: {} })));
  expect(syncUpdatedIntegrations('4.2.9')).toMatchObject({ ok: true, phase: 'complete', detail: 'package verified; no client integrations detected' });
});
