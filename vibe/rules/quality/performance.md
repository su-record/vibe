# Performance Standards

> 성능은 사후 최적화가 아니라 설계 단계부터 고려해야 한다.

## 1. 프론트엔드 최적화

### React 메모이제이션 기준

| Hook/API | 사용 기준 | 사용하지 않을 때 |
|----------|----------|----------------|
| `React.memo` | props가 자주 같은 값으로 전달되는 컴포넌트 | 항상 다른 props를 받는 컴포넌트 |
| `useMemo` | 계산 비용이 높은 파생 데이터 | 단순 참조나 원시값 |
| `useCallback` | 자식 컴포넌트에 전달되는 콜백 함수 | 인라인으로만 사용되는 핸들러 |

```typescript
// ❌ Bad: 불필요한 메모이제이션
const name = useMemo(() => user.name, [user.name]); // 단순 참조

// ✅ Good: 비용이 높은 계산에만 적용
const sortedItems = useMemo(
  () => items.sort((a, b) => a.price - b.price),
  [items]
);

// ❌ Bad: 매 렌더마다 새 객체 생성 → 자식 리렌더
<ChildComponent style={{ color: "red" }} />

// ✅ Good: 스타일 객체 메모이제이션 또는 외부 선언
const style = useMemo(() => ({ color: "red" }), []);
<ChildComponent style={style} />
```

### 번들 크기 최적화

- 목표: Production gzip 기준 initial JS **200KB 이하** (next build output 또는 bundle analyzer로 측정)
- 코드 스플리팅: `React.lazy` + `Suspense`로 경로별 분할
- 트리 쉐이킹: barrel import 회피, 개별 모듈 직접 import

```typescript
// ❌ Bad: barrel import → 전체 번들 포함
import { Button, Icon, Modal } from "@/components";

// ✅ Good: 직접 import → 트리 쉐이킹 가능
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";

// ❌ Bad: 동적 로딩 없이 무거운 컴포넌트 직접 import
import HeavyChart from "@/components/HeavyChart";

// ✅ Good: 동적 import로 코드 스플리팅
const HeavyChart = lazy(() => import("@/components/HeavyChart"));
```

### 이미지 최적화

- WebP/AVIF 포맷 우선 사용
- `loading="lazy"` 속성으로 뷰포트 밖 이미지 지연 로딩
- Next.js의 `next/image` 컴포넌트 활용 (자동 최적화)
- 적절한 `width`/`height` 속성으로 CLS 방지

```typescript
// ❌ Bad: 최적화 없는 이미지
<img src="/photo.jpg" />

// ✅ Good: 최적화된 이미지
import Image from "next/image";
<Image src="/photo.jpg" alt="설명" width={800} height={600} loading="lazy" />
```

## 2. 백엔드 최적화

### DB 인덱스 설계 원칙

1. **WHERE/JOIN 대상 컬럼**에 인덱스 생성
2. **복합 인덱스** 순서: 선택도(cardinality)가 높은 컬럼을 앞에 배치
3. **커버링 인덱스**: SELECT 컬럼까지 인덱스에 포함하면 테이블 스캔 회피

```sql
-- ❌ Bad: 인덱스 없이 빈번한 조회
SELECT * FROM orders WHERE user_id = ? AND status = 'pending';

-- ✅ Good: 복합 인덱스 생성
CREATE INDEX idx_orders_user_status ON orders (user_id, status);
```

### N+1 쿼리 방지

```typescript
// ❌ Bad: N+1 쿼리 (users 수만큼 추가 쿼리)
const users = await db.users.findAll();
for (const user of users) {
  user.orders = await db.orders.findByUserId(user.id);
}

// ✅ Good: Eager Loading (JOIN 또는 IN 쿼리)
const users = await db.users.findAll({
  include: [{ model: db.orders }],
});

// ✅ Good: 배치 쿼리
const users = await db.users.findAll();
const userIds = users.map((u) => u.id);
const orders = await db.orders.findAll({ where: { userId: userIds } });
```

### 캐싱 전략

| 데이터 유형 | TTL 기준 | 캐시 레벨 |
|------------|---------|----------|
| 정적 설정 | 1시간~24시간 | 메모리(LRU) |
| 사용자 세션 | 30분~2시간 | Redis/메모리 |
| API 응답 | 1분~10분 | HTTP 캐시 헤더 |
| DB 쿼리 결과 | 5분~30분 | 애플리케이션 레벨 |

