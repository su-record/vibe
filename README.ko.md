# VIBE

**AI가 코드를 쓴다. Vibe는 그 코드가 좋은지 확인한다.**

[![npm](https://img.shields.io/npm/v/@su-record/vibe)](https://www.npmjs.com/package/@su-record/vibe)
[![npm downloads](https://img.shields.io/npm/dt/@su-record/vibe.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/@su-record/vibe)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-green)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)

Vibe는 AI 코딩 도구를 위한 품질 하네스입니다. Claude Code, Codex, Cursor, Gemini CLI를 감싸고, 타입 안전성, 코드 품질, 보안을 자동으로 강제합니다.

```bash
npm install -g @su-record/vibe
vibe init
```

---

## 이렇게 동작합니다

```
사용자: "사용자 인증 추가해줘"

  /vibe.spec        → GPT + Gemini 병렬 리서치 → SPEC 문서 자동 생성
  /vibe.run         → SPEC 기반 구현 → 12개 에이전트 병렬 리뷰
  품질 게이트        → any 타입 차단, 긴 함수 차단, 위험한 명령 차단
  완료              → 리뷰 통과된 타입 안전 코드만 남음

전부 자동. 프롬프트 한 줄이면 됩니다.
```

---

## 빠른 시작

```bash
# 1. 설치
npm install -g @su-record/vibe

# 2. 프로젝트 초기화 (스택 자동 감지)
cd your-project
vibe init

# 3. AI 코딩 도구와 함께 사용
claude                                 # Claude Code
# 또는 codex, cursor, gemini — 모두 지원

# 4. 워크플로우 시작
/vibe.spec "사용자 인증 추가"            # 요구사항 작성
/vibe.run                              # SPEC 기반 구현
```

`ultrawork`를 붙이면 전체 파이프라인이 자동화됩니다:

```bash
/vibe.run "사용자 인증 추가" ultrawork
```

---

## 주요 기능

**품질 게이트** — `any` 타입, `@ts-ignore`, 50줄 초과 함수를 차단. 3계층 방어가 모든 도구 호출마다 실행.

**전문 에이전트** — 탐색, 구현, 아키텍처, 코드 리뷰(12개 병렬), UI/UX 분석 등 56개 목적 특화 에이전트.

**멀티 LLM** — Claude가 오케스트레이션, GPT가 추론, Gemini가 리서치. 가용 모델에 따라 자동 라우팅. 기본값은 Claude 단독.

**세션 메모리** — 결정, 제약, 목표가 SQLite + FTS5 검색으로 세션 간 유지.

**스택 감지** — 24개 프레임워크 자동 감지 (Next.js, Django, Rails, Go, Rust, Flutter 등) 후 프레임워크별 규칙 적용.

**Figma → 코드** — 트리 기반 구조적 매핑으로 디자인 대비 90% 완성도 목표. Figma REST API에서 30+ CSS 속성을 추출하여 반응형 코드 생성.

---

## 지원 도구

| CLI | 상태 |
|-----|------|
| [Claude Code](https://claude.ai/code) | 전체 지원 |
| [Codex](https://github.com/openai/codex) | 플러그인 |
| [Cursor](https://cursor.sh) | 에이전트 + 룰 |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | 에이전트 + 스킬 |

---

## 문서

상세 가이드, 스킬 레퍼런스, 설정 방법은 [Wiki](https://github.com/su-record/vibe/wiki)를 참고하세요.

- [README (English)](README.md)
- [릴리스 노트](RELEASE_NOTES.md)

---

## 요구사항

- Node.js >= 18.0.0
- Claude Code (필수)
- GPT, Gemini (선택)

## 라이선스

MIT — Copyright (c) 2025 Su
