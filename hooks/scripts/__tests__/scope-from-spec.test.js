/**
 * scope-from-spec.js 단위 테스트
 *
 * REQ-harness-remediation-009: scope-guard 기본 활성화
 *  - enabled 미설정(undefined) → sync 실행 (기본 ON)
 *  - enabled === false → skip (명시적 opt-out)
 *  - SPEC 없음 → scope.json 생성 안 함 (노이즈 가드)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { isScopeGuardEnabled, syncScopeFile, findActiveSpecs } from '../lib/scope-from-spec.js';

// 임시 프로젝트 디렉토리 헬퍼
function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-scope-test-'));
}

function cleanDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

// config.json 작성 헬퍼
function writeConfig(dir, scopeGuard) {
  const vibeDir = path.join(dir, '.vibe');
  fs.mkdirSync(vibeDir, { recursive: true });
  fs.writeFileSync(path.join(vibeDir, 'config.json'), JSON.stringify({ scopeGuard }));
}

// 최소 SPEC 작성 헬퍼
function writeSpec(dir, filename, content, status = 'in-progress') {
  const specsDir = path.join(dir, '.vibe', 'specs');
  fs.mkdirSync(specsDir, { recursive: true });
  const frontmatter = status ? `---\nstatus: ${status}\n---\n` : '';
  fs.writeFileSync(path.join(specsDir, filename), frontmatter + (content || ''));
}

// ══════════════════════════════════════════════════
// isScopeGuardEnabled — 기본 ON 동작
// ══════════════════════════════════════════════════
describe('isScopeGuardEnabled', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanDir(tmpDir); });

  it('config 없음 → true (기본 ON)', () => {
    expect(isScopeGuardEnabled(tmpDir)).toBe(true);
  });

  it('scopeGuard 키 없는 config → true', () => {
    writeConfig(tmpDir, undefined);
    expect(isScopeGuardEnabled(tmpDir)).toBe(true);
  });

  it('scopeGuard.enabled 없는 config → true', () => {
    const vibeDir = path.join(tmpDir, '.vibe');
    fs.mkdirSync(vibeDir, { recursive: true });
    fs.writeFileSync(path.join(vibeDir, 'config.json'), JSON.stringify({ scopeGuard: {} }));
    expect(isScopeGuardEnabled(tmpDir)).toBe(true);
  });

  it('scopeGuard.enabled=true → true', () => {
    writeConfig(tmpDir, { enabled: true });
    expect(isScopeGuardEnabled(tmpDir)).toBe(true);
  });

  it('scopeGuard.enabled=false → false (명시적 opt-out)', () => {
    writeConfig(tmpDir, { enabled: false });
    expect(isScopeGuardEnabled(tmpDir)).toBe(false);
  });

  it('legacy .claude/vibe/config.json에서도 enabled=false 인식', () => {
    const legacyDir = path.join(tmpDir, '.claude', 'vibe');
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(path.join(legacyDir, 'config.json'), JSON.stringify({ scopeGuard: { enabled: false } }));
    expect(isScopeGuardEnabled(tmpDir)).toBe(false);
  });
});

// ══════════════════════════════════════════════════
// syncScopeFile — 노이즈 가드: SPEC 없으면 생성 안 함
// ══════════════════════════════════════════════════
describe('syncScopeFile — no specs → no scope created', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanDir(tmpDir); });

  it('SPEC 없음 → skipped-no-specs, scope.json 미생성', () => {
    fs.mkdirSync(path.join(tmpDir, '.vibe'), { recursive: true });
    const result = syncScopeFile(tmpDir);
    expect(result.action).toBe('skipped-no-specs');
    expect(fs.existsSync(path.join(tmpDir, '.vibe', 'scope.json'))).toBe(false);
  });

  it('specs 디렉토리 없음 → skipped-no-specs', () => {
    const result = syncScopeFile(tmpDir);
    expect(result.action).toBe('skipped-no-specs');
  });
});

// ══════════════════════════════════════════════════
// syncScopeFile — SPEC 있을 때 sync 실행
// ══════════════════════════════════════════════════
describe('syncScopeFile — spec exists → scope created', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanDir(tmpDir); });

  // 파생 glob은 실존 디렉토리만 통과하므로, 참조 경로를 실제로 만들어 준다
  function materialize(dir, relFile) {
    const full = path.join(dir, relFile);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, '');
  }

  it('활성 SPEC 있음 → scope.json 생성', () => {
    writeSpec(tmpDir, 'feature.md', 'edit `src/cli/index.ts`');
    materialize(tmpDir, 'src/cli/index.ts');
    const result = syncScopeFile(tmpDir);
    expect(result.action).toBe('created');
    const scopeJson = path.join(tmpDir, '.vibe', 'scope.json');
    expect(fs.existsSync(scopeJson)).toBe(true);
    const scope = JSON.parse(fs.readFileSync(scopeJson, 'utf-8'));
    expect(scope.auto).toBe(true);
    expect(Array.isArray(scope.allow)).toBe(true);
  });

  it('status 없는 최근 SPEC은 활성 간주 → scope.json 생성', () => {
    writeSpec(tmpDir, 'no-status.md', 'modify `hooks/scripts/foo.js`', null);
    materialize(tmpDir, 'hooks/scripts/foo.js');
    const result = syncScopeFile(tmpDir);
    expect(result.action).toBe('created');
  });

  it('status 없는 오래된 SPEC(>14일)은 비활성 → skipped-no-specs', () => {
    writeSpec(tmpDir, 'stale.md', 'modify `hooks/scripts/foo.js`', null);
    materialize(tmpDir, 'hooks/scripts/foo.js');
    const old = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    fs.utimesSync(path.join(tmpDir, '.vibe', 'specs', 'stale.md'), old, old);
    const result = syncScopeFile(tmpDir);
    expect(result.action).toBe('skipped-no-specs');
  });

  it('활성 SPEC에 산출 가능한 경로 없음 → skipped-no-paths, scope.json 미생성', () => {
    writeSpec(tmpDir, 'no-paths.md', 'just prose, `nonexistent/dir/file` reference only');
    const result = syncScopeFile(tmpDir);
    expect(result.action).toBe('skipped-no-paths');
    expect(fs.existsSync(path.join(tmpDir, '.vibe', 'scope.json'))).toBe(false);
  });

  it('경로 산출 불가로 전환되면 기존 auto scope.json 제거', () => {
    writeSpec(tmpDir, 'feature.md', 'edit `src/cli/index.ts`');
    materialize(tmpDir, 'src/cli/index.ts');
    syncScopeFile(tmpDir); // 생성
    fs.rmSync(path.join(tmpDir, 'src'), { recursive: true, force: true });
    const result = syncScopeFile(tmpDir);
    expect(result.action).toBe('removed');
    expect(fs.existsSync(path.join(tmpDir, '.vibe', 'scope.json'))).toBe(false);
  });

  it('completed SPEC만 있을 때 → skipped-no-specs (비활성 SPEC은 제외)', () => {
    writeSpec(tmpDir, 'done.md', 'edit `src/foo.ts`', 'completed');
    const result = syncScopeFile(tmpDir);
    expect(result.action).toBe('skipped-no-specs');
  });

  it('수동 관리 scope.json(auto:false) → 건드리지 않음', () => {
    writeSpec(tmpDir, 'feature.md', 'edit `src/bar.ts`');
    const scopeDir = path.join(tmpDir, '.vibe');
    fs.mkdirSync(scopeDir, { recursive: true });
    const manual = { auto: false, mode: 'block', allow: ['src/**'], deny: [] };
    fs.writeFileSync(path.join(scopeDir, 'scope.json'), JSON.stringify(manual));
    const result = syncScopeFile(tmpDir);
    expect(result.action).toBe('skipped-manual');
    const existing = JSON.parse(fs.readFileSync(path.join(scopeDir, 'scope.json'), 'utf-8'));
    expect(existing.mode).toBe('block'); // 원본 유지
  });

  it('활성 SPEC 제거 후 재호출 → auto scope.json 삭제', () => {
    writeSpec(tmpDir, 'feature.md', 'edit `src/cli/index.ts`');
    materialize(tmpDir, 'src/cli/index.ts');
    syncScopeFile(tmpDir); // 생성
    // specs 디렉토리 비우기
    fs.rmSync(path.join(tmpDir, '.vibe', 'specs'), { recursive: true, force: true });
    const result = syncScopeFile(tmpDir);
    expect(result.action).toBe('removed');
    expect(fs.existsSync(path.join(tmpDir, '.vibe', 'scope.json'))).toBe(false);
  });
});

// ══════════════════════════════════════════════════
// findActiveSpecs — legacy .claude/vibe/specs 폴백
// ══════════════════════════════════════════════════
describe('findActiveSpecs — resolution order', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(() => { cleanDir(tmpDir); });

  it('.vibe/specs 우선', () => {
    writeSpec(tmpDir, 'main.md', 'content');
    const specs = findActiveSpecs(tmpDir);
    expect(specs.length).toBe(1);
    expect(specs[0]).toContain('.vibe');
  });

  it('.vibe 없고 .claude/vibe/specs 있으면 legacy 사용', () => {
    const legacySpecsDir = path.join(tmpDir, '.claude', 'vibe', 'specs');
    fs.mkdirSync(legacySpecsDir, { recursive: true });
    fs.writeFileSync(path.join(legacySpecsDir, 'old.md'), '---\nstatus: in-progress\n---\ncontent');
    const specs = findActiveSpecs(tmpDir);
    expect(specs.length).toBe(1);
    expect(specs[0]).toContain('.claude');
  });
});
