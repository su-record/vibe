# hi-ai MCP 도구 사용 가이드

당신은 `su-record-hi-ai` MCP 서버의 38개 도구를 사용할 수 있습니다.
이 가이드는 **언제**, **어떻게** 각 도구를 활용할지 설명합니다.

---

## 🔍 코드 탐색 도구

### `find_symbol` - 함수/클래스 정의 찾기

**언제 사용?**
- "create_feed 함수 어디있어?"
- "User 클래스 정의 찾아줘"
- "authenticate 어디에 구현되어 있어?"

**파라미터:**
```typescript
{
  symbolName: string;        // 찾을 심볼 이름
  projectPath: string;       // 프로젝트 경로 (예: /Users/grove/workspace/fallingo)
  symbolType?: "function" | "class" | "interface" | "variable" | "type" | "all";
}
```

**실전 예시:**
```markdown
사용자: "create_feed 함수 어디있어?"

AI 액션:
find_symbol({
  symbolName: "create_feed",
  projectPath: "/Users/grove/workspace/fallingo",
  symbolType: "function"
})

결과: app/services/feed_service.py:45
```

---

### `find_references` - 심볼 사용처 찾기

**언제 사용?**
- "이 함수 어디서 호출되어?"
- "User 모델 어디서 쓰여?"
- "이 클래스 의존성 확인해줘"

**파라미터:**
```typescript
{
  symbolName: string;
  projectPath: string;
  filePath?: string;    // 심볼이 정의된 파일
  line?: number;        // 심볼이 정의된 라인
}
```

**실전 예시:**
```markdown
사용자: "create_feed 함수 어디서 호출되어?"

AI 액션:
find_references({
  symbolName: "create_feed",
  projectPath: "/Users/grove/workspace/fallingo",
  filePath: "app/services/feed_service.py",
  line: 45
})

결과:
- app/api/v1/feeds.py:23
- tests/test_feed_service.py:67
```

---

## 🧠 사고 과정 도구

### `step_by_step_analysis` - 복잡한 문제 단계별 분석

**언제 사용?**
- 복잡한 버그 디버깅
- 아키텍처 리팩토링 계획
- 성능 최적화 전략 수립

**파라미터:**
```typescript
{
  task: string;                        // 분석할 작업
  detailLevel?: "basic" | "detailed" | "comprehensive";
  context?: string;                    // 추가 컨텍스트
}
```

**실전 예시:**
```markdown
사용자: "N+1 쿼리 문제 해결 방법 단계별로 분석해줘"

AI 액션:
step_by_step_analysis({
  task: "피드 목록 조회 시 N+1 쿼리 문제 해결",
  detailLevel: "detailed",
  context: "사용자별 피드 개수를 함께 조회하는 API"
})

결과:
1단계: 현재 쿼리 패턴 분석
2단계: N+1 발생 지점 식별
3단계: selectinload/joinedload 적용
4단계: 성능 측정 및 검증
```

---

### `break_down_problem` - 문제를 작은 단위로 분해

**언제 사용?**
- 큰 기능 구현 계획
- 복잡한 비즈니스 로직 설계
- 리팩토링 범위 결정

**파라미터:**
```typescript
{
  problem: string;
  approach?: "sequential" | "hierarchical" | "dependency-based";
  maxDepth?: number;    // 분해 깊이 (기본 3)
}
```

**실전 예시:**
```markdown
사용자: "OCR 영수증 인증 시스템 구현을 어떻게 나눠야 할까?"

AI 액션:
break_down_problem({
  problem: "OCR 영수증 인증 시스템 구현",
  approach: "dependency-based",
  maxDepth: 3
})

결과:
1. 이미지 업로드 API (의존성 없음)
  1.1. GCS 저장
  1.2. 파일 검증
2. Document AI 연동 (1에 의존)
  2.1. OCR 요청
  2.2. 텍스트 추출
3. 영수증 검증 로직 (2에 의존)
  3.1. 날짜 파싱
  3.2. 24시간 이내 확인
  3.3. 레스토랑 이름 매칭
```

---

### `think_aloud_process` - 생각 과정 공유

**언제 사용?**
- 복잡한 설계 결정
- 트레이드오프 비교
- 코드 리뷰 추론

