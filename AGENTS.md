# VIBE - Claude Code Framework

SPEC 주도 AI 코딩 프레임워크 (Claude Code 전용)

## Workflow

```
/vibe.spec → /vibe.run → /vibe.verify
     ↓           ↓            ↓
  요구사항      구현         검증
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

## Getting Started

```bash
vibe init
/vibe.spec "로그인 기능"
```
