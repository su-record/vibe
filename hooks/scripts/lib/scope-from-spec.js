/**
 * Scope synthesizer — derive allow-glob patterns from active SPECs.
 *
 * 활성 SPEC(`.claude/vibe/specs/*.md` with frontmatter status ∈ pending|in-progress|active)을
 * 스캔해 백틱으로 감싼 파일 경로를 수집 → `<dir>/**` glob으로 변환한다.
 *
 * 수동 편집된 scope.json은 건드리지 않는다 — `auto: true` 플래그가 있는 파일만 덮어쓴다.
 */

import fs from 'fs';
import path from 'path';

const ACTIVE_STATUSES = new Set(['pending', 'in-progress', 'in_progress', 'active', 'running']);

/**
 * Vibe 에셋 루트 해석 — `.vibe/` (SSOT) 우선, legacy `.claude/vibe/`, `.coco/vibe/` fallback.
 * 반환값은 projectDir 기준 상대 경로 문자열 (예: `.vibe`, `.claude/vibe`).
 */
function detectVibeRoot(projectDir) {
  try {
    if (fs.existsSync(path.join(projectDir, '.vibe'))) return '.vibe';
    if (fs.existsSync(path.join(projectDir, '.claude', 'vibe'))) return '.claude/vibe';
    if (fs.existsSync(path.join(projectDir, '.coco', 'vibe'))) return '.coco/vibe';
  } catch { /* ignore */ }
  return '.vibe';
}

// 항상 허용: SPEC/plan/TODO 등 메타 문서는 구현 중에도 갱신 가능해야 함
function defaultAllow(projectDir) {
  return [`${detectVibeRoot(projectDir)}/**`, 'CLAUDE.md', 'AGENTS.md'];
}

function readFrontmatter(content) {
  if (!content.startsWith('---')) return {};
  const end = content.indexOf('\n---', 3);
  if (end < 0) return {};
  const block = content.slice(3, end);
  const out = {};
  for (const line of block.split('\n')) {
    const m = line.match(/^([a-zA-Z_][\w-]*)\s*:\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

/**
 * 본문에서 백틱으로 감싼 파일 경로 후보 추출.
 *  - 확장자 있는 경로 (foo.ts, hooks/scripts/bar.js)
 *  - 슬래시 포함 상대경로 (src/cli/commands)
 *  - 절대경로(/etc/...) 및 URL(http://...) 제외
 */
// 허용 파일명 확장자 (실제 소스/자산). SPEC에 적힌 임의 토큰을 걸러낸다.
const ALLOWED_EXTS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'md', 'mdx',
  'css', 'scss', 'sass', 'less', 'html', 'yaml', 'yml', 'toml',
  'py', 'rs', 'go', 'java', 'kt', 'rb', 'php', 'swift', 'c', 'cpp', 'h', 'hpp',
  'sh', 'bash', 'sql', 'env', 'feature', 'txt', 'svg', 'png', 'jpg', 'webp',
]);

function extractPaths(markdown) {
  const paths = new Set();
  const backtickRe = /`([^`\n]+)`/g;
  let m;
  while ((m = backtickRe.exec(markdown)) !== null) {
    const raw = m[1].trim();
    if (!raw || raw.length > 200) continue;
    if (raw.startsWith('/') || raw.startsWith('~')) continue; // 시스템/홈
    if (raw.startsWith('http') || raw.includes('://')) continue;
    if (/[\s{}[\]()<>`'"=,;|&$?!*@#%^+]/.test(raw)) continue; // 코드/템플릿/속성 접근자

    const hasSlash = raw.includes('/');
    const extMatch = raw.match(/\.([a-zA-Z0-9]{1,6})$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : null;

    // 확장자 있으면 화이트리스트 체크, 없으면 디렉토리로 간주 (슬래시 필수)
    if (ext) {
      if (!ALLOWED_EXTS.has(ext)) continue;
    } else {
      if (!hasSlash) continue;
    }

    // 명백한 비경로 제외
    if (/^[A-Z_]+$/.test(raw)) continue; // 상수
    if (/^\d+$/.test(raw)) continue; // 숫자
    if (raw.startsWith('.') && !raw.startsWith('./') && !raw.startsWith('.vibe') && !raw.startsWith('.claude') && !raw.startsWith('.coco')) continue;

    const normalized = raw.replace(/^\.\//, '').replace(/\\/g, '/');
    // 각 세그먼트 안전성 재검증 — "a.b.c" 같은 필드 경로 제거
    const segments = normalized.split('/');
    const lastSeg = segments[segments.length - 1];
    // 파일명에 점이 2개 이상이면 보통 필드 경로 (except .test.ts, .d.ts 같은 허용 패턴)
    const dotCount = (lastSeg.match(/\./g) || []).length;
    if (dotCount > 2) continue;
    if (dotCount === 2 && !/\.(test|spec|d|config|module|stories)\.[a-z]+$/i.test(lastSeg)) continue;

    paths.add(normalized);
  }
  return [...paths];
}

/**
 * 경로 목록 → glob 패턴 집합.
 *  - 확장자 있는 파일: dirname을 `<dir>/**`로
 *  - 디렉토리(확장자 없음, 슬래시 포함): `<path>/**`
 *  - 최상위 파일은 그대로 포함
 */
function pathsToGlobs(paths) {
  const globs = new Set();
  for (const p of paths) {
    const hasExt = /\.[a-zA-Z0-9]{1,6}$/.test(p);
    if (hasExt) {
      const dir = path.posix.dirname(p);
      if (dir && dir !== '.') globs.add(`${dir}/**`);
      else globs.add(p);
    } else {
      const trimmed = p.replace(/\/+$/, '');
      globs.add(`${trimmed}/**`);
    }
  }
  return collapseDominated([...globs]);
}

