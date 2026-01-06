# AI Agents Configuration

This file configures AI coding agents for this project.

## Workflow (PTCF 기반)

```
vibe read spec → vibe read run → vibe read verify
     ↓                ↓                ↓
  요구사항 정제      구현 실행        검증
  (PTCF 구조)      (SPEC 기반)    (Acceptance)
```

> **PTCF**: Persona, Task, Context, Format - Google Gemini 프롬프트 최적화 프레임워크

## Skill Usage

AI 에이전트에게 skill을 사용하도록 요청하세요:

- "vibe read spec으로 로그인 기능 명세를 작성해줘"
- "vibe read run으로 구현해줘"
- "vibe read verify로 검증해줘"

## Compatibility

| Agent | Supported |
|-------|-----------|
| Claude Code | Native |
| Cursor | via AGENTS.md |
| Windsurf | via AGENTS.md |
| Aider | via AGENTS.md |

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
<name>spec</name>
<description>SPEC 주도 개발을 위한 요구사항 수집 및 PTCF 구조 명세 작성. 대화를 통해 요구사항을 정제하고, AI가 바로 실행 가능한 프롬프트 형태의 SPEC 생성.</description>
<location>package</location>
</skill>

<skill>
<name>run</name>
<description>PTCF 구조의 SPEC을 읽고 바로 구현 실행. Phase별 작업 수행 및 Acceptance Criteria 검증.</description>
<location>package</location>
</skill>

<skill>
<name>verify</name>
<description>SPEC 요구사항 대비 구현 완료 여부를 검증합니다. BDD 테스트 및 Acceptance Criteria 검증 포함.</description>
<location>package</location>
</skill>

<skill>
<name>reason</name>
<description>9단계 추론 프레임워크로 복잡한 문제를 체계적으로 분석하고 해결합니다.</description>
<location>package</location>
</skill>

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
<name>ui</name>
<description>UI 컴포넌트를 ASCII 아트로 미리보기합니다. 코딩 전 레이아웃 확인용.</description>
<location>package</location>
</skill>

</available_skills>
<!-- SKILLS_TABLE_END -->

</skills_system>
