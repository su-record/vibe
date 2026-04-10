---
description: Generate project folder structure optimized for AI-assisted development
argument-hint: --check (audit existing) or project-type
---

# /vibe.scaffold

AI가 잘 일하는 프로젝트 구조를 설계한다.

> "프로젝트 구조를 잘 설계하면, AI는 그 구조에 맞춰 따라간다"

## Usage

```
/scaffold                  # 현재 프로젝트에 구조 생성 (스택 자동 감지)
/scaffold --check          # 기존 프로젝트 구조 점검 + 개선 제안
/scaffold webapp           # webapp 타입으로 구조 생성
/scaffold api              # api 타입으로 구조 생성
```

---

## Process

### 1. 현재 상태 파악

1. `CLAUDE.md`, `package.json`, `pyproject.toml`, `pubspec.yaml` 등 읽기
2. 기존 폴더 구조 확인 (`ls` or `Glob`)
3. `.claude/vibe/config.json` 에서 감지된 스택 확인

### 2. 프로젝트 타입 결정

| 타입 | 구조 특성 |
|------|----------|
| `webapp` | src/ + pages/ + components/ + hooks/ + styles/ |
| `api` | src/ + routes/ + services/ + models/ + middleware/ |
| `fullstack` | src/client/ + src/server/ 또는 apps/ monorepo |
| `library` | src/ + examples/ + benchmarks/ |
| `mobile` | lib/ (Flutter) 또는 src/ (React Native) |

### 3. 기본 구조 생성

모든 프로젝트에 공통으로 생성하는 폴더:

```
my-project/
├── src/              # 비즈니스 로직
├── docs/             # 사람이 관리하는 비즈니스 문서 (AI의 참고서)
│   ├── README.md     # "이 폴더는 비즈니스 룰, 도메인 정의, ADR 등을 보관합니다"
│   └── adr/          # Architecture Decision Records
├── tests/            # 검증 인프라
├── .dev/             # AI가 남기는 작업 기록
│   ├── README.md     # "이 폴더는 AI가 자동 생성하는 learnings, 디버깅 로그 등을 보관합니다"
│   ├── learnings/    # troubleshooting 기록
│   └── scratch/      # 실험, 스크래치패드
├── .claude/          # AI 설정 (vibe init이 관리)
├── out/              # 빌드 산출물 (.gitignore 대상)
└── CLAUDE.md         # 프로젝트 지도
```

### 4. 스택별 src/ 하위 구조

**React/Next.js (webapp):**
```
src/
├── components/       # 재사용 UI 컴포넌트
│   ├── ui/           # 기본 UI (Button, Input, Modal)
│   └── features/     # 기능별 컴포넌트
├── pages/ or app/    # 라우트 (Next.js 버전에 따라)
├── hooks/            # 커스텀 훅
├── lib/              # 유틸리티, 헬퍼
├── services/         # API 호출, 외부 서비스
├── stores/           # 상태 관리 (zustand, jotai 등)
├── types/            # 타입 정의
└── styles/           # 글로벌 스타일
```

**Express/NestJS/FastAPI (api):**
```
src/
├── routes/           # API 라우트 (또는 controllers/)
├── services/         # 비즈니스 로직
├── models/           # 데이터 모델, 스키마
├── middleware/       # 인증, 로깅, 에러 핸들링
├── lib/              # 유틸리티
├── types/            # 타입 정의
└── config/           # 설정 관리
```

**Flutter (mobile):**
```
lib/
├── screens/          # 화면별 위젯
├── widgets/          # 재사용 위젯
├── services/         # API, 로컬 저장소
├── providers/        # 상태 관리
├── models/           # 데이터 모델
├── utils/            # 유틸리티
└── config/           # 설정, 상수
```

### 5. 클린 아키텍처 레이어 제안 (선택)

```
src/
├── domain/           # 비즈니스 룰 (순수 로직, 외부 의존 없음)
├── application/      # 유스케이스 (도메인 조합)
├── infrastructure/   # 외부 연동 (DB, API, 파일)
└── presentation/     # UI 또는 API 엔드포인트
```

레이어 원칙:
- 의존성 방향: presentation → application → domain (역방향 금지)
- domain은 외부 패키지 import 금지
- infrastructure는 domain의 인터페이스를 구현

### 6. 보조 파일 생성

| 파일 | 내용 |
|------|------|
| `docs/README.md` | docs/ 폴더 용도 설명 |
| `.dev/README.md` | .dev/ 폴더 용도 설명 |
| `.gitignore` 추가 | `out/`, `.dev/scratch/` 항목 추가 |

### 7. CLAUDE.md에 구조 반영

생성된 구조를 CLAUDE.md에 포인터로 추가:

```markdown
## Project Structure
- `src/` — Business logic
- `docs/` — Human-maintained business docs (AI reads before work)
- `tests/` — Test infrastructure
- `.dev/` — AI-generated work logs
- `.claude/` — AI configuration
```

---

## --check 모드: 기존 구조 점검

### 점검 항목

| 항목 | 권장 | 점수 |
|------|------|------|
| `docs/` 존재 | 비즈니스 문서 분리 | /15 |
| `.dev/` 존재 | AI 작업 기록 분리 | /10 |
| src/ 하위 구조 | 역할별 폴더링 | /20 |
| tests/ 분리 | 소스 옆이 아닌 별도 폴더 | /15 |
| CLAUDE.md 구조 설명 | 폴더 역할 명시 | /10 |
| .gitignore 완성 | out/, .dev/scratch/ 포함 | /5 |
| 레이어 분리 | 도메인/서비스/인프라 구분 | /15 |
| 의존성 방향 일관성 | 역방향 import 없음 | /10 |

### Output

```markdown
## Scaffold 점검 결과 (N/100)

### 현재 구조
[트리 출력]

### 점검 결과
| 항목 | 상태 | 권장사항 |
|------|------|---------|
| docs/ | 없음 | `mkdir docs && echo "..." > docs/README.md` |
| ... | ... | ... |

### 자동 수정 가능 항목
1. [ ] docs/ 생성
2. [ ] .dev/ 생성
3. [ ] .gitignore 업데이트

자동 수정을 진행할까요? (y/n)
```

---

## 핵심 원칙

1. **절대 기존 파일 삭제/이동 안 함** — 새 폴더만 추가
2. **빈 폴더에는 README.md** — 용도 설명으로 AI가 맥락 파악
3. **구조 없음 < 나쁜 구조 < 좋은 구조** — 뭐라도 깔아두면 AI가 따라감
4. **사람 문서(docs/) vs AI 기록(.dev/) 분리** — 관리 주체가 다르면 폴더도 분리

---

ARGUMENTS: $ARGUMENTS
