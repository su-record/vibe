# AI Agents Configuration

This file configures AI coding agents for this project.

## Workflow

```
vibe read spec → vibe read reason → vibe read plan → vibe read tasks → vibe read run → vibe read verify
     ↓                ↓                  ↓                 ↓                 ↓                ↓
  요구사항         체계적 추론         기술 계획         작업 분해           실행            검증
```

## Skill Usage

AI 에이전트에게 skill을 사용하도록 요청하세요:

- "vibe read spec으로 로그인 기능 명세를 작성해줘"
- "vibe read reason으로 이 문제를 분석해줘"
- "vibe read plan으로 구현 계획을 세워줘"

## Compatibility

| Agent | Supported |
|-------|-----------|
| Claude Code | ✅ Native |
| Cursor | ✅ via AGENTS.md |
| Windsurf | ✅ via AGENTS.md |
| Aider | ✅ via AGENTS.md |

<skills_system priority="1">

## Available Skills

<!-- SKILLS_TABLE_START -->
<usage>
When users ask you to perform tasks, check if any of the available skills below can help complete the task more effectively. Skills provide specialized capabilities and domain knowledge.

How to use skills:
- Invoke: Bash("vibe read <skill-name>")
- The skill content will load with detailed instructions on how to complete the task
- Base directory provided in output for resolving bundled resources

Usage notes:
- Only use skills listed in <available_skills> below
- Do not invoke a skill that is already loaded in your context
- Each skill invocation is stateless
</usage>

<available_skills>

<skill>
<name>analyze</name>
<description>프로젝트 코드 품질, 아키텍처, 의존성을 분석합니다.</description>
<location>package</location>
</skill>

<skill>
<name>diagram</name>
<description>아키텍처, ERD, 플로우차트를 Mermaid 다이어그램으로 생성합니다.</description>
<location>package</location>
</skill>

<skill>
<name>plan</name>
<description>SPEC 문서를 분석하여 기술 구현 계획(PLAN)을 작성합니다. 아키텍처, API 설계, 테스트 전략 포함.</description>
<location>package</location>
</skill>

<skill>
<name>reason</name>
<description>9단계 추론 프레임워크로 복잡한 문제를 체계적으로 분석하고 해결합니다.</description>
<location>package</location>
</skill>

<skill>
<name>run</name>
<description>특정 Task 또는 Phase를 실행합니다. 담당 에이전트가 코드를 작성하고 검증합니다.</description>
<location>package</location>
</skill>

<skill>
<name>spec</name>
<description>SPEC 주도 개발을 위한 요구사항 수집 및 명세 작성. EARS 방법론과 Gemini 프롬프팅 전략 적용.</description>
<location>package</location>
</skill>

<skill>
<name>tasks</name>
<description>PLAN 문서를 분석하여 Phase별 구체적인 작업 목록(TASKS)을 생성합니다.</description>
<location>package</location>
</skill>

<skill>
<name>ui</name>
<description>UI 컴포넌트를 ASCII 아트로 미리보기합니다. 코딩 전 레이아웃 확인용.</description>
<location>package</location>
</skill>

<skill>
<name>verify</name>
<description>SPEC 요구사항 대비 구현 완료 여부를 검증합니다. BDD 테스트 및 Contract 검증 포함.</description>
<location>package</location>
</skill>
</available_skills>
<!-- SKILLS_TABLE_END -->

</skills_system>
