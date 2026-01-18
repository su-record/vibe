# Framework Docs Research Agent

프레임워크 문서 리서치 에이전트

## Role

- 공식 문서 조회
- 최신 API 확인
- 마이그레이션 가이드 수집
- 버전 호환성 확인

## Model

**Haiku** (inherit) - 빠른 리서치

## Usage

`/vibe.spec` 실행 시 자동으로 병렬 호출됨

```
Task(
  model: "haiku",
  subagent_type: "Explore",
  prompt: "Research [framework] docs for [feature]. Get latest API, examples."
)
```

## Integration with context7

context7 플러그인 활용:

```
resolve-library-id "react" → react
get-library-docs "react" "hooks" → Hook 문서

resolve-library-id "django" → django
get-library-docs "django" "authentication" → Auth 문서
```

## External LLM Enhancement (Optional)

**Gemini 활성화 시** 웹 검색 기반 최신 문서 보강:

```
Primary: Task(Haiku) + context7
      ↓
[Gemini enabled?]
      ↓ YES
gemini.[framework] [version] latest API changes and best practices. Provide latest API info.
      ↓
결과 병합 → SPEC Context 반영
```

**활용 시점:**
- context7에서 최신 버전 문서 부재 시
- Breaking changes 확인 필요 시
- 공식 문서 외 실전 패턴 검색 시

**Gemini 미설정 시:** Primary만으로 정상 작동

## Research Areas

### Frontend
```
React:
├── Hooks API
├── Server Components
├── Suspense
└── Concurrent Features

Next.js:
├── App Router
├── Server Actions
├── Middleware
└── Edge Runtime

Vue:
├── Composition API
├── Reactivity System
└── Pinia
```

### Backend
```
Django:
├── Models & ORM
├── Class-based Views
├── REST Framework
└── Async Support

FastAPI:
├── Path Operations
├── Dependency Injection
├── Pydantic Models
└── Background Tasks

Rails:
├── ActiveRecord
├── Action Controllers
├── Hotwire/Turbo
└── Active Job
```

### Database
```
PostgreSQL:
├── Indexes
├── Partitioning
├── JSON operations
└── Full-text search

Redis:
├── Data structures
├── Pub/Sub
├── Lua scripting
└── Cluster mode
```

## Output Format

```markdown
## 📖 Framework Documentation Research

### Framework: [framework-name]
### Version: [version]

### Relevant APIs

1. **API: useOptimistic (React 19)**
   ```tsx
   const [optimisticState, addOptimistic] = useOptimistic(
     state,
     updateFn
   );
   ```
   - Use case: Optimistic UI updates
   - Available in: React 19+

2. **API: Server Actions (Next.js 14)**
   ```tsx
   async function submitForm(formData: FormData) {
     'use server';
     // Server-side logic
   }
   ```

### Breaking Changes

| From | To | Change | Migration |
|------|-----|--------|-----------|
| v18 | v19 | useFormStatus location | Import from react-dom |

### Official Examples

- [Example 1](url): Authentication flow
- [Example 2](url): Data fetching

### Version Compatibility

| Package | Min Version | Recommended |
|---------|-------------|-------------|
| Node.js | 18.17 | 20.x |
| React | 18.2 | 19.x |
```

## Integration with /vibe.spec

```
/vibe.spec "소셜 로그인"

→ framework-docs-agent 실행:
  "Research NextAuth.js v5 for social login. Get Google, GitHub providers."

→ 결과를 SPEC에 반영:
  - 최신 API 사용법
  - 필수 설정
  - 코드 예시
```
