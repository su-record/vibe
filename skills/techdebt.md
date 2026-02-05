---
description: "기술 부채 정리 — 중복 코드, console.log, 미사용 import, any 타입 등 검사 및 정리. 세션 종료 전 사용 권장. techdebt, 기술부채, 정리 키워드에 활성화."
---

# Techdebt — 기술 부채 정리

세션 종료 전 또는 주기적으로 코드베이스의 기술 부채를 탐지하고 정리한다.

## 검사 항목

### 1. 중복 코드

- 유사한 함수/로직이 여러 파일에 존재하는지 확인
- 공통 유틸리티로 추출 가능한 코드 식별
- 검사 방법: `core_analyze_complexity`로 유사 코드 탐지

### 2. 미사용 코드

- 미사용 import 문
- 미사용 변수/함수
- 주석 처리된 코드 블록

검사 도구:

```
# 미사용 import 탐지 (Grep 도구 사용)
Grep: pattern="^import .+ from" → 사용처 교차 검증

# 주석 처리된 코드 블록 탐지
Grep: pattern="^\\s*//.*\\b(function|const|let|var|class|import)\\b"
```

### 3. 디버그 코드

- `console.log` / `console.error` / `console.warn`
- `debugger` 문
- 임시 주석: `// TODO`, `// FIXME`, `// HACK`, `// XXX`

검사 도구:

```
# console 문 탐지 (Grep 도구 사용)
Grep: pattern="console\\.(log|error|warn|debug)" glob="*.{ts,tsx}"

# TODO/FIXME 탐지
Grep: pattern="(TODO|FIXME|HACK|XXX)" glob="*.{ts,tsx}"

# debugger 문 탐지
Grep: pattern="\\bdebugger\\b" glob="*.{ts,tsx}"
```

### 4. 코드 품질

- `any` 타입 사용 (TypeScript)
- 하드코딩된 값 (매직 넘버/스트링)
- 50줄 초과 함수
- 4단계 초과 중첩

검사 도구:

```
# any 타입 탐지 (Grep 도구 사용)
Grep: pattern=": any\\b|as any\\b" glob="*.{ts,tsx}"

# vibe 내장 도구로 복잡도 분석
core_analyze_complexity: filePath="src/**/*.ts"
core_validate_code_quality: filePath="src/**/*.ts"
```

## 출력 형식

```markdown
## 기술 부채 리포트

### 중복 코드 (N건)
- src/utils.ts:formatDate ↔ src/helpers.ts:formatDateTime

### 미사용 import (N건)
- src/components/Button.tsx:3 — React (unused)

### 디버그 코드 (N건)
- src/api/auth.ts:23 — console.log

### 코드 품질 이슈 (N건)
- src/services/user.ts:45 — any 타입 사용
- src/utils/calc.ts:10 — 매직 넘버 (하드코딩 365)

총 N건의 기술 부채가 발견되었습니다.
```

## 자동 수정 범위

### 자동 수정 가능 (안전)

| 항목 | 수정 방법 |
|------|----------|
| 미사용 import | 해당 import 문 삭제 |
| `console.log` / `debugger` | 해당 라인 삭제 |
| 후행 공백 / 빈 줄 정리 | 포맷터 적용 |

### 수동 확인 필요 (안전 가드)

| 항목 | 이유 |
|------|------|
| 중복 코드 추출 | 로직 동일성 확인 필요 |
| `any` 타입 수정 | 적절한 타입 설계 필요 |
| 매직 넘버 추출 | 상수명과 위치 결정 필요 |
| 긴 함수 분리 | 로직 분리 기준 결정 필요 |

> 자동 수정 전 반드시 변경 범위를 사용자에게 보여주고 확인을 받는다.

## vibe 도구 연계

| 도구 | 용도 |
|------|------|
| `core_analyze_complexity` | 함수 복잡도 측정 (nesting, line count) |
| `core_validate_code_quality` | 코드 품질 규칙 위반 탐지 |
| `core_suggest_improvements` | 개선 제안 생성 |
| `core_check_coupling_cohesion` | 모듈 결합도/응집도 분석 |
