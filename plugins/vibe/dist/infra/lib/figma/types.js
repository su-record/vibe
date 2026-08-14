/**
 * Figma REST API 타입 정의
 *
 * 두 방향의 타입이 한 파일에 있다:
 * - `FigmaApiNode` 계열 = Figma REST 응답의 **입력** 형태
 * - `FigmaNode` = 이 파이프라인이 만들어내는 **출력** 계약
 *
 * 입력 타입이 없어서 추출·감사 경로가 전부 `any` 로 열려 있었다 (2026-07-28 감사).
 * Figma API 전체를 모델링하지 않는다 — 코드가 실제로 읽는 필드만 담은 부분 타입이며,
 * 읽지 않는 필드가 응답에 더 있어도 무해하다.
 */
export {};
//# sourceMappingURL=types.js.map