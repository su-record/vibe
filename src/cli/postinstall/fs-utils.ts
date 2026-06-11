/**
 * 파일시스템 유틸리티
 */

import path from 'path';
import fs from 'fs';
import { getGlobalConfigDir } from '../../infra/lib/llm/auth/ConfigManager.js';

/**
 * 전역 vibe 설정 디렉토리 경로 (getCoreConfigDir = getGlobalConfigDir alias)
 */
export const getCoreConfigDir = getGlobalConfigDir;

/**
 * 디렉토리 내 모든 .md 파일에서 {{VIBE_PATH}} / {{VIBE_PATH_URL}} 템플릿 치환
 * - {{VIBE_PATH}}     → ~/.vibe  (forward slash)
 * - {{VIBE_PATH_URL}} → file:///~/.vibe/
 */
export function replaceTemplatesInDir(dirPath: string): void {
  const corePath = getCoreConfigDir().replace(/\\/g, '/');
  const corePathUrl = 'file:///' + corePath.replace(/^\//, '');

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      replaceTemplatesInDir(fullPath);
    } else if (entry.name.endsWith('.md')) {
      let content = fs.readFileSync(fullPath, 'utf-8');
      if (content.includes('{{VIBE_PATH_URL}}') || content.includes('{{VIBE_PATH}}')) {
        content = content.replace(/\{\{VIBE_PATH_URL\}\}/g, corePathUrl);
        content = content.replace(/\{\{VIBE_PATH\}\}/g, corePath);
        fs.writeFileSync(fullPath, content);
      }
    }
  }
}

/**
 * 디렉토리 생성 (재귀)
 */
export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Directories to skip during recursive copy */
const COPY_SKIP_DIRS = new Set(['node_modules', '.git']);

/**
 * 디렉토리 복사 (재귀, node_modules/.git 제외)
 */
