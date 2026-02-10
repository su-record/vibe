/**
 * Container Security Config — Phase 5-1
 *
 * Rootless, read-only FS, dropped capabilities, seccomp, resource limits.
 */

import type { SecurityConfig, SeccompProfile } from './types.js';

// ============================================================================
// Default Seccomp Profile (deny io_uring, allow common syscalls)
// ============================================================================

export function getDefaultSeccompProfile(): SeccompProfile {
  return {
    defaultAction: 'SCMP_ACT_ERRNO',
    syscalls: [
      {
        names: [
          'read', 'write', 'open', 'close', 'stat', 'fstat', 'lstat',
          'poll', 'lseek', 'mmap', 'mprotect', 'munmap', 'brk',
          'ioctl', 'access', 'pipe', 'select', 'sched_yield',
          'dup', 'dup2', 'pause', 'nanosleep', 'getpid', 'socket',
          'connect', 'accept', 'sendto', 'recvfrom', 'bind', 'listen',
          'clone', 'fork', 'vfork', 'execve', 'exit', 'wait4',
          'kill', 'uname', 'fcntl', 'flock', 'fsync', 'fdatasync',
          'truncate', 'ftruncate', 'getdents', 'getcwd', 'chdir',
          'rename', 'mkdir', 'rmdir', 'link', 'unlink', 'symlink',
          'readlink', 'chmod', 'chown', 'umask', 'gettimeofday',
          'getuid', 'getgid', 'setuid', 'setgid', 'geteuid', 'getegid',
          'epoll_create', 'epoll_ctl', 'epoll_wait', 'epoll_create1',
          'eventfd', 'eventfd2', 'signalfd', 'timerfd_create',
          'futex', 'set_robust_list', 'get_robust_list',
          'clock_gettime', 'clock_getres', 'clock_nanosleep',
          'exit_group', 'set_tid_address', 'openat', 'mkdirat',
          'newfstatat', 'unlinkat', 'renameat', 'readlinkat',
          'pipe2', 'getrandom', 'memfd_create', 'statx',
          'pread64', 'pwrite64', 'writev', 'readv',
          'getdents64', 'prlimit64', 'arch_prctl',
          'setsockopt', 'getsockopt', 'getpeername', 'getsockname',
        ],
        action: 'SCMP_ACT_ALLOW',
      },
      {
        // Explicitly deny io_uring (CVE-2025-9002)
        names: ['io_uring_setup', 'io_uring_enter', 'io_uring_register'],
        action: 'SCMP_ACT_ERRNO',
      },
    ],
  };
}

// ============================================================================
// Default Security Config
// ============================================================================

export function getDefaultSecurityConfig(): SecurityConfig {
  return {
    readonlyRootfs: true,
    noNewPrivileges: true,
    dropCapabilities: ['ALL'],
    addCapabilities: ['CHOWN', 'SETUID', 'SETGID', 'DAC_OVERRIDE', 'NET_BIND_SERVICE'],
    seccompProfile: getDefaultSeccompProfile(),
    tmpfsMounts: [
      { destination: '/tmp', size: '256m' },
      { destination: '/workspace', size: '512m' },
    ],
    userNamespaceRemap: true,
    deviceAccess: false,
  };
}

// ============================================================================
// Docker HostConfig builder
// ============================================================================

export interface DockerHostConfig {
  ReadonlyRootfs: boolean;
  SecurityOpt: string[];
  CapDrop: string[];
  CapAdd: string[];
  Tmpfs: Record<string, string>;
  NanoCpus: number;
  Memory: number;
  PidsLimit: number;
  NetworkMode: string;
  Devices: never[];
  UsernsMode: string;
}

export function buildHostConfig(
  security: SecurityConfig,
  cpuLimit: number,
  memoryMb: number,
  pidLimit: number,
  networkMode: string,
): DockerHostConfig {
  const tmpfs: Record<string, string> = {};
  for (const mount of security.tmpfsMounts) {
    tmpfs[mount.destination] = `size=${mount.size},noexec,nosuid`;
  }

  return {
    ReadonlyRootfs: security.readonlyRootfs,
    SecurityOpt: [
      'no-new-privileges:true',
      `seccomp=${JSON.stringify(security.seccompProfile)}`,
    ],
    CapDrop: security.dropCapabilities,
    CapAdd: security.addCapabilities,
    Tmpfs: tmpfs,
    NanoCpus: cpuLimit * 1e9,
    Memory: memoryMb * 1024 * 1024,
    PidsLimit: pidLimit,
    NetworkMode: networkMode,
    Devices: [],
    UsernsMode: security.userNamespaceRemap ? 'host' : '',
  };
}

// ============================================================================
// Env variable filter (block dangerous vars)
// ============================================================================

const BLOCKED_ENV_PREFIXES = [
  'NODE_OPTIONS',
  'DYLD_',
  'LD_PRELOAD',
  'LD_LIBRARY_PATH',
  'DOCKER_HOST',
  'PYTHONPATH',
];

export function filterEnvVars(env: Record<string, string>): string[] {
  return Object.entries(env)
    .filter(([key]) => !BLOCKED_ENV_PREFIXES.some(prefix => key.startsWith(prefix)))
    .map(([key, value]) => `${key}=${value}`);
}
