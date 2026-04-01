---
status: pending
currentPhase: 3
parentSpec: _index.md
---

# SPEC: design-integration — Phase 3: Context & Workflow

## Persona
<role>
vibe npm 패키지의 시니어 개발자. design-teach skill의 런타임 로직과 SPEC/RUN 워크플로우에 디자인 커맨드를 통합한다.
</role>

## Context
<context>

### Background
- Phase 1에서 `design-teach` skill 파일을 생성했으나, 실제 design context를 읽고 쓰는 로직은 별도 구현 필요
- 기존 vibe 워크플로우(SPEC→RUN→REVIEW)에 디자인 스킬이 3개 Phase(SPEC Phase, REVIEW Phase, PRE-SHIP Phase)에 명시적으로 통합되어야 함
- design-* 스킬들이 `.claude/vibe/design-context.json`을 자동으로 참조해야 함

### Tech Stack
- TypeScript ESM (`.js` 확장자)
- Config: `.claude/vibe/config.json` (기존), `.claude/vibe/design-context.json` (신규)
- vibe CLI: `src/cli/` 
- Skills: `skills/` (Markdown, 런타임 없음 — skill 내에서 도구 호출로 처리)

### Related Code
- `skills/design-teach/SKILL.md` — Phase 1에서 생성 (context 수집 프로세스 정의)
- `agents/ui/ui-industry-analyzer.md` — SPEC Phase에서 산업 분석
- `agents/ui/ui-design-system-gen.md` — SPEC Phase에서 MASTER.md 생성
- `vibe/templates/spec-template.md` — SPEC 템플릿 (디자인 섹션 추가 대상)

</context>

## Task
<task>

### Phase 3-1: design-context.json 스키마 정의

**파일 위치**: `.claude/vibe/design-context.json` (프로젝트별)

```json
{
  "$schema": "design-context-v1",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "audience": {
    "primary": "대상 사용자 설명",
    "context": "사용 환경 (데스크톱/모바일/혼합)",
    "expertise": "기술 수준 (초보/중급/전문가)"
  },
  "brand": {
    "personality": ["형용사 3-5개"],
    "tone": "formal | casual | playful | professional",
    "existingAssets": "기존 브랜드 가이드라인 경로 (선택)"
  },
  "aesthetic": {
    "style": "minimal | bold | elegant | playful | corporate",
    "colorMood": "warm | cool | neutral | vibrant | muted",
    "typographyMood": "modern | classic | geometric | humanist",
    "references": ["참조 사이트/앱 URL"]
  },
  "constraints": {
    "accessibility": "AA | AAA",
    "performance": "core-web-vitals | balanced | unlimited",
    "browsers": ["chrome", "safari", "firefox", "edge"],
    "devices": ["mobile", "tablet", "desktop"]
  }
}
```

### Phase 3-2: design-teach skill에 context 수집 프로세스 상세화

`skills/design-teach/SKILL.md` 업데이트:

1. **코드베이스 탐색** (자동):
   - 기존 CSS/Tailwind config에서 색상, 폰트 추출
   - `package.json`에서 UI 라이브러리 감지 (shadcn, MUI, Chakra 등)
   - MASTER.md 존재 여부 확인

2. **사용자 질문** (대화형, 한 번에 하나씩):
   - "이 제품의 주요 사용자는 누구인가요?"
   - "브랜드 성격을 3-5개 형용사로 표현하면?"
   - "참조할 만한 사이트나 앱이 있나요?"
   - "디자인 제약조건이 있나요? (접근성 수준, 브라우저 지원 등)"

3. **저장**: `.claude/vibe/design-context.json`에 Write 도구로 저장

4. **재실행 시맨틱** (design-teach를 다시 실행할 때):
   - 기존 `design-context.json`이 있으면 → 현재 값을 기본값으로 표시하며 질문
   - `createdAt`은 보존, `updatedAt`만 갱신
   - 사용자가 "keep" 응답 시 해당 필드 유지, 새 값 입력 시 덮어쓰기
   - 병합이 아닌 필드 단위 교체 (partial update)

5. **다른 skill에서 참조**: 각 design-* skill의 "Preparation" 단계에서:
   ```
   1. Read `.claude/vibe/design-context.json`
   2. 없으면 → "Run /design-teach first" 안내
   3. 있으면 → context를 분석에 반영
   ```

### Phase 3-3: SPEC 워크플로우 연결

**vibe.spec의 UI/UX Design Intelligence 섹션과 연결:**

기존 워크플로우:
```
SPEC Phase: ui-industry-analyzer → ui-design-system-gen → ui-layout-architect
```

확장된 워크플로우:
```
SPEC Phase: 
  ① design-context.json 확인 (없으면 /design-teach 권장)
  ② ui-industry-analyzer → ui-design-system-gen → ui-layout-architect
  
REVIEW Phase:
  ③ /design-audit (기술 품질 점검)
  ④ /design-critique (UX 리뷰)
  ⑤ ui-antipattern-detector (AI slop + 패턴 탐지)

PRE-SHIP Phase:
  ⑥ /design-normalize (디자인 시스템 정렬)
  ⑦ /design-polish (최종 패스)
```

