# /vibe.spec

SPEC 문서를 작성합니다 (Specification Agent).

## Usage

```
/vibe.spec "기능명"
```

## Description

사용자와 질의응답을 통해 요구사항을 수집하고 EARS 형식의 SPEC 문서를 작성합니다.

## Process

1. **언어 설정 확인**: `.vibe/config.json`의 `language` 확인 (ko/en)
2. **6개 질문 진행**:
   - Q1. Why (목적)
   - Q2. Who (사용자)
   - Q3. What (기능 범위)
   - Q4. How (기술 제약)
   - Q5. When (일정)
   - Q6. With What (기술 스택) - CLAUDE.md 참조
3. **SPEC 문서 작성**: `.vibe/specs/{기능명}.md` 생성
4. **품질 검증**: TRUST 5 기준 자체 평가

## Agent

`~/.vibe/agents/specification-agent.md`

## Output

- `.vibe/specs/{기능명}.md` - SPEC 문서 (EARS 형식)
- 품질 점수 (0-100점)
- 개선 제안 사항

## Example

```
/vibe.spec "푸시 알림 설정 기능"
```

## Next Step

```
/vibe.plan "푸시 알림 설정 기능"
```
