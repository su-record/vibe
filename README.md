# 📖 sutory

> **Your story becomes code**
> SPEC-driven AI coding framework powered by Claude Code

당신의 이야기(요구사항)가 자동으로 코드가 됩니다.

---

## ✨ 특징

- 🗣️ **자연어 대화**로 요구사항 수집
- 📋 **SPEC 문서** 자동 생성 (EARS 형식)
- 🤖 **전문가 에이전트** 7개 (Python, Flutter, React, PostgreSQL, Quality Reviewer 등)
- 🛠️ **38개 MCP 도구** 통합 (코드 분석, 품질 검증, 메모리 관리)
- 📚 **17개 스킬** (언어별 코딩 표준, 품질 기준)
- ⚡ **SPEC → PLAN → TASKS → CODE** 자동 워크플로우

---

## 🚀 빠른 시작

### 설치

```bash
npm install -g sutory
```

### 사용법

```bash
# 1. 프로젝트 초기화
cd my-project
sutory init

# 2. 새 기능 스토리 작성 (AI가 질문합니다)
sutory story create "사용자 인증 시스템"

# 3. 기술 계획 수립
sutory plan "사용자 인증 시스템"

# 4. 작업 분해
sutory tasks "사용자 인증 시스템"

# 5. 구현
sutory implement "사용자 인증 시스템"

# 6. 검증
sutory verify "사용자 인증 시스템"
```

---

## 📁 프로젝트 구조

sutory를 초기화하면 프로젝트에 `.sutory/` 폴더가 생성됩니다:

```
my-project/
├── .sutory/
│   ├── constitution.md           # 프로젝트 원칙
│   ├── specs/                    # SPEC 문서들
│   │   └── auth-system.md
│   ├── plans/                    # 기술 계획들
│   │   └── auth-implementation-plan.md
│   └── tasks/                    # 작업 목록들
│       └── auth-tasks.md
└── [기존 코드...]
```

---

## 🎯 워크플로우

### 1. Story (요구사항 수집)

```bash
$ sutory story create "OCR 영수증 인증"

🤖 AI: 요구사항을 파악하기 위해 몇 가지 질문드릴게요.

Q1. 이 기능의 주요 목적은?
  1) 피드 신뢰도 향상
  2) 포인트 추가 지급
  3) 사기 방지

당신: 1, 2

Q2. 대상 사용자는?
  1) 모든 사용자
  2) Tier 3 이상

당신: 1

... (5-10개 질문)

✅ SPEC 문서 생성 완료!
→ .sutory/specs/ocr-receipt-verification.md
```

### 2. Plan (기술 계획)

```bash
$ sutory plan "OCR 영수증 인증"

🤖 AI: SPEC 분석 중...

기술 스택 제안:
- OCR: Google Document AI (정확도 95%+)
- 저장소: GCS
- 처리: Async (3초 목표)
- 비용: 월 $1.50

✅ PLAN 문서 생성 완료!
→ .sutory/plans/ocr-implementation-plan.md
```

### 3. Tasks (작업 분해)

```bash
$ sutory tasks "OCR 영수증 인증"

🤖 AI: 작업 목록 생성 중...

✅ 7개 작업 생성 (예상 13.5시간)
→ .sutory/tasks/ocr-tasks.md
```

### 4. Implement (구현)

```bash
$ sutory implement "OCR 영수증 인증"

🤖 AI (Backend Python Expert):

Task 1/7: Document AI 클라이언트 설정

📍 MCP 도구 활용:
  ✓ find_symbol - 기존 패턴 확인
  ✓ validate_code_quality - 품질 자동 검증

✅ app/external/document_ai_client.py 생성

다음 작업을 계속하시겠습니까? [Y/n]
```

---

## 🤖 포함된 에이전트

