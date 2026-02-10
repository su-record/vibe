/**
 * ExecAllowlist Tests — Phase 5-6
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecAllowlist } from './ExecAllowlist.js';
import type { SandboxLogger } from './types.js';

// ============================================================================
// Tests
// ============================================================================

describe('ExecAllowlist', () => {
  let logger: SandboxLogger;
  let allowlist: ExecAllowlist;

  beforeEach(() => {
    logger = vi.fn();
    allowlist = new ExecAllowlist(logger);
  });

  describe('check', () => {
    it('기본 안전 바이너리 허용 (git)', () => {
      expect(allowlist.check('git status')).toBe('allowed');
    });

    it('기본 안전 바이너리 허용 (node)', () => {
      expect(allowlist.check('node --version')).toBe('allowed');
    });

    it('기본 안전 바이너리 허용 (npm)', () => {
      expect(allowlist.check('npm install')).toBe('allowed');
    });

    it('기본 안전 바이너리 허용 (grep)', () => {
      expect(allowlist.check('grep -r pattern')).toBe('allowed');
    });

    it('기본 안전 바이너리 허용 (ls)', () => {
      expect(allowlist.check('ls -la')).toBe('allowed');
    });

    it('기본 안전 바이너리 허용 (cat)', () => {
      expect(allowlist.check('cat file.txt')).toBe('allowed');
    });

    it('기본 안전 바이너리 허용 (curl)', () => {
      expect(allowlist.check('curl https://example.com')).toBe('allowed');
    });

    it('미등록 바이너리는 ask 반환', () => {
      expect(allowlist.check('python script.py')).toBe('ask');
    });

    it('전체경로로도 매칭 (basename)', () => {
      expect(allowlist.check('/usr/bin/git status')).toBe('allowed');
    });
  });

  describe('dangerous patterns', () => {
    it('리다이렉션 차단 (>)', () => {
      expect(allowlist.check('echo hello > file.txt')).toBe('denied');
    });

    it('파이프 차단 (|)', () => {
      expect(allowlist.check('cat file | grep test')).toBe('denied');
    });

    it('명령 치환 차단 ($())', () => {
      expect(allowlist.check('echo $(whoami)')).toBe('denied');
    });

    it('백틱 치환 차단', () => {
      expect(allowlist.check('echo `whoami`')).toBe('denied');
    });

    it('세미콜론 체이닝 차단', () => {
      expect(allowlist.check('ls; rm -rf /')).toBe('denied');
    });

    it('&& 체이닝 차단', () => {
      expect(allowlist.check('ls && rm -rf /')).toBe('denied');
    });

    it('|| 체이닝 차단', () => {
      expect(allowlist.check('ls || rm -rf /')).toBe('denied');
    });

    it('null byte injection 차단', () => {
      expect(allowlist.check('git\0 --help')).toBe('denied');
    });

    it('rm -rf 차단', () => {
      expect(allowlist.check('rm -rf /')).toBe('denied');
    });

    it('rm -Rf 차단', () => {
      expect(allowlist.check('rm -Rf /tmp')).toBe('denied');
    });

    it('kill -9 차단', () => {
      expect(allowlist.check('kill -9 1234')).toBe('denied');
    });

    it('chmod 777 차단', () => {
      expect(allowlist.check('chmod 777 /tmp/file')).toBe('denied');
    });

    it('dd 차단', () => {
      expect(allowlist.check('dd if=/dev/zero of=/dev/sda')).toBe('denied');
    });

    it('mkfs 차단', () => {
      expect(allowlist.check('mkfs.ext4 /dev/sda1')).toBe('denied');
    });

    it('/dev/ 접근 차단', () => {
      expect(allowlist.check('cat /dev/urandom')).toBe('denied');
    });

    it('/proc/ 접근 차단', () => {
      expect(allowlist.check('cat /proc/meminfo')).toBe('denied');
    });

    it('/sys/ 접근 차단', () => {
      expect(allowlist.check('cat /sys/class/net')).toBe('denied');
    });
  });

  describe('isDangerous', () => {
    it('안전한 명령은 false', () => {
      expect(allowlist.isDangerous('git status')).toBe(false);
      expect(allowlist.isDangerous('node --version')).toBe(false);
      expect(allowlist.isDangerous('ls -la')).toBe(false);
    });

    it('위험한 명령은 true', () => {
      expect(allowlist.isDangerous('rm -rf /')).toBe(true);
      expect(allowlist.isDangerous('echo hello > file')).toBe(true);
      expect(allowlist.isDangerous('cat /dev/zero')).toBe(true);
    });
  });

  describe('parseCommand', () => {
    it('단순 명령 파싱', () => {
      expect(allowlist.parseCommand('git status')).toEqual(['git', 'status']);
    });

    it('여러 인자 파싱', () => {
      expect(allowlist.parseCommand('node --version --help')).toEqual(['node', '--version', '--help']);
    });

    it('공백 정리', () => {
      expect(allowlist.parseCommand('  git   status  ')).toEqual(['git', 'status']);
    });

    it('빈 명령', () => {
      expect(allowlist.parseCommand('')).toEqual([]);
    });
  });

  describe('isInAllowlist', () => {
    it('basename으로 매칭', () => {
      expect(allowlist.isInAllowlist('git')).toBe(true);
      expect(allowlist.isInAllowlist('node')).toBe(true);
    });

    it('전체 경로로 매칭', () => {
      expect(allowlist.isInAllowlist('/usr/bin/git')).toBe(true);
      expect(allowlist.isInAllowlist('/usr/bin/node')).toBe(true);
    });

    it('미등록 바이너리', () => {
      expect(allowlist.isInAllowlist('python')).toBe(false);
      expect(allowlist.isInAllowlist('ruby')).toBe(false);
    });
  });

  describe('addEntry', () => {
    it('새 항목 추가', () => {
      allowlist.addEntry('python', 'Python runtime');
      expect(allowlist.check('python script.py')).toBe('allowed');
    });

    it('와일드카드 패턴 추가', () => {
      allowlist.addEntry('/usr/local/bin/*', 'Local binaries');
      expect(allowlist.isInAllowlist('/usr/local/bin/python')).toBe(true);
    });

    it('getEntries에 포함됨', () => {
      const before = allowlist.getEntries().length;
      allowlist.addEntry('ruby', 'Ruby runtime');
      expect(allowlist.getEntries().length).toBe(before + 1);
    });
  });

  describe('approval flow', () => {
    it('승인 요청 생성', () => {
      const request = allowlist.createApproval('python script.py', 'user-123');
      expect(request.requestId).toMatch(/^approval-/);
      expect(request.command).toBe('python script.py');
      expect(request.userId).toBe('user-123');
      expect(request.status).toBe('pending');
      expect(request.alwaysAllow).toBe(false);
    });

    it('대기 중인 승인 목록', () => {
      allowlist.createApproval('cmd1', 'user-1');
      allowlist.createApproval('cmd2', 'user-2');
      expect(allowlist.getPendingApprovals().length).toBe(2);
    });

    it('승인 해결 (approved)', () => {
      const request = allowlist.createApproval('python script.py', 'user-123');
      const resolved = allowlist.resolveApproval(request.requestId, 'approved');
      expect(resolved?.status).toBe('approved');
      expect(resolved?.respondedAt).toBeDefined();
      expect(allowlist.getPendingApprovals().length).toBe(0);
    });

    it('승인 해결 (denied)', () => {
      const request = allowlist.createApproval('bad-cmd', 'user-123');
      const resolved = allowlist.resolveApproval(request.requestId, 'denied');
      expect(resolved?.status).toBe('denied');
    });

    it('always-allow 시 자동 Allowlist 추가', () => {
      const request = allowlist.createApproval('python script.py', 'user-123');
      allowlist.resolveApproval(request.requestId, 'approved', true);
      expect(allowlist.check('python other.py')).toBe('allowed');
    });

    it('존재하지 않는 요청 ID 처리', () => {
      const resolved = allowlist.resolveApproval('nonexistent', 'approved');
      expect(resolved).toBeUndefined();
    });
  });

  describe('getEntries', () => {
    it('기본 엔트리 포함', () => {
      const entries = allowlist.getEntries();
      expect(entries.length).toBeGreaterThanOrEqual(10); // 10 default bins
      expect(entries.some(e => e.pattern.includes('git'))).toBe(true);
    });

    it('반환값은 복사본', () => {
      const entries1 = allowlist.getEntries();
      const entries2 = allowlist.getEntries();
      expect(entries1).not.toBe(entries2);
    });
  });

  describe('custom entries', () => {
    it('생성자에서 커스텀 엔트리 추가', () => {
      const custom = new ExecAllowlist(logger, [
        { pattern: 'python', description: 'Python', addedAt: '', addedBy: 'user' },
      ]);
      expect(custom.check('python script.py')).toBe('allowed');
    });
  });
});
