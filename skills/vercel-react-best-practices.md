---
description: "React/Next.js 성능 최적화 가이드 (Vercel 엔지니어링 기반). React 컴포넌트 작성, 리뷰, 리팩토링 시 자동 활성화. 45개 룰, 8개 카테고리별 Priority 체계."
---

# Vercel React Best Practices

Vercel 엔지니어링 팀의 React/Next.js 성능 최적화 종합 가이드. 45개 룰을 8개 카테고리로 분류하고 영향도 기반 Priority 체계로 정리한다.

## 적용 시점

- React 컴포넌트 또는 Next.js 페이지 작성 시
- 데이터 페칭 (클라이언트/서버) 구현 시
- 성능 이슈 코드 리뷰 시
- 기존 React/Next.js 코드 리팩토링 시
- 번들 크기 또는 로딩 시간 최적화 시

## 카테고리별 Priority 체계

| Priority | 카테고리 | 영향도 | 접두사 |
|----------|---------|--------|--------|
| 1 | Waterfall 제거 | CRITICAL | `async-` |
| 2 | 번들 크기 최적화 | CRITICAL | `bundle-` |
| 3 | 서버사이드 성능 | HIGH | `server-` |
| 4 | 클라이언트 데이터 페칭 | MEDIUM-HIGH | `client-` |
| 5 | 리렌더 최적화 | MEDIUM | `rerender-` |
| 6 | 렌더링 성능 | MEDIUM | `rendering-` |
| 7 | JavaScript 성능 | LOW-MEDIUM | `js-` |
| 8 | 고급 패턴 | LOW | `advanced-` |

## Quick Reference — 45개 룰 인덱스

### 1. Waterfall 제거 (CRITICAL)

| 룰 | 설명 |
|----|------|
| `async-defer-await` | await를 실제 사용하는 분기로 이동 |
| `async-parallel` | 독립적 작업은 `Promise.all()` 사용 |
| `async-dependencies` | 부분 의존성은 better-all 사용 |
| `async-api-routes` | Promise를 일찍 시작하고, 늦게 await |
| `async-suspense-boundaries` | Suspense로 콘텐츠 스트리밍 |

**핵심 예시 — `async-parallel` (CRITICAL):**

```typescript
// ❌ Bad: 순차 실행 → waterfall
const user = await getUser(id);
const posts = await getPosts(id);
const comments = await getComments(id);

// ✅ Good: 병렬 실행
const [user, posts, comments] = await Promise.all([
  getUser(id),
  getPosts(id),
  getComments(id),
]);
```

### 2. 번들 크기 최적화 (CRITICAL)

| 룰 | 설명 |
|----|------|
| `bundle-barrel-imports` | barrel 파일 회피, 직접 import |
| `bundle-dynamic-imports` | 무거운 컴포넌트는 `next/dynamic` 사용 |
| `bundle-defer-third-party` | 분석/로깅은 hydration 후 로드 |
| `bundle-conditional` | 기능 활성화 시에만 모듈 로드 |
| `bundle-preload` | hover/focus 시 preload로 체감 속도 향상 |

**핵심 예시 — `bundle-barrel-imports` (CRITICAL):**

```typescript
// ❌ Bad: barrel import → 전체 번들에 포함
import { Button } from "@/components";

// ✅ Good: 직접 import → 트리 쉐이킹 가능
import { Button } from "@/components/Button";
```

### 3. 서버사이드 성능 (HIGH)

| 룰 | 설명 |
|----|------|
| `server-cache-react` | `React.cache()`로 요청 단위 중복 제거 |
| `server-cache-lru` | LRU 캐시로 요청 간 캐싱 |
| `server-serialization` | 클라이언트 컴포넌트로 전달하는 데이터 최소화 |
| `server-parallel-fetching` | 컴포넌트 구조를 재설계하여 페칭 병렬화 |
| `server-after-nonblocking` | `after()`로 논블로킹 후처리 |

**핵심 예시 — `server-cache-react` (HIGH):**

