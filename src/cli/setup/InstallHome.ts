/**
 * 설치 대상 홈 해석 — `sudo npm install -g` 에서 자산이 엉뚱한 홈으로 가는 것을 막는다.
 *
 * 증상: 배포판 npm(prefix `/usr`)에 전역 설치하려면 sudo 가 필요하고, 그러면
 * postinstall 이 root 로 돌아 `os.homedir()` 가 `/root` 를 준다. 패키지와 CLI 는
 * 정상인데 `~/.claude/skills`·`~/.claude/agents` 만 비어 있는 상태가 된다 —
 * 자산은 `/root/.claude/` 에 설치됐고 정작 쓰는 사람은 그걸 보지 못한다.
 *
 * sudo 는 원래 사용자를 `SUDO_USER`/`SUDO_UID`/`SUDO_GID` 로 넘겨준다. 그 정보가
 * 있으면 그쪽 홈에 설치하고, 만들어진 트리의 소유권도 되돌려준다 — root 소유로
 * 남기면 이후 사용자가 자기 설정을 고칠 수 없다.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

export interface InstallHome {
  /** 자산을 설치할 홈 디렉토리 */
  home: string;
  /** sudo 로 승격된 경우 원래 사용자의 uid — 소유권 복원에 쓴다 */
  uid?: number;
  /** 위와 동일한 gid */
  gid?: number;
  /** sudo 승격이 감지되어 홈을 되돌렸는지 */
  redirected: boolean;
}

/** /etc/passwd 에서 사용자의 홈을 찾는다. 실패하면 null. */
function homeFromPasswd(user: string): string | null {
  try {
    for (const line of fs.readFileSync('/etc/passwd', 'utf-8').split('\n')) {
      const fields = line.split(':');
      if (fields[0] === user && fields[5]) return fields[5];
    }
  } catch { /* 읽을 수 없으면 관례로 폴백 */ }
  return null;
}

/** 플랫폼 관례상의 홈 경로 */
function conventionalHome(user: string): string {
  return process.platform === 'darwin' ? `/Users/${user}` : `/home/${user}`;
}

function parseId(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
}

/**
 * 자산을 설치할 홈을 정한다.
 *
 * sudo 로 root 가 된 경우에만 원래 사용자 홈으로 되돌린다. 진짜 root 설치
 * (SUDO_USER 없음)는 그대로 `/root` 를 쓴다 — 되돌릴 대상이 없다.
 */
export function resolveInstallHome(): InstallHome {
  const fallback: InstallHome = { home: os.homedir(), redirected: false };

  const sudoUser = process.env.SUDO_USER;
  if (!sudoUser || sudoUser === 'root') return fallback;

  // 실제로 승격된 상태에서만 되돌린다 — getuid 가 없는 플랫폼은 판단하지 않는다
  const uid = process.getuid?.();
  if (uid !== 0) return fallback;

  const home = homeFromPasswd(sudoUser) ?? conventionalHome(sudoUser);
  if (!fs.existsSync(home)) return fallback;

  return {
    home,
    uid: parseId(process.env.SUDO_UID),
    gid: parseId(process.env.SUDO_GID),
    redirected: true,
  };
}

/**
 * root 가 만든 트리의 소유권을 원래 사용자에게 되돌린다.
 *
 * 실패해도 설치를 중단하지 않는다 — 자산이 있는 편이 없는 것보다 낫고,
 * 소유권은 사용자가 나중에 고칠 수 있다.
 *
 * @returns 소유권을 바꿨으면 true
 */
export function restoreOwnership(target: string, info: InstallHome): boolean {
  if (!info.redirected || info.uid === undefined || info.gid === undefined) return false;
  if (!fs.existsSync(target)) return false;

  try {
    chownRecursive(target, info.uid, info.gid);
    return true;
  } catch {
    return false;
  }
}

function chownRecursive(target: string, uid: number, gid: number): void {
  fs.chownSync(target, uid, gid);
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(target, { withFileTypes: true });
  } catch {
    return; // 파일이거나 읽을 수 없음
  }
  for (const entry of entries) {
    const child = path.join(target, entry.name);
    if (entry.isDirectory()) chownRecursive(child, uid, gid);
    else {
      try { fs.chownSync(child, uid, gid); } catch { /* 개별 실패는 무시 */ }
    }
  }
}
