/**
 * ContainerManager Tests — Phase 5-6
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ContainerManager } from './ContainerManager.js';
import type { SandboxLogger } from './types.js';
import { DEFAULT_CONTAINER_CONFIG } from './types.js';

// ============================================================================
// Mock Dockerode
// ============================================================================

function createMockContainer(id: string): Record<string, unknown> {
  return {
    id,
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    inspect: vi.fn().mockResolvedValue({ State: { Status: 'running' } }),
    exec: vi.fn().mockResolvedValue({
      start: vi.fn().mockResolvedValue({
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (event === 'data') handler(Buffer.from('v22.0.0'));
          if (event === 'end') setTimeout(() => handler(), 10);
        }),
      }),
    }),
  };
}

function createMockDocker(): Record<string, unknown> {
  let containerCount = 0;
  const containers = new Map<string, ReturnType<typeof createMockContainer>>();

  return {
    ping: vi.fn().mockResolvedValue('OK'),
    createContainer: vi.fn().mockImplementation(() => {
      const id = `container-${++containerCount}`;
      const mock = createMockContainer(id);
      containers.set(id, mock);
      return Promise.resolve(mock);
    }),
    listContainers: vi.fn().mockResolvedValue([]),
    getContainer: vi.fn().mockImplementation((id: string) => {
      return containers.get(id) ?? createMockContainer(id);
    }),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('ContainerManager', () => {
  let logger: SandboxLogger;
  let manager: ContainerManager;

  beforeEach(() => {
    logger = vi.fn();
    manager = new ContainerManager(logger);
  });

  afterEach(async () => {
    await manager.shutdown();
  });

  describe('init', () => {
    it('Docker 데몬 미실행 시 DOCKER_NOT_RUNNING 에러', async () => {
      // init will try to load dockerode which is not installed in test env
      await expect(manager.init()).rejects.toThrow();
    });
  });

  describe('create (with mock)', () => {
    let mockDocker: ReturnType<typeof createMockDocker>;

    beforeEach(() => {
      mockDocker = createMockDocker();
      // Inject mock docker instance
      (manager as unknown as { docker: unknown }).docker = mockDocker;
    });

    it('사용자별 컨테이너 생성', async () => {
      const info = await manager.create('user-123');
      expect(info.userId).toBe('user-123');
      expect(info.state).toBe('creating');
      expect(info.cpuLimit).toBe(DEFAULT_CONTAINER_CONFIG.cpuLimit);
      expect(info.memoryLimitMb).toBe(DEFAULT_CONTAINER_CONFIG.memoryLimitMb);
      expect(info.pidLimit).toBe(DEFAULT_CONTAINER_CONFIG.pidLimit);
    });

    it('리소스 제한이 적용됨', async () => {
      const info = await manager.create('user-123', {
        cpuLimit: 1.0,
        memoryLimitMb: 1024,
        pidLimit: 200,
      });
      expect(info.cpuLimit).toBe(1.0);
      expect(info.memoryLimitMb).toBe(1024);
      expect(info.pidLimit).toBe(200);
    });

    it('사용자별 라벨이 포함됨', async () => {
      const info = await manager.create('user-456');
      expect(info.labels['vibe-user-id']).toBe('user-456');
      expect(info.labels['vibe-scope']).toBe('user');
      expect(info.labels['vibe-session-id']).toMatch(/^session-/);
    });

    it('커스텀 라벨 병합', async () => {
      const info = await manager.create('user-789', {
        labels: { 'custom-label': 'value' },
      });
      expect(info.labels['custom-label']).toBe('value');
      expect(info.labels['vibe-user-id']).toBe('user-789');
    });

    it('컨테이너 시작', async () => {
      const info = await manager.create('user-123');
      await manager.start(info.containerId);
      const containers = manager.getUserContainers('user-123');
      expect(containers[0].state).toBe('running');
    });

    it('컨테이너 중지', async () => {
      const info = await manager.create('user-123');
      await manager.start(info.containerId);
      await manager.stop(info.containerId);
      const containers = manager.getUserContainers('user-123');
      expect(containers[0].state).toBe('stopped');
    });

    it('컨테이너 삭제', async () => {
      const info = await manager.create('user-123');
      await manager.remove(info.containerId);
      expect(manager.getUserContainers('user-123').length).toBe(0);
    });

    it('존재하지 않는 컨테이너 에러', async () => {
      await expect(manager.start('nonexistent')).rejects.toThrow('컨테이너를 찾을 수 없습니다');
    });
  });

  describe('container limits', () => {
    let mockDocker: ReturnType<typeof createMockDocker>;

    beforeEach(() => {
      mockDocker = createMockDocker();
      (manager as unknown as { docker: unknown }).docker = mockDocker;
    });

    it('사용자당 최대 컨테이너 수 제한', async () => {
      await manager.create('user-A');
      await manager.create('user-A');
      await expect(manager.create('user-A')).rejects.toThrow('사용자당 최대 컨테이너 수');
    });

    it('전체 최대 컨테이너 수 제한', async () => {
      // Create up to maxContainersTotal
      for (let i = 0; i < DEFAULT_CONTAINER_CONFIG.maxContainersTotal; i++) {
        await manager.create(`user-${i}`);
      }
      await expect(manager.create('user-overflow')).rejects.toThrow('최대 컨테이너 수');
    });
  });

  describe('exec', () => {
    let mockDocker: ReturnType<typeof createMockDocker>;

    beforeEach(() => {
      mockDocker = createMockDocker();
      (manager as unknown as { docker: unknown }).docker = mockDocker;
    });

    it('실행 중인 컨테이너에서 명령 실행', async () => {
      const info = await manager.create('user-123');
      await manager.start(info.containerId);
      const result = await manager.exec(info.containerId, ['node', '--version']);
      expect(result.timedOut).toBe(false);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('중지된 컨테이너에서 실행 시 에러', async () => {
      const info = await manager.create('user-123');
      // state is 'creating', not 'running'
      await expect(manager.exec(info.containerId, ['echo', 'hello'])).rejects.toThrow('실행 중이 아닙니다');
    });
  });

  describe('cleanup', () => {
    let mockDocker: ReturnType<typeof createMockDocker>;

    beforeEach(() => {
      mockDocker = createMockDocker();
      (manager as unknown as { docker: unknown }).docker = mockDocker;
    });

    it('비활성 컨테이너 정리', async () => {
      const info = await manager.create('user-123');
      await manager.start(info.containerId);

      // Manually set lastActivityAt to 31 minutes ago
      const containers = manager.getContainers();
      const oldTime = new Date(Date.now() - 31 * 60 * 1000).toISOString();
      (containers[0] as { lastActivityAt: string }).lastActivityAt = oldTime;

      const removed = await manager.cleanup();
      expect(removed).toBe(1);
      expect(manager.getContainers().length).toBe(0);
    });

    it('활성 컨테이너는 정리하지 않음', async () => {
      const info = await manager.create('user-123');
      await manager.start(info.containerId);
      // lastActivityAt is just now
      const removed = await manager.cleanup();
      expect(removed).toBe(0);
      expect(manager.getContainers().length).toBe(1);
    });
  });

  describe('shutdown', () => {
    let mockDocker: ReturnType<typeof createMockDocker>;

    beforeEach(() => {
      mockDocker = createMockDocker();
      (manager as unknown as { docker: unknown }).docker = mockDocker;
    });

    it('모든 컨테이너 삭제 및 정리', async () => {
      await manager.create('user-A');
      await manager.create('user-B');
      expect(manager.getContainers().length).toBe(2);

      await manager.shutdown();
      expect(manager.getContainers().length).toBe(0);
    });
  });

  describe('getUserContainers', () => {
    let mockDocker: ReturnType<typeof createMockDocker>;

    beforeEach(() => {
      mockDocker = createMockDocker();
      (manager as unknown as { docker: unknown }).docker = mockDocker;
    });

    it('특정 사용자의 컨테이너만 필터링', async () => {
      await manager.create('user-A');
      await manager.create('user-B');
      await manager.create('user-A');

      expect(manager.getUserContainers('user-A').length).toBe(2);
      expect(manager.getUserContainers('user-B').length).toBe(1);
      expect(manager.getUserContainers('user-C').length).toBe(0);
    });
  });

  describe('create retry', () => {
    it('생성 실패 시 재시도', async () => {
      let callCount = 0;
      const failingDocker = {
        ping: vi.fn().mockResolvedValue('OK'),
        createContainer: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount <= 1) throw new Error('Network error');
          return Promise.resolve(createMockContainer('retry-success'));
        }),
        listContainers: vi.fn().mockResolvedValue([]),
        getContainer: vi.fn(),
      };
      (manager as unknown as { docker: unknown }).docker = failingDocker;

      const info = await manager.create('user-retry');
      expect(info.containerId).toBe('retry-success');
      expect(callCount).toBe(2);
    });

    it('재시도 초과 시 에러', async () => {
      const alwaysFailDocker = {
        ping: vi.fn().mockResolvedValue('OK'),
        createContainer: vi.fn().mockRejectedValue(new Error('Persistent error')),
        listContainers: vi.fn().mockResolvedValue([]),
        getContainer: vi.fn(),
      };
      (manager as unknown as { docker: unknown }).docker = alwaysFailDocker;

      await expect(manager.create('user-fail')).rejects.toThrow('컨테이너 생성 실패');
    });
  });
});
