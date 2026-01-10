# VIBE

SPEC 주도 AI 코딩 프레임워크 (Claude Code 전용)

## Workflow

```
/vibe.spec → /vibe.run → /vibe.verify
```

## ULTRAWORK Mode (권장)

`ultrawork` 또는 `ulw` 키워드를 포함하면 최대 성능 모드 활성화:

```bash
/vibe.run "기능명" ultrawork   # 모든 최적화 자동 활성화
/vibe.run "기능명" ulw         # 동일 (단축어)
```

**활성화 기능:**
- 병렬 서브에이전트 탐색 (3+ 동시)
- Boulder Loop (모든 Phase 완료까지 자동 진행)
- 에러 자동 재시도 (최대 3회)
- 컨텍스트 70%+ 시 자동 압축/저장
- Phase 간 확인 없이 연속 실행

## Commands

| 명령어 | 설명 |
|--------|------|
| `/vibe.spec "기능명"` | SPEC 작성 (PTCF 구조) |
| `/vibe.run "기능명"` | 구현 실행 |
| `/vibe.run "기능명" ultrawork` | **최대 성능 모드** |
| `/vibe.verify "기능명"` | 검증 |
| `/vibe.reason "문제"` | 체계적 추론 |
| `/vibe.analyze` | 프로젝트 분석 |
| `/vibe.diagram` | 다이어그램 생성 |
| `/vibe.ui "설명"` | UI 미리보기 |
| `/vibe.continue` | **세션 복원** (이전 컨텍스트 로드) |

## PTCF Structure

SPEC 문서는 AI가 바로 실행 가능한 프롬프트 형태:

```
<role>      AI 역할 정의
<context>   배경, 기술 스택, 관련 코드
<task>      Phase별 작업 목록
<constraints> 제약 조건
<output_format> 생성/수정할 파일
<acceptance> 검증 기준
```

## 내장 도구

### 시맨틱 코드 분석
| 도구 | 용도 |
|------|------|
| `vibe_find_symbol` | 심볼 정의 찾기 |
| `vibe_find_references` | 참조 찾기 |
| `vibe_analyze_complexity` | 복잡도 분석 |
| `vibe_validate_code_quality` | 품질 검증 |

### 컨텍스트 관리
| 도구 | 용도 |
|------|------|
| `vibe_start_session` | 세션 시작 (이전 컨텍스트 복원) |
| `vibe_auto_save_context` | 현재 상태 저장 |
| `vibe_save_memory` | 중요 결정사항 저장 |

## 컨텍스트 관리 전략

### 모델 선택
- **탐색/검색**: Haiku (서브에이전트 기본값)
- **구현/디버깅**: Sonnet
- **아키텍처/복잡한 로직**: Opus

### 컨텍스트 70%+ 시 (⚠️ 중요)
```
❌ /compact 사용 금지 (정보 손실/왜곡 위험)
✅ save_memory로 중요 결정사항 저장 → /new로 새 세션
```

vibe는 자체 메모리 시스템으로 세션 간 컨텍스트를 유지합니다:
1. `save_memory` - 중요 결정사항 명시적 저장
2. `/new` - 새 세션 시작
3. `start_session` - 이전 세션 자동 복원

### 세션 복원
새 세션에서 이전 작업을 이어가려면:
```
/vibe.continue
```
이 명령어가 `vibe_start_session`을 호출하여 프로젝트별 메모리에서 이전 컨텍스트를 복원합니다.

### 기타 명령어
- `/rewind` - 이전 시점으로 되돌리기
- `/context` - 현재 사용량 확인

### context7 활용
최신 라이브러리 문서가 필요할 때 context7 MCP 사용:
```
"React 19 use() 훅을 context7으로 검색해줘"
```

## Git Commit 규칙

**반드시 포함:**
- `.claude/` 폴더 전체 (commands, agents, settings.json)
- `.vibe/rules/`, `.vibe/specs/`, `.vibe/features/`
- `CLAUDE.md`

**제외:**
- `.claude/settings.local.json` (개인 설정, 자동 제외)
- `.vibe/mcp/` (node_modules, 자동 제외)

## Getting Started

```bash
vibe init
/vibe.spec "로그인 기능"
```