### Phase 3-4: Skill 간 연결 가이드

각 design-* skill의 "Next Steps" 섹션에 다음 skill 추천:

| Current Skill | Recommended Next |
|---|---|
| /design-teach | /design-audit (현재 상태 파악) |
| /design-audit | /design-normalize (시스템 정렬) 또는 /design-critique (UX 리뷰) |
| /design-critique | /design-distill (단순화) 또는 /design-normalize (토큰 정렬) |
| /design-normalize | /design-polish (최종 패스) |
| /design-distill | /design-normalize (정렬) → /design-polish (완료) |
| /design-polish | 완료 (ship ready) |

### Phase 3-5: CLAUDE.md 업데이트

`CLAUDE.md`의 "Proactive Skill Suggestions" 테이블에 디자인 스킬 추가:

```markdown
| Building new UI/UX | `/design-teach` | "new page", "landing", "dashboard", Figma URL |
| UI code review | `/design-audit` | After implementing UI components |
| Before shipping UI | `/design-polish` | "ready to deploy", "final check" |
```

</task>

## Constraints
<constraints>
- design-context.json 스키마는 확장 가능하되 v1은 최소한의 필드만 포함
- `$schema` 필드의 버전 파싱: 숫자 부분만 비교 (e.g., "design-context-v1" → 1). 알 수 없는 버전은 best-effort 파싱 + 경고
- `tone`/`style`/`colorMood`/`typographyMood` 값은 가이드라인이지 closed enum이 아님 — 사용자가 자유 텍스트 입력 가능, 제안 값은 예시로만 표시
- design-context.json 최대 파일 크기: 10KB (과도한 references 배열 방지)
- design-context.json 파싱 실패 시: 경고 출력 + 기본값으로 대체 (skill 실행은 계속)
- skill 파일 내에서 TypeScript 코드 실행 불가 — 모든 런타임 동작은 기존 vibe tool 또는 Claude 도구(Read, Write, Glob, Grep) 호출로 처리
- SPEC 워크플로우 변경은 문서화만 (vibe.spec skill 파일 자체는 수정하지 않음 — 별도 작업)
- CLAUDE.md 변경은 Proactive Skill Suggestions 테이블만 (다른 섹션 미변경)
- 각 design-* skill 응답 시간 목표: ≤30초 (컨텍스트 로딩 + 분석 + 출력)
</constraints>

## Output Format
<output_format>

### Files to Create (없음 — Phase 1에서 생성한 design-teach를 업데이트)

### Files to Modify (8개)
- `skills/design-teach/SKILL.md` — context 수집 프로세스 상세화 + rerun semantics
- `skills/design-audit/SKILL.md` — design-context.json 참조 + Preparation + Next Steps
- `skills/design-critique/SKILL.md` — design-context.json 참조 + Preparation + Next Steps
- `skills/design-polish/SKILL.md` — design-context.json 참조 + Preparation + Next Steps
- `skills/design-normalize/SKILL.md` — design-context.json 참조 + Preparation + Next Steps
- `skills/design-distill/SKILL.md` — design-context.json 참조 + Preparation + Next Steps
- `CLAUDE.md` — Proactive Skill Suggestions 테이블 업데이트

### Verification Commands
- design-context.json 스키마 검증: 수동 리뷰
- 각 design-* skill에서 "design-context.json" 참조 확인: `grep -l "design-context.json" skills/design-*/SKILL.md`
- CLAUDE.md 변경 확인: `grep "design-teach" CLAUDE.md`

</output_format>

## Acceptance Criteria
<acceptance>
- [ ] design-context.json 스키마가 design-teach SKILL.md에 문서화됨
- [ ] design-teach에 5단계 수집 프로세스 (코드베이스 탐색 → 질문 → 저장 → 재실행 시맨틱 → 참조) 포함
- [ ] 모든 design-* skill의 Preparation 단계에서 design-context.json 참조
- [ ] 없을 때 "/design-teach first" 안내 메시지 포함
- [ ] Skill 간 연결 가이드 (Next Steps) 각 skill에 포함
- [ ] CLAUDE.md Proactive Skill Suggestions에 3개 디자인 항목 추가
- [ ] 워크플로우 문서가 SPEC→REVIEW→PRE-SHIP 단계를 명확히 정의
- [ ] design-context.json 파싱 실패 시 경고 + 기본값 대체 동작 정의됨
- [ ] design-normalize에서 MASTER.md 부재 시 안내 메시지 정의됨
- [ ] design-context.json 최대 크기 10KB 제한 명시됨
- [ ] design-teach 재실행 시 기존 값 표시 + 필드 단위 교체 동작 정의됨
- [ ] schema 값(tone/style/mood)이 가이드라인이지 closed enum이 아님이 명시됨
- [ ] Phase 3 Output Format이 모든 design-* skill 파일 수정을 포함
</acceptance>
