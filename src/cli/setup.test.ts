import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../install/update.js', () => ({ checkUpdate: vi.fn(), runUpdate: vi.fn(), syncUpdatedIntegrations: vi.fn() }));
vi.mock('../install/global.js', () => ({ ensureGlobal: vi.fn(() => []), globalStatus: vi.fn(), uninstallGlobal: vi.fn(), uninstallProjectSurfaces: vi.fn() }));
import { cmdUpdate } from './setup.js';
import { checkUpdate, runUpdate, syncUpdatedIntegrations } from '../install/update.js';
import { ensureGlobal, globalStatus } from '../install/global.js';

beforeEach(() => vi.clearAllMocks());
it('synchronizes the new binary after npm update and reports synchronization failure', () => {
  vi.mocked(runUpdate).mockReturnValue({ installed: '4.2.7', latest: '4.2.8', available: true, updated: true, detail: '4.2.7 → 4.2.8' });
  vi.mocked(syncUpdatedIntegrations).mockReturnValue({ ok: true, detail: 'synchronized' });
  expect(cmdUpdate({ home: '/tmp/test home' }).code).toBe(0);
  expect(syncUpdatedIntegrations).toHaveBeenCalledWith('4.2.8', '/tmp/test home');
  vi.mocked(syncUpdatedIntegrations).mockReturnValue({ ok: false, detail: 'incomplete' });
  expect(cmdUpdate({}).code).toBe(2);
});
it('repairs stale integrations even when the npm version is already current', () => {
  vi.mocked(runUpdate).mockReturnValue({ installed: '4.2.8', latest: '4.2.8', available: false, updated: false, detail: 'current' });
  vi.mocked(globalStatus).mockReturnValue({ home: '/tmp/home', clients: {}, cardBytes: 0, cardOver: false });
  expect(cmdUpdate({}).code).toBe(0);
  expect(ensureGlobal).toHaveBeenCalledOnce();
  expect(syncUpdatedIntegrations).not.toHaveBeenCalled();
});
it('keeps --check read-only and reports npm install failure as failure', () => {
  vi.mocked(checkUpdate).mockReturnValue({ installed: '4.2.7', latest: '4.2.8', available: true });
  expect(cmdUpdate({ check: true }).code).toBe(0);
  expect(runUpdate).not.toHaveBeenCalled();
  expect(ensureGlobal).not.toHaveBeenCalled();
  vi.mocked(runUpdate).mockReturnValue({ installed: '4.2.7', latest: '4.2.8', available: true, updated: false, detail: 'install failed' });
  expect(cmdUpdate({}).code).toBe(2);
  expect(syncUpdatedIntegrations).not.toHaveBeenCalled();
});
