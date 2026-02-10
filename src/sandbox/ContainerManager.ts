/**
 * Container Manager — Phase 5-1
 *
 * Docker container lifecycle: create, start, stop, remove, exec.
 * Warm pool for fast provisioning. Auto-cleanup for inactive containers.
 */

import type {
  ContainerInfo,
  ContainerCreateOptions,
  ContainerState,
  ExecResult,
  SandboxLogger,
} from './types.js';
import { DEFAULT_CONTAINER_CONFIG, createSandboxError } from './types.js';
import { getDefaultSecurityConfig, buildHostConfig } from './ContainerConfig.js';

// ============================================================================
// Dockerode shape (dynamic import)
// ============================================================================

interface DockerodeContainer {
  id: string;
  start(): Promise<void>;
  stop(opts?: { t?: number }): Promise<void>;
  remove(opts?: { force?: boolean }): Promise<void>;
  exec(opts: Record<string, unknown>): Promise<{ start(opts: Record<string, unknown>): Promise<DockerodeStream> }>;
  inspect(): Promise<{ State: { Status: string } }>;
}

interface DockerodeStream {
  on(event: string, handler: (...args: unknown[]) => void): void;
  output?: { on(event: string, handler: (...args: unknown[]) => void): void };
}

interface DockerodeInstance {
  ping(): Promise<unknown>;
  createContainer(opts: Record<string, unknown>): Promise<DockerodeContainer>;
  listContainers(opts: Record<string, unknown>): Promise<Array<{ Id: string; Labels: Record<string, string>; State: string }>>;
  getContainer(id: string): DockerodeContainer;
}

// ============================================================================
// Container Manager
// ============================================================================

export class ContainerManager {
  private docker: DockerodeInstance | null = null;
  private containers = new Map<string, ContainerInfo>();
  private logger: SandboxLogger;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(logger: SandboxLogger) {
    this.logger = logger;
  }

  async init(): Promise<void> {
    this.docker = await this.loadDockerode();
    await this.ping();
    this.startCleanupTimer();
  }

  async create(userId: string, options?: Partial<ContainerCreateOptions>): Promise<ContainerInfo> {
    this.ensureDocker();
    this.enforceContainerLimits(userId);

    const config = {
      image: options?.image ?? DEFAULT_CONTAINER_CONFIG.image,
      cpuLimit: options?.cpuLimit ?? DEFAULT_CONTAINER_CONFIG.cpuLimit,
      memoryLimitMb: options?.memoryLimitMb ?? DEFAULT_CONTAINER_CONFIG.memoryLimitMb,
      pidLimit: options?.pidLimit ?? DEFAULT_CONTAINER_CONFIG.pidLimit,
      networkMode: options?.networkMode ?? 'none',
      scope: options?.scope ?? 'user',
    };

    const security = getDefaultSecurityConfig();
    const hostConfig = buildHostConfig(
      security, config.cpuLimit, config.memoryLimitMb, config.pidLimit, config.networkMode,
    );

    const labels = {
      'vibe-user-id': userId,
      'vibe-scope': config.scope,
      'vibe-session-id': `session-${Date.now()}`,
      ...options?.labels,
    };

    let container: DockerodeContainer;
    let retries = DEFAULT_CONTAINER_CONFIG.createRetries;

    while (true) {
      try {
        container = await this.docker!.createContainer({
          Image: config.image,
          Labels: labels,
          HostConfig: hostConfig,
          User: '1000:1000',
          WorkingDir: '/workspace',
          Cmd: ['sleep', 'infinity'],
        });
        break;
      } catch (err) {
        if (retries <= 0) {
          throw createSandboxError('CONTAINER_CREATE_FAILED',
            `컨테이너 생성 실패: ${err instanceof Error ? err.message : String(err)}`);
        }
        retries--;
        this.logger('warn', `Container create retry (${retries} left)`);
      }
    }

    const info: ContainerInfo = {
      containerId: container.id,
      userId,
      scope: config.scope,
      state: 'creating',
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      cpuLimit: config.cpuLimit,
      memoryLimitMb: config.memoryLimitMb,
      pidLimit: config.pidLimit,
      labels,
    };

    this.containers.set(container.id, info);
    return info;
  }

  async start(containerId: string): Promise<void> {
    this.ensureDocker();
    const info = this.getContainerInfo(containerId);
    const container = this.docker!.getContainer(containerId);
    await container.start();
    info.state = 'running';
    info.lastActivityAt = new Date().toISOString();
  }

  async stop(containerId: string): Promise<void> {
    this.ensureDocker();
    const info = this.getContainerInfo(containerId);
    const container = this.docker!.getContainer(containerId);
    await container.stop({ t: 5 });
    info.state = 'stopped';
  }

  async remove(containerId: string): Promise<void> {
    this.ensureDocker();
    const container = this.docker!.getContainer(containerId);
    await container.remove({ force: true });
    this.containers.delete(containerId);
  }