```typescript
// ❌ Bad: 같은 요청 내 중복 DB 호출
async function Layout() {
  const user = await getUser(); // 호출 1
  return <Header user={user}><Content /></Header>;
}
async function Content() {
  const user = await getUser(); // 호출 2 (중복)
  return <div>{user.name}</div>;
}

// ✅ Good: React.cache로 요청 단위 중복 제거
import { cache } from "react";
const getUser = cache(async () => {
  return await db.user.findUnique({ where: { id: currentUserId } });
});
```

### 4. 클라이언트 데이터 페칭 (MEDIUM-HIGH)

| 룰 | 설명 |
|----|------|
| `client-swr-dedup` | SWR로 자동 요청 중복 제거 |
| `client-event-listeners` | 전역 이벤트 리스너 중복 등록 방지 |

**핵심 예시 — `client-swr-dedup` (MEDIUM-HIGH):**

```typescript
// ❌ Bad: 여러 컴포넌트에서 동일 API 중복 호출
function Header() {
  const [user, setUser] = useState(null);
  useEffect(() => { fetch("/api/user").then(r => r.json()).then(setUser); }, []);
  return <div>{user?.name}</div>;
}
function Sidebar() {
  const [user, setUser] = useState(null);
  useEffect(() => { fetch("/api/user").then(r => r.json()).then(setUser); }, []);
  return <div>{user?.email}</div>;
}

// ✅ Good: SWR로 자동 중복 제거 + 캐싱
import useSWR from "swr";
function useUser() {
  return useSWR("/api/user", fetcher);
}
function Header() {
  const { data: user } = useUser(); // 같은 키 → 자동 중복 제거
  return <div>{user?.name}</div>;
}
function Sidebar() {
  const { data: user } = useUser(); // 네트워크 요청 1회만 발생
  return <div>{user?.email}</div>;
}
```

### 5. 리렌더 최적화 (MEDIUM)

| 룰 | 설명 |
|----|------|
| `rerender-defer-reads` | 콜백에서만 사용하는 state 구독 회피 |
| `rerender-memo` | 비용이 큰 계산은 메모이제이션 컴포넌트로 분리 |
| `rerender-dependencies` | effect 의존성은 원시값 사용 |
| `rerender-derived-state` | 원시 데이터 대신 파생 boolean 구독 |
| `rerender-functional-setstate` | 안정적인 콜백을 위해 함수형 setState 사용 |
| `rerender-lazy-state-init` | 비용이 큰 초기값은 함수로 전달 |
| `rerender-transitions` | 비긴급 업데이트에 startTransition 사용 |

**핵심 예시 — `rerender-memo` (MEDIUM):**

```typescript
// ❌ Bad: 부모 리렌더 시 비용 큰 계산 반복 실행
function Dashboard({ data, filter }) {
  const processed = expensiveProcess(data); // 매번 실행
  return <Chart data={processed} />;
}

// ✅ Good: 비용 큰 계산을 메모이제이션 컴포넌트로 분리
const ProcessedChart = memo(function ProcessedChart({ data }: { data: Data[] }) {
  const processed = expensiveProcess(data);
  return <Chart data={processed} />;
});
```

### 6. 렌더링 성능 (MEDIUM)

| 룰 | 설명 |
|----|------|
| `rendering-animate-svg-wrapper` | SVG 요소 대신 div wrapper 애니메이션 |
| `rendering-content-visibility` | 긴 목록에 content-visibility 적용 |
| `rendering-hoist-jsx` | 정적 JSX를 컴포넌트 외부로 분리 |
| `rendering-svg-precision` | SVG 좌표 정밀도 축소 |
| `rendering-hydration-no-flicker` | 인라인 스크립트로 클라이언트 전용 데이터 깜빡임 방지 |
| `rendering-activity` | Activity 컴포넌트로 show/hide 처리 |
| `rendering-conditional-render` | `&&` 대신 삼항 연산자 사용 |

**핵심 예시 — `rendering-content-visibility` (MEDIUM):**

```css
/* ❌ Bad: 긴 목록의 모든 항목을 즉시 렌더링 */
.list-item {
  /* 기본: 모든 항목 렌더링 */
}

/* ✅ Good: 뷰포트 밖 항목은 렌더링 지연 */
.list-item {
  content-visibility: auto;
  contain-intrinsic-size: 0 80px;
}
```

**핵심 예시 — `rendering-hoist-jsx` (MEDIUM):**

