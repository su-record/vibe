---
description: Natural language tool invocation
argument-hint: "자연어로 원하는 기능 설명"
---

# /vibe.tool

자연어로 vibe 도구를 호출합니다. 35개 이상의 도구를 하나의 명령어로 사용할 수 있습니다.

## Usage

```
/vibe.tool "원하는 기능을 자연어로 설명"
```

## Examples

```
/vibe.tool "이 프로젝트 스택을 기억해줘: Next.js 14, TypeScript, Tailwind"
/vibe.tool "저장된 메모리 목록 보여줘"
/vibe.tool "auth 관련 메모리 검색해줘"
/vibe.tool "이 코드 복잡도 분석해줘"
/vibe.tool "UserService 클래스가 어디서 사용되는지 찾아줘"
/vibe.tool "로그인 기능 PRD 작성해줘"
```

---

## Tool Mapping Table

아래 표를 참고하여 사용자 요청에 가장 적합한 도구를 선택하고 실행하세요.

### Memory (메모리 관리)

| 키워드 | 함수 | 설명 |
|--------|------|------|
| 기억해, save, remember, 저장 | `saveMemory({ key, value, category, projectPath })` | 메모리 저장 |
| 떠올려, recall, 뭐였지 | `recallMemory({ key, projectPath })` | 메모리 조회 |
| 목록, list, 뭐 있어 | `listMemories({ category, limit, projectPath })` | 메모리 목록 |
| 삭제, delete, 지워 | `deleteMemory({ key, projectPath })` | 메모리 삭제 |
| 수정, update, 바꿔 | `updateMemory({ key, value, append, projectPath })` | 메모리 수정 |
| 찾아, search, 검색 | `searchMemories({ query, category, projectPath })` | 메모리 검색 |
| 연결, link, 관계 | `linkMemories({ sourceKey, targetKey, relationType, strength, projectPath })` | 메모리 연결 |
| 그래프, graph, 관계도 | `getMemoryGraph({ key, depth, format, projectPath })` | 지식 그래프 |
| 타임라인, timeline, 히스토리 | `createMemoryTimeline({ startDate, endDate, groupBy, projectPath })` | 시간순 메모리 |
| 고급검색, advanced | `searchMemoriesAdvanced({ query, strategy, limit, projectPath })` | 고급 검색 |
| 세션, session, 컨텍스트 | `startSession({ greeting, loadMemory, loadGuides, projectPath })` | 세션 시작 |
| 저장해둬, auto-save | `autoSaveContext({ urgency, contextType, summary, projectPath })` | 컨텍스트 자동 저장 |
| 복원, restore | `restoreSessionContext({ sessionId, restoreLevel, projectPath })` | 세션 복원 |
| 우선순위, priority | `prioritizeMemory({ currentTask, criticalDecisions, projectPath })` | 우선순위 정리 |

### Semantic (코드 분석)

| 키워드 | 함수 | 설명 |
|--------|------|------|
| 심볼, symbol, 정의 찾기 | `findSymbol({ symbolName, projectPath, symbolType })` | 심볼 정의 찾기 |
| 참조, references, 어디서 쓰여 | `findReferences({ symbolName, projectPath, filePath })` | 참조 찾기 |
| 의존성, dependencies, 그래프 | `analyzeDependencyGraph({ projectPath, entryPoint, depth })` | 의존성 분석 |

### Convention (코드 품질)

| 키워드 | 함수 | 설명 |
|--------|------|------|
| 복잡도, complexity | `analyzeComplexity({ code, metrics })` | 복잡도 분석 |
| 품질, quality, 검증 | `validateCodeQuality({ code, type, metrics, strict })` | 코드 품질 검증 |
| 결합도, coupling, 응집도 | `checkCouplingCohesion({ code, type, checkDependencies })` | 결합도/응집도 |
| 개선, improve, 리팩토링 | `suggestImprovements({ code, focus, priority })` | 개선 제안 |
| 규칙, rules, 표준 | `applyQualityRules({ scope, language })` | 품질 규칙 적용 |
| 가이드, guide, 컨벤션 | `getCodingGuide({ name, category })` | 코딩 가이드 |

### Thinking (사고 도구)

| 키워드 | 함수 | 설명 |
|--------|------|------|
| 생각, thinking, 연쇄 | `createThinkingChain({ topic, steps })` | 사고 체인 |
| 문제분석, analyze problem | `analyzeProblem({ problem, domain })` | 문제 분석 |
| 단계별, step by step | `stepByStepAnalysis({ task, detailLevel, context })` | 단계별 분석 |
| 계획, plan, 정리 | `formatAsPlan({ content, includeCheckboxes, priority })` | 계획 포맷팅 |
| 분해, break down | `breakDownProblem({ problem, approach, maxDepth })` | 문제 분해 |
| 추론, reason, 생각해봐 | `thinkAloudProcess({ scenario, perspective, verbosity })` | 추론 프로세스 |

### Planning (프로젝트 계획)

| 키워드 | 함수 | 설명 |
|--------|------|------|
| PRD, 요구사항 문서 | `generatePrd({ productName, productVision, targetAudience })` | PRD 생성 |
| 사용자 스토리, user story | `createUserStories({ features, userTypes, includeAcceptanceCriteria })` | 사용자 스토리 |
| 요구사항 분석 | `analyzeRequirements({ requirements, analysisMethod, stakeholders })` | 요구사항 분석 |
| 로드맵, roadmap | `featureRoadmap({ projectName, features, timeframe, teamSize })` | 로드맵 생성 |

### Prompt (프롬프트 엔지니어링)

| 키워드 | 함수 | 설명 |
|--------|------|------|
| 프롬프트 개선 | `enhancePrompt({ prompt, context, enhancement_type })` | 프롬프트 개선 |
| 프롬프트 분석 | `analyzePrompt({ prompt, criteria })` | 프롬프트 분석 |

### UI (UI 도구)

| 키워드 | 함수 | 설명 |
|--------|------|------|
| UI 미리보기, ASCII | `previewUiAscii({ page_name, components, layout_type })` | UI 프리뷰 |

### Time (시간)

| 키워드 | 함수 | 설명 |
|--------|------|------|
| 시간, time, 몇시 | `getCurrentTime({ format, timezone })` | 현재 시간 |

---

## Process

1. 사용자 입력을 분석하여 위 매핑 테이블에서 적합한 도구 선택
2. 필요한 파라미터 추출 (자연어에서)
3. projectPath는 현재 작업 디렉토리(pwd) 사용
4. 도구 실행 및 결과 반환

## Example Execution

**입력**: `/vibe.tool "프로젝트 스택 기억해: Next.js, TypeScript"`

**실행**:
```typescript
saveMemory({
  key: "project-stack",
  value: "Next.js, TypeScript",
  category: "project",
  projectPath: process.cwd()
})
```

**입력**: `/vibe.tool "UserService가 어디서 참조되는지 찾아줘"`

**실행**:
```typescript
findReferences({
  symbolName: "UserService",
  projectPath: process.cwd()
})
```

---

## Important Notes

- 모든 메모리 관련 도구는 `projectPath`를 현재 디렉토리로 설정하여 프로젝트별 메모리 격리
- 키워드 매칭이 애매한 경우, 가장 연관성 높은 도구 선택
- 여러 도구가 필요한 경우 순차 실행

---

ARGUMENTS: $ARGUMENTS