- **Specification Agent** - 요구사항 질의응답 및 SPEC 작성
- **Backend Python Expert** - Python/FastAPI 개발
- **Frontend Flutter Expert** - Flutter/Dart 개발
- **Frontend React Expert** - React/Next.js 개발
- **Database PostgreSQL Expert** - PostgreSQL/PostGIS 설계
- **Task Agent** - SPEC → Tasks 자동 변환
- **Quality Reviewer** - 코드 품질 검증

---

## 📚 스킬셋

### 언어별 코딩 표준
- Python/FastAPI
- Dart/Flutter
- TypeScript/React
- TypeScript/Next.js
- TypeScript/React Native

### 품질 기준
- TRUST 5 원칙
- Testing Strategy (Contract-First)
- Complexity Metrics

### MCP 도구 가이드
- 38개 도구 사용법
- 워크플로우 패턴

---

## 🛠️ MCP 서버 통합

sutory는 다음 MCP 서버와 함께 작동합니다:

- **su-record/hi-ai** - 코드 분석, 품질 검증, 메모리 관리
- **upstash/context-7** - 최신 라이브러리 문서 검색

---

## 📖 CLI 명령어

```bash
# 초기화
sutory init                        # .sutory/ 폴더 생성

# Story (SPEC)
sutory story create <name>         # 질의응답 → SPEC
sutory story list                  # SPEC 목록
sutory story show <name>           # SPEC 보기

# Plan
sutory plan <name>                 # SPEC → PLAN 생성

# Tasks
sutory tasks <name>                # SPEC + PLAN → TASKS

# Implement
sutory implement <name>            # 구현 시작
sutory implement --agent flutter   # 특정 에이전트 사용

# Verify
sutory verify <name>               # SPEC 기준 검증

# Utilities
sutory agents                      # 에이전트 목록
sutory skills                      # 스킬 목록
sutory update                      # 프레임워크 업데이트
```

---

## 🎨 SPEC 문서 예시

```markdown
# SPEC: OCR 영수증 인증 시스템

## Metadata
- 작성일: 2025-01-17
- 상태: APPROVED
- 우선순위: HIGH

## 1. 기능 개요
사용자가 레스토랑 영수증을 업로드하여 피드 신뢰도를 높인다.

## 2. Requirements (EARS 형식)

### REQ-001: 영수증 업로드
**WHEN** 사용자가 피드 작성 시 영수증 이미지를 업로드하면
**THEN** 시스템은 Document AI로 텍스트를 추출해야 한다 (SHALL)

#### Acceptance Criteria
- [ ] JPG, PNG 형식 지원
- [ ] 최대 10MB
- [ ] 3초 이내 처리

### REQ-002: 영수증 검증
**WHERE** 영수증 날짜가 24시간 이내이고
**AND** 레스토랑 이름이 일치하면
**THEN** 시스템은 인증 성공으로 처리해야 한다 (SHALL)
```

---

## 🌟 철학

### "Your story becomes code"

1. **대화로 시작** - AI와 자연어 대화로 요구사항 수집
2. **문서로 명확화** - SPEC으로 모호함 제거
3. **계획으로 구체화** - 기술 스택과 아키텍처 결정
4. **작업으로 분해** - 실행 가능한 단위로 쪼개기
5. **코드로 구현** - 당신의 스타일로 자동 생성

---

## 🤝 기여하기

sutory는 오픈소스 프로젝트입니다.

- 이슈 제보: [GitHub Issues](https://github.com/your-username/sutory/issues)
- PR 환영: [Contributing Guide](CONTRIBUTING.md)

---

## 📄 라이선스

MIT License

---

## 🙏 영감을 받은 프로젝트

- [GitHub spec-kit](https://github.com/github/spec-kit)
- [Fission-AI OpenSpec](https://github.com/Fission-AI/OpenSpec)
- [MoAI ADK](https://github.com/modu-ai/moai-adk)

---

**Made with ❤️ by grove**

"당신의 이야기가 코드가 됩니다"