```typescript
// ❌ Bad: 리렌더마다 정적 JSX 재생성
function Page({ data }) {
  return (
    <div>
      <header><h1>My App</h1><nav>...</nav></header>
      <main>{data.map(item => <Card key={item.id} {...item} />)}</main>
    </div>
  );
}

// ✅ Good: 정적 JSX를 컴포넌트 외부로 분리
const HEADER = <header><h1>My App</h1><nav>...</nav></header>;

function Page({ data }) {
  return (
    <div>
      {HEADER}
      <main>{data.map(item => <Card key={item.id} {...item} />)}</main>
    </div>
  );
}
```

### 7. JavaScript 성능 (LOW-MEDIUM)

| 룰 | 설명 |
|----|------|
| `js-batch-dom-css` | CSS 변경은 class 또는 cssText로 일괄 처리 |
| `js-index-maps` | 반복 조회는 Map으로 인덱싱 |
| `js-cache-property-access` | 루프 내 객체 속성 캐싱 |
| `js-cache-function-results` | 함수 결과를 모듈 레벨 Map에 캐싱 |
| `js-cache-storage` | localStorage/sessionStorage 읽기 캐싱 |
| `js-combine-iterations` | 여러 filter/map을 하나의 루프로 결합 |
| `js-length-check-first` | 비용 큰 비교 전 배열 길이 먼저 확인 |
| `js-early-exit` | 함수에서 조기 반환 |
| `js-hoist-regexp` | RegExp 생성을 루프 밖으로 이동 |
| `js-min-max-loop` | sort 대신 루프로 min/max 계산 |
| `js-set-map-lookups` | O(1) 조회를 위해 Set/Map 사용 |
| `js-tosorted-immutable` | 불변 정렬에 toSorted() 사용 |

### 8. 고급 패턴 (LOW)

| 룰 | 설명 |
|----|------|
| `advanced-event-handler-refs` | 이벤트 핸들러를 ref에 저장 |
| `advanced-use-latest` | 안정적 콜백 ref를 위해 useLatest 사용 |

**핵심 예시 — `advanced-event-handler-refs` (LOW):**

```typescript
// ❌ Bad: 이벤트 핸들러가 매 렌더마다 변경 → effect 재실행
function useInterval(callback: () => void, delay: number) {
  useEffect(() => {
    const id = setInterval(callback, delay);
    return () => clearInterval(id);
  }, [callback, delay]); // callback이 매번 변경
}

// ✅ Good: ref로 최신 핸들러 참조 → effect 안정적
function useInterval(callback: () => void, delay: number) {
  const savedCallback = useRef(callback);
  useEffect(() => { savedCallback.current = callback; });
  useEffect(() => {
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]); // delay만 의존
}
```

## 카테고리별 룰 수 요약

| 카테고리 | 룰 수 | 영향도 |
|---------|-------|--------|
| Waterfall 제거 | 5 | CRITICAL |
| 번들 크기 최적화 | 5 | CRITICAL |
| 서버사이드 성능 | 5 | HIGH |
| 클라이언트 데이터 페칭 | 2 | MEDIUM-HIGH |
| 리렌더 최적화 | 7 | MEDIUM |
| 렌더링 성능 | 7 | MEDIUM |
| JavaScript 성능 | 12 | LOW-MEDIUM |
| 고급 패턴 | 2 | LOW |
| **합계** | **45** | |

## 사용 방법

이 스킬은 Quick Reference 인덱스와 카테고리별 핵심 예시를 제공한다. 각 룰의 상세 설명과 전체 코드 예시는 CCPP의 AGENTS.md를 참고한다.

### Priority 기반 적용 전략

1. **CRITICAL (Priority 1-2)**: 모든 프로젝트에서 반드시 적용
2. **HIGH (Priority 3)**: 서버 컴포넌트 사용 시 적용
3. **MEDIUM (Priority 4-6)**: 성능 이슈 발생 시 우선 검토
4. **LOW (Priority 7-8)**: 최적화 단계에서 선택 적용

### vibe 도구 연계

- `core_analyze_complexity` — 컴포넌트 복잡도 분석
- `core_validate_code_quality` — 코드 품질 검증
- `/vibe.review` — 13+ 에이전트 병렬 리뷰 (performance-reviewer 포함)