**파라미터:**
```typescript
{
  scenario: string;
  perspective?: "analytical" | "creative" | "systematic" | "critical";
  verbosity?: "concise" | "moderate" | "verbose";
}
```

---

## 📋 기획/문서 도구

### `generate_prd` - 제품 요구사항 문서 생성

**언제 사용?**
- 새 기능 기획
- 프로젝트 킥오프
- 요구사항 정리

**파라미터:**
```typescript
{
  productName: string;
  productVision: string;
  functionalRequirements?: string;
  targetAudience?: string;
  businessObjectives?: string;
  constraints?: string;
}
```

**실전 예시:**
```markdown
사용자: "AI 추천 시스템 PRD 작성해줘"

AI 액션:
generate_prd({
  productName: "AI 기반 레스토랑 추천 시스템",
  productVision: "사용자의 취향과 위치를 분석하여 최적의 레스토랑 추천",
  functionalRequirements: "1. 사용자 프로필 분석 2. 위치 기반 필터링 3. Gemini API 연동",
  targetAudience: "Tier 5 이상 사용자",
  constraints: "Gemini API 호출 비용 월 $100 이하"
})
```

---

### `create_user_stories` - 사용자 스토리 생성

**언제 사용?**
- 요구사항을 구체적인 작업으로 전환
- 스프린트 계획
- 백로그 작성

**파라미터:**
```typescript
{
  features: string;
  userTypes?: string;
  priority?: "high" | "medium" | "low";
  includeAcceptanceCriteria?: boolean;
}
```

**실전 예시:**
```markdown
사용자: "팔로우 기능 사용자 스토리 만들어줘"

AI 액션:
create_user_stories({
  features: "QR 코드 팔로우, 근거리 탐지 팔로우",
  userTypes: "Tier 4 이상 사용자",
  priority: "high",
  includeAcceptanceCriteria: true
})

결과:
**스토리 1**: QR 코드 팔로우
- As a Tier 4 사용자
- I want to QR 코드를 스캔하여 다른 사용자를 팔로우
- So that 오프라인에서 쉽게 연결할 수 있다

**Acceptance Criteria:**
- [ ] QR 코드 생성 API
- [ ] QR 스캔 화면
- [ ] 팔로우 성공 알림
```

---

### `format_as_plan` - 내용을 체크리스트로 변환

**언제 사용?**
- 작업 목록 정리
- 구현 순서 명확화
- 진행 상황 추적

**파라미터:**
```typescript
{
  content: string;
  priority?: "high" | "medium" | "low";
  includeCheckboxes?: boolean;
  includeTimeEstimates?: boolean;
}
```

**실전 예시:**
```markdown
사용자: "이 내용을 체크리스트로 만들어줘: 인증 API 구현, 프로필 화면, 테스트 작성"

AI 액션:
format_as_plan({
  content: "인증 API 구현, 프로필 화면 구현, 통합 테스트 작성",
  priority: "high",
  includeCheckboxes: true,
  includeTimeEstimates: true
})

결과:
## 구현 계획 (우선순위: High)
- [ ] 인증 API 구현 (예상 시간: 4시간)
- [ ] 프로필 화면 구현 (예상 시간: 6시간)
- [ ] 통합 테스트 작성 (예상 시간: 3시간)
```

---

## 🎨 코드 품질 도구

### `validate_code_quality` - 코드 품질 검증

**언제 사용?**
- 코드 리뷰 전
- 리팩토링 후 검증
- PR 제출 전

**파라미터:**
```typescript
{
  code: string;
  type?: "component" | "function" | "hook" | "utility" | "general";
  metrics?: "complexity" | "coupling" | "cohesion" | "maintainability" | "performance" | "all";
  strict?: boolean;
}
```

**실전 예시:**
```markdown
사용자: "이 함수 품질 검사해줘"

AI 액션:
validate_code_quality({
  code: `def create_feed(data, user): ...`,
  type: "function",
  metrics: "all",
  strict: true
})

결과:
❌ Cyclomatic Complexity: 15 (목표 ≤10)
✅ Type Hints: 100%
⚠️ Docstring 누락
✅ 보안 문제 없음
```

