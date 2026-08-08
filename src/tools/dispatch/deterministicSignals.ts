/**
 * 디스패처 결정론 신호 — `/vibe` Phase 0~2 가 모델 판단 없이 확정할 수 있는 것들.
 *
 * 배경: 의도 분류처럼 애매한 판단은 모델의 일이지만, "파일이 있는가", "이 URL 이
 * figma 인가", "이 첨부가 이미지인가" 는 `fs.existsSync` 와 문자열 검사로 끝난다.
 * 그런데 `/vibe` SKILL.md 는 이것들까지 마크다운 표로 적어 모델에게 시켰다 —
 * 매 호출마다 토큰을 쓰고, 하네스마다 결과가 달라질 수 있으며, 검증도 불가능하다.
 *
 * 여기서 확정한 신호는 디스패처가 **사실**로 받고, 모델은 그 위에서 의도만 고른다.
 * (분류 자체를 대체하지 않는다 — 애매한 판단은 그대로 모델 몫이다.)
 */
import fs from 'fs';
import path from 'path';

export type AttachmentKind = 'spec' | 'feature' | 'document' | 'image' | 'code' | 'unknown';
export type UrlKind = 'figma' | 'github' | 'youtube' | 'web';

export interface ResumeState {
  /** `.vibe/.last-feature` 에 기록된 직전 feature */
  lastFeature: string | null;
  /** 확인한 feature 이름 (인자 우선, 없으면 lastFeature) */
  feature: string | null;
  specPath: string | null;
  featurePath: string | null;
  /** spec 이 있으면 run 부터, 둘 다 없으면 처음부터 */
  resumeFrom: 'spec' | 'run' | 'none';
  /** 입력 컨텍스트로만 쓰는 구버전 산출물 (재생성 금지) */
  legacyArtifacts: string[];
}

export interface StakesSignals {
  /** `.vibe/config.json` 이 없는 디렉토리 — demo 신호 */
  hasVibeConfig: boolean;
  /** OS 임시 디렉토리 하위 — demo 신호 */
  isTempDir: boolean;
  /** git 저장소 여부 — 기존 프로젝트 코드 위 작업인지 */
  isGitRepo: boolean;
}

export interface DispatchSignals {
  projectRoot: string;
  resume: ResumeState;
  stakes: StakesSignals;
  urls: Array<{ url: string; kind: UrlKind }>;
  attachments: Array<{ path: string; kind: AttachmentKind; exists: boolean }>;
}

/** 우선순위대로 첫 번째로 존재하는 상대 경로 */
function firstExisting(projectRoot: string, candidates: string[]): string | null {
  for (const rel of candidates) {
    if (fs.existsSync(path.join(projectRoot, rel))) return rel;
  }
  return null;
}

function readLastFeature(projectRoot: string): string | null {
  try {
    const raw = fs.readFileSync(path.join(projectRoot, '.vibe', '.last-feature'), 'utf-8').trim();
    return raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Smart Resume — `/vibe` Phase 2 의 파일 존재 검사를 코드로 확정한다.
 */
export function detectResumeState(projectRoot: string, feature?: string): ResumeState {
  const lastFeature = readLastFeature(projectRoot);
  const name = feature ?? lastFeature;

  if (!name) {
    return { lastFeature, feature: null, specPath: null, featurePath: null, resumeFrom: 'none', legacyArtifacts: [] };
  }

  const specPath = firstExisting(projectRoot, [
    path.join('.vibe', 'specs', `${name}.md`),
    path.join('.vibe', 'specs', name, '_index.md'),
  ]);
  const featurePath = firstExisting(projectRoot, [
    path.join('.vibe', 'features', `${name}.feature`),
    path.join('.vibe', 'features', name),
  ]);

  // 구버전 산출물 — 입력 컨텍스트로만 쓰고 재생성하지 않는다
  const legacyArtifacts = [
    path.join('.vibe', 'plans', `${name}.md`),
    path.join('.vibe', 'interviews', `${name}.md`),
  ].filter(rel => fs.existsSync(path.join(projectRoot, rel)));

  return {
    lastFeature,
    feature: name,
    specPath,
    featurePath,
    resumeFrom: specPath ? 'run' : 'none',
    legacyArtifacts,
  };
}

/**
 * stakes 판정의 **결정론 신호만** 확정한다.
 * 명시 키워드·닫힌 표현 같은 언어 신호는 모델 몫으로 남긴다 (SSOT: loop-contract Stakes 표).
 */
export function detectStakesSignals(projectRoot: string): StakesSignals {
  const tmpRoots = [process.env.TMPDIR, '/tmp', '/var/folders'].filter(Boolean) as string[];
  const resolved = path.resolve(projectRoot);
  return {
    hasVibeConfig: fs.existsSync(path.join(projectRoot, '.vibe', 'config.json')),
    isTempDir: tmpRoots.some(root => resolved.startsWith(path.resolve(root) + path.sep)),
    isGitRepo: fs.existsSync(path.join(projectRoot, '.git')),
  };
}

/** URL 을 도메인으로 분류한다 — 모델이 문자열을 눈으로 보고 고르지 않도록. */
export function classifyUrl(url: string): UrlKind {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return 'web';
  }
  if (host === 'figma.com' || host.endsWith('.figma.com')) return 'figma';
  if (host === 'github.com' || host.endsWith('.github.com')) return 'github';
  if (host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com')) return 'youtube';
  return 'web';
}

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp']);
const DOC_EXT = new Set(['.pdf', '.doc', '.docx', '.txt', '.md']);
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.rb', '.dart']);

/** 첨부 파일을 확장자·경로로 분류한다. */
export function classifyAttachment(filePath: string): AttachmentKind {
  const ext = path.extname(filePath).toLowerCase();
  const normalized = filePath.replace(/\\/g, '/');

  if (ext === '.feature') return 'feature';
  // 경로 선두에도 매칭돼야 한다 — 첨부는 보통 상대 경로로 온다 (`📎 .vibe/specs/login.md`)
  if (ext === '.md' && /(^|\/)\.vibe\/specs\//.test(normalized)) return 'spec';
  if (IMAGE_EXT.has(ext)) return 'image';
  if (CODE_EXT.has(ext)) return 'code';
  if (DOC_EXT.has(ext)) return 'document';
  return 'unknown';
}

/**
 * 디스패처가 한 번에 받아가는 신호 묶음.
 *
 * @param projectRoot 프로젝트 루트
 * @param input 사용자 입력에서 뽑은 URL·첨부 경로 (추출 자체는 모델이 한다)
 */
export function collectDispatchSignals(
  projectRoot: string,
  input: { urls?: string[]; attachments?: string[]; feature?: string } = {},
): DispatchSignals {
  return {
    projectRoot,
    resume: detectResumeState(projectRoot, input.feature),
    stakes: detectStakesSignals(projectRoot),
    urls: (input.urls ?? []).map(url => ({ url, kind: classifyUrl(url) })),
    attachments: (input.attachments ?? []).map(p => ({
      path: p,
      kind: classifyAttachment(p),
      exists: fs.existsSync(path.isAbsolute(p) ? p : path.join(projectRoot, p)),
    })),
  };
}