/**
 * `a/**`가 `a/b/**`를 포함하면 후자 제거.
 */
function collapseDominated(globs) {
  const sorted = [...new Set(globs)].sort((a, b) => a.length - b.length);
  const kept = [];
  for (const g of sorted) {
    const base = g.replace(/\/\*\*$/, '');
    const dominated = kept.some(k => {
      const kb = k.replace(/\/\*\*$/, '');
      return g !== k && g.endsWith('/**') && k.endsWith('/**') && (base === kb || base.startsWith(kb + '/'));
    });
    if (!dominated) kept.push(g);
  }
  return kept;
}

/**
 * 프로젝트의 활성 SPEC 목록 수집.
 */
export function findActiveSpecs(projectDir) {
  const specsDir = path.join(projectDir, detectVibeRoot(projectDir), 'specs');
  if (!fs.existsSync(specsDir)) return [];
  const results = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.md')) results.push(full);
    }
  };
  walk(specsDir);
  return results.filter(f => {
    try {
      const content = fs.readFileSync(f, 'utf-8');
      const fm = readFrontmatter(content);
      const status = (fm.status || '').toLowerCase();
      if (!fm.status) return true; // status 없으면 활성 간주
      return ACTIVE_STATUSES.has(status);
    } catch { return false; }
  });
}

/**
 * SPEC 파일 목록 → scope.json 객체.
 */
export function synthesizeScope(specFiles, { projectDir } = {}) {
  const allPaths = new Set();
  const sourceNames = [];
  for (const f of specFiles) {
    try {
      const content = fs.readFileSync(f, 'utf-8');
      for (const p of extractPaths(content)) allPaths.add(p);
      sourceNames.push(path.relative(projectDir || '.', f).replace(/\\/g, '/'));
    } catch { /* ignore */ }
  }
  const derived = pathsToGlobs([...allPaths]);
  // 파일시스템 검증: 디렉토리 glob은 실제 존재할 때만 포함. 파일은 파일명만
  // 있을 수 있으므로 (중첩 경로의 basename), 확장자 있으면 통과.
  const verified = projectDir
    ? derived.filter(g => {
      if (!g.endsWith('/**')) return true; // 파일은 유지
      const base = g.replace(/\/\*\*$/, '');
      try { return fs.existsSync(path.join(projectDir, base)); }
      catch { return false; }
    })
    : derived;
  const allow = collapseDominated([...defaultAllow(projectDir || '.'), ...verified]);
  return {
    auto: true,
    mode: 'warn',
    allow,
    deny: [],
    reason: sourceNames.length > 0
      ? `auto-derived from active SPECs: ${sourceNames.join(', ')}`
      : 'auto-derived (no active SPECs found)',
    generatedAt: new Date().toISOString(),
    sources: sourceNames,
  };
}

/**
 * scope.json을 활성 SPEC 기반으로 동기화.
 *  - 파일 없음 → 생성 (활성 SPEC이 있을 때만)
 *  - 파일 있음 + `auto: true` → 갱신
 *  - 파일 있음 + `auto` 없거나 false → 수동 관리 중, 건드리지 않음
 *
 * @returns {{ action: 'created'|'updated'|'skipped-manual'|'skipped-no-specs'|'unchanged', path: string }}
 */
export function syncScopeFile(projectDir) {
  const scopePath = path.join(projectDir, detectVibeRoot(projectDir), 'scope.json');
  const specs = findActiveSpecs(projectDir);

  // 기존 파일이 수동 관리면 스킵
  if (fs.existsSync(scopePath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(scopePath, 'utf-8'));
      if (existing.auto !== true) {
        return { action: 'skipped-manual', path: scopePath };
      }
    } catch { /* 파싱 실패 → 자동 생성 덮어쓰기 */ }
  }

  if (specs.length === 0) {
    // 자동 파일만 있고 활성 SPEC 없음 → 제거
    if (fs.existsSync(scopePath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(scopePath, 'utf-8'));
        if (existing.auto === true) {
          fs.unlinkSync(scopePath);
          return { action: 'removed', path: scopePath };
        }
      } catch { /* ignore */ }
    }
    return { action: 'skipped-no-specs', path: scopePath };
  }

  const next = synthesizeScope(specs, { projectDir });
  const nextStr = JSON.stringify(next, null, 2);

  // 변경 없음 체크 (generatedAt 제외)
  if (fs.existsSync(scopePath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(scopePath, 'utf-8'));
      const { generatedAt: _a, ...exRest } = existing;
      const { generatedAt: _b, ...nextRest } = next;
      if (JSON.stringify(exRest) === JSON.stringify(nextRest)) {
        return { action: 'unchanged', path: scopePath };
      }
    } catch { /* ignore */ }
  }

  const existed = fs.existsSync(scopePath);
  fs.mkdirSync(path.dirname(scopePath), { recursive: true });
  fs.writeFileSync(scopePath, nextStr + '\n', 'utf-8');
  return { action: existed ? 'updated' : 'created', path: scopePath };
}

// CLI 엔트리: `node hooks/scripts/lib/scope-from-spec.js [projectDir]`
// init/update나 스크립트에서 자동 동기화 용도로 직접 호출 가능.
import { fileURLToPath } from 'url';
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2] || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const result = syncScopeFile(dir);
  const label = {
    created: '✓ scope.json created',
    updated: '✓ scope.json updated',
    unchanged: '· scope.json unchanged',
    removed: '✓ scope.json removed (no active SPECs)',
    'skipped-manual': '· scope.json is manually managed (auto=false)',
    'skipped-no-specs': '· no active SPECs — scope.json not generated',
  }[result.action] || result.action;
  console.log(`[scope-sync] ${label}`);
}
