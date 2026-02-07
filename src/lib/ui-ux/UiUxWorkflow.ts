/**
 * UI/UX 워크플로우 유틸리티
 *
 * /vibe.spec, /vibe.run, /vibe.review에서 UI/UX 에이전트
 * 활성화 여부를 판단하는 헬퍼 함수 모음.
 */

import { existsSync, readFileSync } from 'fs';
import { join, resolve, relative, isAbsolute } from 'path';
import { homedir } from 'os';

/** 프로젝트 이름 허용 패턴 (알파벳, 숫자, 하이픈, 언더스코어만) */
const SAFE_PROJECT_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

/** UI/UX 프로젝트 감지 키워드 */
const UI_UX_KEYWORDS: ReadonlySet<string> = new Set([
  'website', 'landing', 'dashboard', 'app', 'e-commerce', 'ecommerce',
  'portfolio', 'saas', 'mobile app', 'web app', 'ui', 'ux', 'frontend',
  'front-end', '디자인', '대시보드', '랜딩', '웹앱', '모바일앱',
]);

/** UI 파일 확장자 */
const UI_FILE_EXTENSIONS: ReadonlySet<string> = new Set([
  '.tsx', '.jsx', '.vue', '.svelte', '.html', '.css', '.scss',
  '.sass', '.less', '.styled.ts', '.styled.js',
]);

/** 데이터 시각화 키워드 */
const DATAVIZ_KEYWORDS: ReadonlySet<string> = new Set([
  'chart', 'graph', 'dashboard', 'visualization', 'dataviz',
  'analytics', 'metrics', 'kpi', '차트', '그래프', '시각화', '분석',
]);

/**
 * SPEC 컨텍스트에 UI/UX 키워드가 포함되어 있는지 감지합니다.
 *
 * @param specContent - SPEC 문서 전체 텍스트
 * @returns UI/UX 프로젝트 여부
 */
export function isUiUxProject(specContent: string): boolean {
  const lowerContent = specContent.toLowerCase();
  for (const keyword of UI_UX_KEYWORDS) {
    if (lowerContent.includes(keyword)) {
      return true;
    }
  }
  return false;
}

/**
 * 데이터 시각화 에이전트(⑤) 실행 여부를 판단합니다.
 *
 * @param specContent - SPEC 문서 전체 텍스트
 * @returns 데이터 시각화 관련 키워드 포함 여부
 */
export function shouldRunDataViz(specContent: string): boolean {
  const lowerContent = specContent.toLowerCase();
  for (const keyword of DATAVIZ_KEYWORDS) {
    if (lowerContent.includes(keyword)) {
      return true;
    }
  }
  return false;
}

/**
 * 변경된 파일 중 UI 파일이 존재하는지 확인합니다.
 *
 * @param changedFiles - 변경된 파일 경로 배열
 * @returns UI 파일 포함 여부
 */
export function hasUiFileChanges(changedFiles: string[]): boolean {
  return changedFiles.some((file) => {
    const lowerFile = file.toLowerCase();
    for (const ext of UI_FILE_EXTENSIONS) {
      if (lowerFile.endsWith(ext)) {
        return true;
      }
    }
    return false;
  });
}

/**
 * 프로젝트의 디자인 시스템 MASTER.md를 로드합니다.
 *
 * @param projectName - 프로젝트 이름
 * @param projectRoot - 프로젝트 루트 경로 (기본: process.cwd())
 * @returns MASTER.md 내용 또는 null
 */
export function loadDesignSystem(projectName: string, projectRoot?: string): string | null {
  if (!SAFE_PROJECT_NAME.test(projectName)) {
    return null;
  }

  const root = projectRoot ?? process.cwd();
  const baseDir = resolve(root, '.claude', 'vibe', 'design-system');
  const masterPath = resolve(baseDir, projectName, 'MASTER.md');

  // resolve 후 경로가 baseDir 밖이면 거부
  const rel = relative(baseDir, masterPath);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    return null;
  }

  if (!existsSync(masterPath)) {
    return null;
  }

  try {
    return readFileSync(masterPath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * UI/UX 분석 비활성화 여부를 확인합니다.
 *
 * @param projectRoot - 프로젝트 루트 경로 (기본: process.cwd())
 * @returns 비활성화 여부 (true = 비활성화됨)
 */
export function isUiUxAnalysisDisabled(projectRoot?: string): boolean {
  const root = projectRoot ?? process.cwd();
  const configPath = join(root, '.claude', 'vibe', 'config.json');

  if (!existsSync(configPath)) {
    return false;
  }

  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    return config['uiUxAnalysis'] === false;
  } catch {
    return false;
  }
}

/**
 * 글로벌 UI/UX 데이터가 설치되어 있는지 확인합니다.
 *
 * @returns 데이터 디렉토리 존재 여부
 */
export function isUiUxDataInstalled(): boolean {
  const globalDataDir = join(homedir(), '.claude', 'vibe', 'ui-ux-data');
  return existsSync(join(globalDataDir, 'version.json'));
}

/**
 * 페이지별 디자인 오버라이드를 로드합니다.
 *
 * @param projectName - 프로젝트 이름
 * @param page - 페이지 이름 (예: 'dashboard', 'checkout')
 * @param projectRoot - 프로젝트 루트 경로
 * @returns 페이지 오버라이드 내용 또는 null
 */
export function loadPageOverride(
  projectName: string,
  page: string,
  projectRoot?: string,
): string | null {
  if (!SAFE_PROJECT_NAME.test(projectName) || !SAFE_PROJECT_NAME.test(page)) {
    return null;
  }

  const root = projectRoot ?? process.cwd();
  const baseDir = resolve(root, '.claude', 'vibe', 'design-system');
  const pagePath = resolve(baseDir, projectName, 'pages', `${page}.md`);

  // resolve 후 경로가 baseDir 밖이면 거부
  const rel = relative(baseDir, pagePath);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    return null;
  }

  if (!existsSync(pagePath)) {
    return null;
  }

  try {
    return readFileSync(pagePath, 'utf-8');
  } catch {
    return null;
  }
}