export function copyDirRecursive(src: string, dest: string): void {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (COPY_SKIP_DIRS.has(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * 디렉토리 삭제 (재귀)
 */
export function removeDirRecursive(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * 스킬 복사 (항상 덮어쓰기 — 패키지 업데이트 시 최신 버전 반영)
 */
export function copySkillsOverwrite(src: string, dest: string): void {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copySkillsOverwrite(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * 레거시 스킬 디렉토리 삭제 (이름 변경된 구 디렉토리 정리)
 */
export function removeLegacySkills(
  skillsDir: string,
  legacyDirs: ReadonlyArray<string>,
): void {
  for (const name of legacyDirs) {
    const dir = path.join(skillsDir, name);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}

/**
 * 디렉토리 기반 스킬 모두 정리 — ~/.claude/vibe/skills/ 에 남아있는 {name}/ 디렉토리 제거
 * Claude Code가 ~/.claude/ 재귀 스캔 시 ~/.claude/skills/와 중복 발견되므로 제거 필요
 * flat .md 파일(인라인 스킬)은 유지
 */
export function cleanupDuplicateSkillDirs(skillsDir: string): void {
  if (!fs.existsSync(skillsDir)) return;
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    fs.rmSync(path.join(skillsDir, entry.name), { recursive: true, force: true });
  }
}

/**
 * 스킬 필터링 복사 — 허용 목록에 있는 스킬 디렉토리만 복사
 * @param src - 스킬 소스 디렉토리 (skills/)
 * @param dest - 설치 대상 디렉토리
 * @param allowedSkills - 복사할 스킬 이름 목록
 */
export function copySkillsFiltered(
  src: string,
  dest: string,
  allowedSkills: ReadonlyArray<string>,
): void {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!allowedSkills.includes(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    copySkillsOverwrite(srcPath, destPath);
  }
}

/**
 * optional 스킬 정리 결정 결과
 */
export type OptionalSkillAction = 'removed' | 'skipped-user-modified' | 'skipped-not-vibe' | 'notice';

export interface OptionalSkillResult {
  name: string;
  action: OptionalSkillAction;
  reason: string;
}

/**
 * 설치된 스킬이 vibe 소유인지 판단한다.
 *
 * 판단 기준 (보수적): 배송된 스킬 이름 집합에 포함되고
 * SKILL.md의 `name:` frontmatter가 디렉토리 이름과 일치하면 vibe 소유로 간주한다.
 * 조건을 하나라도 충족하지 못하면 false를 반환한다.
 */
function isVibeOwnedSkill(
  skillDir: string,
  skillName: string,
  vibeSkillNames: ReadonlySet<string>,
): boolean {
  if (!vibeSkillNames.has(skillName)) return false;
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) return false;
  const content = fs.readFileSync(skillMdPath, 'utf-8');
  const match = content.match(/^name:\s*(.+?)\s*$/m);
  return match !== null && match[1] === skillName;
}

/**
 * 설치된 스킬이 사용자에 의해 수정되었는지 판단한다.
 *
 * 배송된 스킬의 SKILL.md 내용과 설치된 것의 내용을 비교한다.
 * 배송 소스를 찾을 수 없으면 안전하게 수정됨으로 간주한다.
 */
function isUserModified(
  installedSkillDir: string,
  shippedSkillsDir: string,
  skillName: string,
): boolean {
  const installedPath = path.join(installedSkillDir, 'SKILL.md');
  const shippedPath = path.join(shippedSkillsDir, skillName, 'SKILL.md');
  if (!fs.existsSync(shippedPath)) return true; // 배송본 없음 → 보수적으로 수정됨 취급
  if (!fs.existsSync(installedPath)) return false;
  const installed = fs.readFileSync(installedPath, 'utf-8');
  const shipped = fs.readFileSync(shippedPath, 'utf-8');
  return installed !== shipped;
}

/**
 * 전역 스킬 디렉토리에서 optional 스킬을 정리한다.
 *
 * 안전 규칙:
 * - vibe 소유이고 (SKILL.md `name:` 매치)
 * - 배송된 내용과 동일(사용자 미수정)인 경우에만 삭제
 * - 그 외에는 notice 로그만 남기고 보존
 *
 * @param globalSkillsDir - 전역 CLI 스킬 디렉토리 (e.g. ~/.claude/skills)
 * @param optionalSkills - 정리 대상 스킬 이름 목록
 * @param shippedSkillsDir - 패키지 내 skills/ 디렉토리 (비교 기준)
 * @param dryRun - true이면 실제 삭제 없이 결과만 반환
 */
export function cleanupOptionalSkills(
  globalSkillsDir: string,
  optionalSkills: ReadonlyArray<string>,
  shippedSkillsDir: string,
  dryRun = false,
): OptionalSkillResult[] {
  const results: OptionalSkillResult[] = [];
  if (!fs.existsSync(globalSkillsDir)) return results;

  const vibeSkillNames = new Set(optionalSkills);

  for (const skillName of optionalSkills) {
    const skillDir = path.join(globalSkillsDir, skillName);
    if (!fs.existsSync(skillDir)) continue;

    if (!isVibeOwnedSkill(skillDir, skillName, vibeSkillNames)) {
      results.push({ name: skillName, action: 'skipped-not-vibe', reason: 'SKILL.md name mismatch — not vibe-owned' });
      continue;
    }

    if (isUserModified(skillDir, shippedSkillsDir, skillName)) {
      results.push({ name: skillName, action: 'skipped-user-modified', reason: 'SKILL.md differs from shipped — user-modified, preserved' });
      continue;
    }

    if (!dryRun) {
      fs.rmSync(skillDir, { recursive: true, force: true });
    }
    results.push({ name: skillName, action: 'removed', reason: 'vibe-owned optional skill, content unchanged' });
  }

  return results;
}

const CODEX_POLICY_MARKER = '# VIBE managed Codex skill policy';
const CODEX_POLICY_CONTENT = `${CODEX_POLICY_MARKER}
policy:
  allow_implicit_invocation: false
`;

function readUserInvocableFalse(skillPath: string): boolean {
  const raw = fs.readFileSync(skillPath, 'utf-8');
  const match = raw.match(/^user-invocable:\s*(true|false)\s*$/m);
  return match?.[1] === 'false';
}

function cleanupManagedCodexPolicy(skillDir: string): void {
  const metadataPath = path.join(skillDir, 'agents', 'openai.yaml');
  if (!fs.existsSync(metadataPath)) return;
  const raw = fs.readFileSync(metadataPath, 'utf-8');
  if (!raw.includes(CODEX_POLICY_MARKER)) return;
  fs.rmSync(metadataPath, { force: true });
  const agentsDir = path.dirname(metadataPath);
  if (fs.existsSync(agentsDir) && fs.readdirSync(agentsDir).length === 0) {
    fs.rmdirSync(agentsDir);
  }
}

function writeManagedCodexPolicy(skillDir: string): void {
  const agentsDir = path.join(skillDir, 'agents');
  const metadataPath = path.join(agentsDir, 'openai.yaml');
  if (fs.existsSync(metadataPath)) {
    const raw = fs.readFileSync(metadataPath, 'utf-8');
    if (!raw.includes(CODEX_POLICY_MARKER)) return;
  }
  ensureDir(agentsDir);
  fs.writeFileSync(metadataPath, CODEX_POLICY_CONTENT);
}

/**
 * Codex는 Vibe의 `user-invocable: false` 메타데이터를 직접 해석하지 않는다.
 * 내부 체인 전용 스킬은 공식 Codex skill policy로 implicit invocation을 막는다.
 */
export function applyCodexSkillInvocationPolicies(skillsDir: string): void {
  if (!fs.existsSync(skillsDir)) return;
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillDir = path.join(skillsDir, entry.name);
    const skillPath = path.join(skillDir, 'SKILL.md');
    if (!fs.existsSync(skillPath)) continue;
    if (readUserInvocableFalse(skillPath)) writeManagedCodexPolicy(skillDir);
    else cleanupManagedCodexPolicy(skillDir);
  }
}