---

### `analyze_complexity` - 복잡도 분석

**언제 사용?**
- 함수가 너무 복잡한지 확인
- 리팩토링 필요성 판단
- 코드 메트릭 측정

**파라미터:**
```typescript
{
  code: string;
  metrics?: "cyclomatic" | "cognitive" | "halstead" | "all";
}
```

**실전 예시:**
```markdown
사용자: "이 코드 복잡도 계산해줘"

AI 액션:
analyze_complexity({
  code: `def process_order(...): ...`,
  metrics: "all"
})

결과:
- Cyclomatic Complexity: 12
- Cognitive Complexity: 18
- Halstead Difficulty: 22.5
→ 리팩토링 권장
```

---

### `suggest_improvements` - 개선 제안

**언제 사용?**
- 코드 최적화 아이디어 필요
- 성능 개선 방법 모색
- 가독성 향상 방법

**파라미터:**
```typescript
{
  code: string;
  focus?: "performance" | "readability" | "maintainability" | "accessibility" | "type-safety";
  priority?: "critical" | "high" | "medium" | "low";
}
```

**실전 예시:**
```markdown
사용자: "이 코드 성능 개선 방법 알려줘"

AI 액션:
suggest_improvements({
  code: `for user in users: feeds = db.query(Feed).filter(...).all()`,
  focus: "performance",
  priority: "high"
})

결과:
1. N+1 쿼리 문제 → selectinload 사용
2. 불필요한 전체 컬럼 조회 → 필요한 컬럼만 선택
3. 인덱스 없음 → user_id 컬럼에 인덱스 추가
```

---

## 🎨 UI 미리보기

### `preview_ui_ascii` - 코딩 전 화면 구조 미리보기

**언제 사용?**
- Flutter/React 화면 구현 전
- 레이아웃 설계
- 디자인 검토

**파라미터:**
```typescript
{
  page_name: string;
  components: Array<{
    type: string;      // "header", "sidebar", "button", "input", "card" 등
    label: string;
    position: string;  // "top", "left", "center", "right", "bottom"
  }>;
  layout_type?: "sidebar" | "header-footer" | "grid" | "centered" | "split";
  responsive?: boolean;
  width?: number;
}
```

**실전 예시:**
```markdown
사용자: "로그인 페이지 레이아웃 미리 보고 싶어"

AI 액션:
preview_ui_ascii({
  page_name: "Login Page",
  components: [
    { type: "header", label: "Fallingo", position: "top" },
    { type: "input", label: "Email", position: "center" },
    { type: "input", label: "Password", position: "center" },
    { type: "button", label: "로그인", position: "center" },
    { type: "button", label: "Google 로그인", position: "center" }
  ],
  layout_type: "centered",
  width: 60
})

결과:
┌────────────────────────────────────────────────────────┐
│                      Fallingo                          │
├────────────────────────────────────────────────────────┤
│                                                        │
│              ┌──────────────────────┐                  │
│              │ Email                │                  │
│              └──────────────────────┘                  │
│                                                        │
│              ┌──────────────────────┐                  │
│              │ Password             │                  │
│              └──────────────────────┘                  │
│                                                        │
│                  [  로그인  ]                          │
│                  [ Google 로그인 ]                     │
└────────────────────────────────────────────────────────┘
```

---

## 💾 메모리 도구

### `save_memory` - 중요 결정사항 저장

**언제 사용?**
- API 설계 결정 기록
- 코딩 컨벤션 저장
- 리팩토링 이유 기록

**파라미터:**
```typescript
{
  key: string;
  value: string;
  category?: "project" | "personal" | "code" | "notes";
}
```

**실전 예시:**
```markdown
사용자: "이 API 설계 결정 기억해줘"

AI 액션:
save_memory({
  key: "feed_api_design",
  value: "피드 생성 시 GPS 검증을 먼저 수행한 후 Vision API 호출. 이유: GPS 실패 시 불필요한 AI 호출 방지 (비용 절감)",
  category: "project"
})
```

---

### `recall_memory` - 이전 결정 회상

**언제 사용?**
- 과거 설계 이유 확인
- 컨벤션 일관성 유지
- 중복 논의 방지