  async exec(containerId: string, command: string[]): Promise<ExecResult> {
    this.ensureDocker();
    const info = this.getContainerInfo(containerId);
    if (info.state !== 'running') {
      throw createSandboxError('EXEC_FAILED', '컨테이너가 실행 중이 아닙니다.');
    }

    const container = this.docker!.getContainer(containerId);
    const start = Date.now();

    const execInstance = await container.exec({
      Cmd: command,
      AttachStdout: true,
      AttachStderr: true,
      User: '1000:1000',
    });

    return new Promise<ExecResult>((resolve) => {
      let resolved = false;
      const safeResolve = (result: ExecResult): void => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        resolve(result);
      };

      const timeout = setTimeout(() => {
        safeResolve({
          exitCode: -1,
          stdout: '',
          stderr: '명령 실행 시간이 30초를 초과했습니다.',
          durationMs: Date.now() - start,
          timedOut: true,
        });
      }, DEFAULT_CONTAINER_CONFIG.execTimeoutMs);

      execInstance.start({ Detach: false }).then((stream) => {
        let stdout = '';
        let stderr = '';

        stream.on('data', (chunk: unknown) => {
          stdout += String(chunk);
        });
        stream.on('end', () => {
          info.lastActivityAt = new Date().toISOString();
          safeResolve({ exitCode: 0, stdout, stderr, durationMs: Date.now() - start, timedOut: false });
        });
        stream.on('error', (err: unknown) => {
          stderr = err instanceof Error ? err.message : String(err);
          safeResolve({ exitCode: 1, stdout, stderr, durationMs: Date.now() - start, timedOut: false });
        });
      }).catch((err: unknown) => {
        safeResolve({
          exitCode: 1, stdout: '', stderr: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - start, timedOut: false,
        });
      });
    });
  }

  getContainers(): ContainerInfo[] {
    return Array.from(this.containers.values());
  }

  getUserContainers(userId: string): ContainerInfo[] {
    return this.getContainers().filter(c => c.userId === userId);
  }

  async cleanup(): Promise<number> {
    const now = Date.now();
    let removed = 0;
    for (const [id, info] of this.containers) {
      const idle = now - new Date(info.lastActivityAt).getTime();
      if (idle > DEFAULT_CONTAINER_CONFIG.inactivityTimeoutMs && info.state === 'running') {
        try {
          await this.stop(id);
          await this.remove(id);
          removed++;
        } catch (err) {
          this.logger('warn', `Cleanup failed for ${id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
    return removed;
  }

  async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    for (const [id] of this.containers) {
      try {
        await this.remove(id);
      } catch { /* best effort */ }
    }
    this.containers.clear();
  }

  // ============================================================================
  // Private
  // ============================================================================

  private async loadDockerode(): Promise<DockerodeInstance> {
    try {
      const mod = 'dockerode';
      const imported = (await import(mod)) as { default: new () => DockerodeInstance };
      return new imported.default();
    } catch {
      throw createSandboxError('DOCKER_NOT_RUNNING',
        'dockerode 패키지가 설치되지 않았습니다. npm install dockerode');
    }
  }

  private async ping(): Promise<void> {
    try {
      await this.docker!.ping();
    } catch {
      throw createSandboxError('DOCKER_NOT_RUNNING',
        "Docker 데몬이 실행되지 않습니다. 'docker start' 또는 Docker Desktop을 실행해주세요.");
    }
  }

  private ensureDocker(): void {
    if (!this.docker) {
      throw createSandboxError('DOCKER_NOT_RUNNING', 'ContainerManager가 초기화되지 않았습니다. init()을 먼저 호출하세요.');
    }
  }

  private getContainerInfo(containerId: string): ContainerInfo {
    const info = this.containers.get(containerId);
    if (!info) {
      throw createSandboxError('CONTAINER_NOT_FOUND', `컨테이너를 찾을 수 없습니다: ${containerId}`);
    }
    return info;
  }

  private enforceContainerLimits(userId: string): void {
    const total = this.containers.size;
    if (total >= DEFAULT_CONTAINER_CONFIG.maxContainersTotal) {
      throw createSandboxError('MAX_CONTAINERS_REACHED', `최대 컨테이너 수(${DEFAULT_CONTAINER_CONFIG.maxContainersTotal})에 도달했습니다.`);
    }
    const userCount = this.getUserContainers(userId).length;
    if (userCount >= DEFAULT_CONTAINER_CONFIG.maxContainersPerUser) {
      throw createSandboxError('MAX_CONTAINERS_REACHED', `사용자당 최대 컨테이너 수(${DEFAULT_CONTAINER_CONFIG.maxContainersPerUser})에 도달했습니다.`);
    }
  }

  private startCleanupTimer(): void {
    // Check every 5 minutes
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch((err) => {
        this.logger('error', `Auto-cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
      });
    }, 5 * 60 * 1000);
  }
}
