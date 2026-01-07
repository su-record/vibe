# VIBE

SPEC 주도 AI 코딩 프레임워크 (Claude Code 전용)

## Workflow

```
/vibe.spec → /vibe.run → /vibe.verify
```

## Commands

| 명령어 | 설명 |
|--------|------|
| `/vibe.spec "기능명"` | SPEC 작성 (PTCF 구조) |
| `/vibe.run "기능명"` | 구현 실행 |
| `/vibe.verify "기능명"` | 검증 |
| `/vibe.reason "문제"` | 체계적 추론 |
| `/vibe.analyze` | 프로젝트 분석 |
| `/vibe.diagram` | 다이어그램 생성 |
| `/vibe.ui "설명"` | UI 미리보기 |

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

## MCP 도구 (hi-ai)

### 시맨틱 코드 분석
| 도구 | 용도 |
|------|------|
| `mcp__vibe__find_symbol` | 심볼 정의 찾기 |
| `mcp__vibe__find_references` | 참조 찾기 |
| `mcp__vibe__analyze_complexity` | 복잡도 분석 |
| `mcp__vibe__validate_code_quality` | 품질 검증 |

### 컨텍스트 관리
| 도구 | 용도 |
|------|------|
| `mcp__vibe__start_session` | 세션 시작 (이전 컨텍스트 복원) |
| `mcp__vibe__auto_save_context` | 현재 상태 저장 |
| `mcp__vibe__save_memory` | 중요 결정사항 저장 |

## Getting Started

```bash
vibe init
/vibe.spec "로그인 기능"
```
