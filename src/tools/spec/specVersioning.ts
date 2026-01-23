/**
 * SPEC Versioning - SPEC 버전 관리 및 Changelog 자동 생성
 * v2.6.0: Git 연동 버전 관리
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// ============================================
// Types
// ============================================

/** SPEC 버전 정보 */
export interface SpecVersion {
  version: string;
  date: string;
  author?: string;
  changes: ChangeEntry[];
  gitTag?: string;
  gitCommit?: string;
}

/** 변경 항목 */
export interface ChangeEntry {
  type: 'added' | 'changed' | 'removed' | 'fixed';
  description: string;
  section?: string;
  requirementId?: string;
}

/** 버전 히스토리 */
export interface VersionHistory {
  featureName: string;
  currentVersion: string;
  versions: SpecVersion[];
}

/** 버전 범프 타입 */
export type BumpType = 'major' | 'minor' | 'patch';

// ============================================
// Version Management
// ============================================

/**
 * SPEC 버전 범프
 */
export function bumpSpecVersion(
  specPath: string,
  bumpType: BumpType,
  changes: ChangeEntry[]
): SpecVersion {
  const content = fs.readFileSync(specPath, 'utf-8');
  const currentVersion = extractVersion(content) || '0.0.0';
  const newVersion = incrementVersion(currentVersion, bumpType);

  // 프론트매터 업데이트
  const updatedContent = updateFrontmatterVersion(content, newVersion);
  fs.writeFileSync(specPath, updatedContent);

  const version: SpecVersion = {
    version: newVersion,
    date: new Date().toISOString().split('T')[0],
    changes,
  };

  return version;
}

/**
 * 버전 추출
 */