```typescript
// ❌ Bad: 매 요청마다 DB 조회
app.get("/api/config", async (req, res) => {
  const config = await db.config.findAll();
  res.json(config);
});

// ✅ Good: 캐시 적용
const cache = new Map<string, { data: unknown; expiry: number }>();

app.get("/api/config", async (req, res) => {
  const cached = cache.get("config");
  if (cached && cached.expiry > Date.now()) {
    return res.json(cached.data);
  }
  const config = await db.config.findAll();
  cache.set("config", { data: config, expiry: Date.now() + 3600000 });
  res.json(config);
});
```

### API 최적화

- 응답 압축 (gzip/brotli) 활성화
- 적절한 캐시 헤더 (`Cache-Control`, `ETag`)
- 페이지네이션 필수 (기본 limit 20~50)
- 불필요한 필드 제외 (SELECT * 지양)

## 3. 알고리즘 복잡도

### 경고 기준

| 복잡도 | 판정 | 대응 |
|--------|------|------|
| O(1), O(log n) | 양호 | - |
| O(n) | 양호 | 데이터 크기 주의 |
| O(n log n) | 주의 | 정렬 등 불가피한 경우만 |
| O(n²) 이상 | **경고** | 반드시 대안 검토 |

```typescript
// ❌ Bad: O(n²) 중첩 루프
function findDuplicates(arr: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[i] === arr[j]) result.push(arr[i]);
    }
  }
  return result;
}

// ✅ Good: O(n) Set 활용
function findDuplicates(arr: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const item of arr) {
    if (seen.has(item)) dupes.add(item);
    seen.add(item);
  }
  return [...dupes];
}
```

- 배열 탐색 → `Set`/`Map` 사용 (O(1) lookup)
- 정렬 후 이진 탐색 → O(n log n + log n) vs O(n) 비교
- 중첩 루프 → `Map` 기반 인덱싱으로 평탄화

## 4. Web Vitals 기준

> 출처: Google Web.dev — Lighthouse 모바일 프리셋 측정 기준

| 지표 | 기준 (Good) | 의미 |
|------|------------|------|
| LCP (Largest Contentful Paint) | < 2.5s | 주요 콘텐츠 렌더링 시간 |
| INP (Interaction to Next Paint) | < 200ms | 사용자 인터랙션 반응 시간 |
| CLS (Cumulative Layout Shift) | < 0.1 | 레이아웃 흔들림 정도 |

### LCP 최적화

- 주요 이미지에 `priority` 속성 또는 `fetchpriority="high"` 적용
- 폰트 `preload` 설정
- 서버 응답 시간 최소화 (TTFB < 800ms)

### INP 최적화

- 무거운 이벤트 핸들러는 `requestIdleCallback` 또는 Web Worker로 분리
- `startTransition`으로 비긴급 UI 업데이트 지연

### CLS 최적화

- 이미지/비디오에 `width`/`height` 명시
- 동적 콘텐츠 삽입 시 공간 사전 확보
- 폰트 로딩 전략: `font-display: swap` + `size-adjust`

## 5. 성능 체크리스트

### 프론트엔드

- [ ] O(n²) 이상 알고리즘 검토
- [ ] 불필요한 리렌더링 제거
- [ ] `React.memo`/`useMemo`/`useCallback` 적절 적용
- [ ] 번들 사이즈 200KB 이하 (initial JS, gzip)
- [ ] 이미지 lazy loading 적용
- [ ] 코드 스플리팅 적용
- [ ] Web Vitals 기준 충족 (LCP < 2.5s, INP < 200ms, CLS < 0.1)

### 백엔드

- [ ] DB 쿼리에 적절한 인덱스 존재
- [ ] N+1 쿼리 없음
- [ ] 캐싱 전략 적용
- [ ] 페이지네이션 구현
- [ ] 응답 압축 활성화
- [ ] 불필요한 SELECT * 제거

### 공통

- [ ] 알고리즘 복잡도 O(n²) 이상 항목 없음 또는 대안 문서화
- [ ] 대량 데이터 처리 시 스트리밍/청크 처리 적용
- [ ] 메모리 누수 점검 (이벤트 리스너 해제, 타이머 정리)

> **vibe 도구 연계**: `core_analyze_complexity`로 함수 복잡도 측정, `/vibe.review`의 performance-reviewer 에이전트로 자동 성능 리뷰