**파라미터:**
```typescript
{
  key: string;
  category?: string;
}
```

---

### `prioritize_memory` - 중요한 컨텍스트 우선순위 지정

**언제 사용?**
- 세션 종료 전 핵심 내용 저장
- 긴 대화의 요약
- 다음 작업 준비

**파라미터:**
```typescript
{
  currentTask: string;
  criticalDecisions?: string[];
  codeChanges?: string[];
  blockers?: string[];
  nextSteps?: string[];
}
```

**실전 예시:**
```markdown
대화가 길어질 때:

AI 액션:
prioritize_memory({
  currentTask: "OCR 영수증 인증 시스템 구현",
  criticalDecisions: [
    "Document AI 사용 결정 (Vision API보다 정확도 높음)",
    "영수증 24시간 검증은 server timezone 기준"
  ],
  codeChanges: [
    "app/services/ocr_service.py 생성",
    "app/api/v1/feeds.py에 영수증 업로드 엔드포인트 추가"
  ],
  blockers: [
    "Document AI 크레딧 부족 → GCP 청구 설정 필요"
  ],
  nextSteps: [
    "영수증 텍스트 파싱 로직 구현",
    "레스토랑 이름 매칭 알고리즘",
    "테스트 케이스 작성"
  ]
})
```

---

## 🚀 세션 관리

### `start_session` - 세션 시작 시 컨텍스트 로드

**언제 사용?**
- 새로운 대화 시작
- 프로젝트 전환
- 컨텍스트 복원

**파라미터:**
```typescript
{
  greeting?: string;
  loadMemory?: boolean;        // 기본 true
  restoreContext?: boolean;    // 기본 true
  loadGuides?: boolean;        // 기본 true
}
```

**자동 트리거:**
사용자가 "hi-ai", "하이아이", "안녕" 같은 인사말을 하면 자동 호출됩니다.

---

## 📊 사용 우선순위 가이드

### 🔴 최우선 (매번 사용)
- `find_symbol` - 코드 수정 전 항상 위치 확인
- `save_memory` - 중요 결정 즉시 저장
- `validate_code_quality` - 코드 완성 후 자동 검증

### 🟡 자주 사용
- `step_by_step_analysis` - 복잡한 작업 시작 전
- `suggest_improvements` - 코드 완성 후 최적화
- `format_as_plan` - 여러 작업을 체계화

### 🟢 선택적 사용
- `generate_prd` - 새 기능 기획 시
- `preview_ui_ascii` - UI 구현 전 레이아웃 확인
- `think_aloud_process` - 복잡한 설계 결정 시

---

## ⚠️ 주의사항

### 1. projectPath는 항상 절대 경로
```typescript
// ✅ 올바른 예
projectPath: "/Users/grove/workspace/fallingo"

// ❌ 잘못된 예
projectPath: "./fallingo"
projectPath: "~/workspace/fallingo"
```

### 2. 메모리 key는 의미 있게
```typescript
// ✅ 올바른 예
key: "feed_api_design_decision"

// ❌ 잘못된 예
key: "temp"
key: "note1"
```

### 3. code 파라미터는 전체 함수/클래스 제공
```typescript
// ✅ 완전한 코드
code: `
def create_feed(data: CreateFeedRequest, user: User) -> Feed:
    """피드를 생성합니다."""
    # ... 전체 구현
    return feed
`

// ❌ 일부만 제공
code: "def create_feed(..."
```

---

## 🎯 실전 워크플로우 예시

### 시나리오: 새 API 엔드포인트 구현

```markdown
1. find_symbol → 기존 패턴 찾기
   "create_user API 어디있어?"

2. step_by_step_analysis → 구현 계획
   "create_feed API 구현을 단계별로 분석해줘"

3. save_memory → 설계 결정 저장
   "이 API는 GPS 검증을 먼저 한다는 결정 기억해줘"

4. [코드 작성]

5. validate_code_quality → 품질 검증
   "이 코드 품질 검사해줘"

6. suggest_improvements → 최적화
   "성능 개선 방법 알려줘"

7. prioritize_memory → 세션 종료 전 요약
   "오늘 작업 내용 우선순위 지정해서 저장해줘"
```