export function extractVersion(content: string): string | null {
  const match = content.match(/version:\s*['"]?(\d+\.\d+\.\d+)['"]?/);
  return match ? match[1] : null;
}

/**
 * 버전 증가
 */
export function incrementVersion(version: string, bumpType: BumpType): string {
  const parts = version.split('.').map(Number);
  switch (bumpType) {
    case 'major':
      return `${parts[0] + 1}.0.0`;
    case 'minor':
      return `${parts[0]}.${parts[1] + 1}.0`;
    case 'patch':
      return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  }
}

/**
 * 프론트매터 버전 업데이트
 */
function updateFrontmatterVersion(content: string, newVersion: string): string {
  const now = new Date().toISOString();

  // version 필드 업데이트 또는 추가
  if (content.match(/version:/)) {
    content = content.replace(/version:\s*['"]?\d+\.\d+\.\d+['"]?/, `version: ${newVersion}`);
  } else {
    // 프론트매터에 version 추가
    content = content.replace(/^(---\n)/, `$1version: ${newVersion}\n`);
  }

  // lastUpdated 업데이트
  if (content.match(/lastUpdated:/)) {
    content = content.replace(/lastUpdated:\s*[^\n]+/, `lastUpdated: ${now}`);
  }

  return content;
}

// ============================================
// Changelog Generation
// ============================================

/**
 * Changelog 생성
 */
export function generateChangelog(history: VersionHistory): string {
  let changelog = `# Changelog: ${history.featureName}\n\n`;
  changelog += `Current Version: ${history.currentVersion}\n\n`;

  for (const version of history.versions.slice().reverse()) {
    changelog += `## [${version.version}] - ${version.date}\n\n`;

    if (version.gitTag) {
      changelog += `Git Tag: ${version.gitTag}\n\n`;
    }

    // 타입별 그룹화
    const grouped = groupChangesByType(version.changes);

    for (const [type, entries] of Object.entries(grouped)) {
      changelog += `### ${capitalizeFirst(type)}\n\n`;
      for (const entry of entries) {
        const prefix = entry.requirementId ? `[${entry.requirementId}] ` : '';
        const section = entry.section ? ` (${entry.section})` : '';
        changelog += `- ${prefix}${entry.description}${section}\n`;
      }
      changelog += '\n';
    }
  }

  return changelog;
}

/**
 * 변경사항을 타입별로 그룹화
 */
function groupChangesByType(changes: ChangeEntry[]): Record<string, ChangeEntry[]> {
  const grouped: Record<string, ChangeEntry[]> = {};
  for (const change of changes) {
    if (!grouped[change.type]) {
      grouped[change.type] = [];
    }
    grouped[change.type].push(change);
  }
  return grouped;
}

// ============================================
// Git Integration
// ============================================

/**
 * Git 태그 생성
 */
export function createGitTag(
  featureName: string,
  version: string,
  message?: string
): { success: boolean; tag: string; error?: string } {
  const tag = `spec/${featureName}/v${version}`;
  const tagMessage = message || `SPEC ${featureName} version ${version}`;

  try {
    execSync(`git tag -a "${tag}" -m "${tagMessage}"`, { encoding: 'utf-8' });
    return { success: true, tag };
  } catch (error) {
    return {
      success: false,
      tag,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * SPEC 변경사항 감지 (Git diff 기반)
 */
export function detectSpecChanges(
  specPath: string,
  baseRef: string = 'HEAD~1'
): ChangeEntry[] {
  const changes: ChangeEntry[] = [];

  try {
    const diff = execSync(`git diff ${baseRef} -- "${specPath}"`, { encoding: 'utf-8' });

    // 추가된 라인 분석
    const addedLines = diff.match(/^\+[^+].*/gm) || [];
    for (const line of addedLines) {
      const cleanLine = line.slice(1).trim();
      if (cleanLine.match(/^- \[ \]/) || cleanLine.match(/^1\. \[ \]/)) {
        changes.push({
          type: 'added',
          description: cleanLine.replace(/^[-\d.]+\s*\[ \]\s*/, ''),
          section: 'Task',
        });
      }
    }

    // 삭제된 라인 분석
    const removedLines = diff.match(/^-[^-].*/gm) || [];
    for (const line of removedLines) {
      const cleanLine = line.slice(1).trim();
      if (cleanLine.match(/^- \[ \]/) || cleanLine.match(/^1\. \[ \]/)) {
        changes.push({
          type: 'removed',
          description: cleanLine.replace(/^[-\d.]+\s*\[ \]\s*/, ''),
          section: 'Task',
        });
      }
    }

  } catch {
    // Git diff 실패 (파일이 새로 생성됨 등)
    changes.push({
      type: 'added',
      description: 'Initial SPEC creation',
    });
  }

  return changes;
}

/**
 * 최신 SPEC 커밋 조회
 */
export function getLatestSpecCommit(specPath: string): string | null {
  try {
    const commit = execSync(`git log -1 --format=%H -- "${specPath}"`, { encoding: 'utf-8' });
    return commit.trim() || null;
  } catch {
    return null;
  }
}

/**
 * SPEC 버전 히스토리 로드
 */
export function loadVersionHistory(specDir: string, featureName: string): VersionHistory {
  const historyPath = path.join(specDir, `${featureName}.versions.json`);

  try {
    const content = fs.readFileSync(historyPath, 'utf-8');
    return JSON.parse(content) as VersionHistory;
  } catch {
    return {
      featureName,
      currentVersion: '0.0.0',
      versions: [],
    };
  }
}

/**
 * SPEC 버전 히스토리 저장
 */
export function saveVersionHistory(specDir: string, history: VersionHistory): void {
  const historyPath = path.join(specDir, `${history.featureName}.versions.json`);
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
}

/**
 * Baseline 태깅 (릴리즈 준비 완료 표시)
 */
export function createBaseline(
  featureName: string,
  specPath: string
): { success: boolean; baselineName: string; error?: string } {
  const content = fs.readFileSync(specPath, 'utf-8');
  const version = extractVersion(content) || '1.0.0';
  const timestamp = new Date().toISOString().replace(/[:-]/g, '').split('.')[0];
  const baselineName = `baseline/${featureName}-v${version}-${timestamp}`;

  try {
    // Baseline 커밋
    execSync(`git add "${specPath}"`, { encoding: 'utf-8' });
    execSync(`git commit -m "SPEC baseline: ${featureName} v${version}"`, { encoding: 'utf-8' });

    // Baseline 태그
    execSync(`git tag "${baselineName}" -m "Baseline for ${featureName} v${version}"`, { encoding: 'utf-8' });

    return { success: true, baselineName };
  } catch (error) {
    return {
      success: false,
      baselineName,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// Helpers
// ============================================

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
