/**
 * Requirement ID System - 요구사항 ID 관리
 * v2.6.0: PRD-to-SPEC 자동화 지원
 *
 * ID 형식: REQ-{feature}-{number}
 * 예: REQ-login-001, REQ-auth-002
 */

/** 요구사항 ID 정규식 */
const ID_PATTERN = /^REQ-([a-z0-9-]+)-(\d{3})$/;

/** ID 카운터 (feature별) */
const counters = new Map<string, number>();

/** 사용된 ID 추적 (중복 방지) */
const usedIds = new Set<string>();

/**
 * 새 요구사항 ID 생성
 */
export function generateRequirementId(feature: string): string {
  const normalizedFeature = normalizeFeatureName(feature);
  const count = (counters.get(normalizedFeature) || 0) + 1;
  counters.set(normalizedFeature, count);

  const id = formatId(normalizedFeature, count);

  // 중복 방지
  if (usedIds.has(id)) {
    return generateRequirementId(feature);
  }

  usedIds.add(id);
  return id;
}

/**
 * 여러 요구사항 ID 일괄 생성
 */
export function generateRequirementIds(feature: string, count: number): string[] {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    ids.push(generateRequirementId(feature));
  }
  return ids;
}

/**
 * ID 유효성 검증
 */
export function validateRequirementId(id: string): { valid: boolean; error?: string } {
  if (!id) {
    return { valid: false, error: 'ID is empty' };
  }

  if (!ID_PATTERN.test(id)) {
    return {
      valid: false,
      error: `Invalid format. Expected: REQ-{feature}-{number}, got: ${id}`
    };
  }

  return { valid: true };
}

/**
 * ID 중복 검사
 */
export function checkDuplicateId(id: string): boolean {
  return usedIds.has(id);
}

/**
 * 기존 ID 등록 (기존 SPEC 로드 시)
 */
export function registerExistingId(id: string): boolean {
  const validation = validateRequirementId(id);
  if (!validation.valid) {
    return false;
  }

  if (usedIds.has(id)) {
    return false; // 이미 등록됨
  }

  usedIds.add(id);

  // 카운터 업데이트
  const match = id.match(ID_PATTERN);
  if (match) {
    const [, feature, numStr] = match;
    const num = parseInt(numStr, 10);
    const currentMax = counters.get(feature) || 0;
    if (num > currentMax) {
      counters.set(feature, num);
    }
  }

  return true;
}

/**
 * 여러 기존 ID 등록
 */
export function registerExistingIds(ids: string[]): { registered: number; skipped: number; errors: string[] } {
  const result = { registered: 0, skipped: 0, errors: [] as string[] };

  for (const id of ids) {
    const validation = validateRequirementId(id);
    if (!validation.valid) {
      result.errors.push(`${id}: ${validation.error}`);
      continue;
    }

    if (registerExistingId(id)) {
      result.registered++;
    } else {
      result.skipped++;
    }
  }

  return result;
}

/**
 * ID에서 Feature 이름 추출
 */
export function extractFeatureFromId(id: string): string | null {
  const match = id.match(ID_PATTERN);
  return match ? match[1] : null;
}

/**
 * ID에서 번호 추출
 */
export function extractNumberFromId(id: string): number | null {
  const match = id.match(ID_PATTERN);
  return match ? parseInt(match[2], 10) : null;
}

/**
 * Feature별 사용된 ID 목록 조회
 */
export function getIdsByFeature(feature: string): string[] {
  const normalizedFeature = normalizeFeatureName(feature);
  return Array.from(usedIds)
    .filter(id => id.startsWith(`REQ-${normalizedFeature}-`))
    .sort();
}

/**
 * 모든 사용된 ID 조회
 */
export function getAllUsedIds(): string[] {
  return Array.from(usedIds).sort();
}

/**
 * ID 카운터 리셋 (테스트용)
 */
export function resetCounters(): void {
  counters.clear();
  usedIds.clear();
}

/** Alias for resetCounters (테스트 호환성) */
export const resetRequirementCounter = resetCounters;

/**
 * 현재 카운터 상태 조회
 */
export function getCounterStatus(): Record<string, number> {
  return Object.fromEntries(counters);
}

// ============================================
// Internal Helpers
// ============================================

function normalizeFeatureName(feature: string): string {
  return feature
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30); // 최대 30자
}

function formatId(feature: string, num: number): string {
  return `REQ-${feature}-${num.toString().padStart(3, '0')}`;
}
