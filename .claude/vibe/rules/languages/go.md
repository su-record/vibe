# 🐹 Go 품질 규칙

## 핵심 원칙 (core에서 상속)

```markdown
✅ 단일 책임 (SRP)
✅ 중복 제거 (DRY)
✅ 재사용성
✅ 낮은 복잡도
✅ 함수 ≤ 30줄
✅ 중첩 ≤ 3단계
✅ Cyclomatic complexity ≤ 10
```

## Go 특화 규칙

### 1. 에러 처리

```go
// ❌ 에러 무시
data, _ := ioutil.ReadFile("config.json")

// ✅ 에러 항상 처리
data, err := ioutil.ReadFile("config.json")
if err != nil {
    return fmt.Errorf("설정 파일 읽기 실패: %w", err)
}

// ✅ 커스텀 에러 타입
type NotFoundError struct {
    Resource string
    ID       string
}

func (e *NotFoundError) Error() string {
    return fmt.Sprintf("%s (ID: %s)를 찾을 수 없습니다", e.Resource, e.ID)
}

// 사용
func GetUser(id string) (*User, error) {
    user, err := repo.FindByID(id)
    if err != nil {
        return nil, fmt.Errorf("사용자 조회 실패: %w", err)
    }
    if user == nil {
        return nil, &NotFoundError{Resource: "사용자", ID: id}
    }
    return user, nil
}
```

### 2. 구조체와 인터페이스

```go
// ✅ 구조체 정의
type User struct {
    ID        string    `json:"id"`
    Email     string    `json:"email"`
    Name      string    `json:"name"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}

// ✅ 생성자 함수
func NewUser(email, name string) *User {
    now := time.Now()
    return &User{
        ID:        uuid.New().String(),
        Email:     email,
        Name:      name,
        CreatedAt: now,
        UpdatedAt: now,
    }
}

// ✅ 작은 인터페이스 (Go의 철학)
type Reader interface {
    Read(p []byte) (n int, err error)
}

type Writer interface {
    Write(p []byte) (n int, err error)
}

// ✅ 인터페이스 조합
type ReadWriter interface {
    Reader
    Writer
}

// ✅ Repository 인터페이스
type UserRepository interface {
    FindByID(ctx context.Context, id string) (*User, error)
    FindByEmail(ctx context.Context, email string) (*User, error)
    Create(ctx context.Context, user *User) error
    Update(ctx context.Context, user *User) error
    Delete(ctx context.Context, id string) error
}
```

### 3. Context 사용

```go
// ✅ Context 전파
func (s *UserService) GetUser(ctx context.Context, id string) (*User, error) {
    // Context를 하위 함수에 전달
    user, err := s.repo.FindByID(ctx, id)
    if err != nil {
        return nil, err
    }
    return user, nil
}

// ✅ Context 타임아웃
func (h *Handler) HandleRequest(w http.ResponseWriter, r *http.Request) {
    ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
    defer cancel()

    result, err := h.service.Process(ctx)
    if err != nil {
        if errors.Is(err, context.DeadlineExceeded) {
            http.Error(w, "요청 시간 초과", http.StatusRequestTimeout)
            return
        }
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    json.NewEncoder(w).Encode(result)
}
```

### 4. HTTP 핸들러 (net/http, Gin, Echo)

```go
// ✅ net/http 핸들러
func (h *UserHandler) GetUser(w http.ResponseWriter, r *http.Request) {
    id := chi.URLParam(r, "id")

    user, err := h.service.GetUser(r.Context(), id)
    if err != nil {
        var notFound *NotFoundError
        if errors.As(err, &notFound) {
            http.Error(w, err.Error(), http.StatusNotFound)
            return
        }
        http.Error(w, "서버 오류", http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(user)
}

// ✅ Gin 핸들러
func (h *UserHandler) GetUser(c *gin.Context) {
    id := c.Param("id")

    user, err := h.service.GetUser(c.Request.Context(), id)
    if err != nil {
        var notFound *NotFoundError
        if errors.As(err, &notFound) {
            c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
            return
        }
        c.JSON(http.StatusInternalServerError, gin.H{"error": "서버 오류"})
        return
    }

    c.JSON(http.StatusOK, user)
}

// ✅ Echo 핸들러
func (h *UserHandler) GetUser(c echo.Context) error {
    id := c.Param("id")

    user, err := h.service.GetUser(c.Request().Context(), id)
    if err != nil {
        var notFound *NotFoundError
        if errors.As(err, &notFound) {
            return c.JSON(http.StatusNotFound, map[string]string{"error": err.Error()})
        }
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "서버 오류"})
    }

    return c.JSON(http.StatusOK, user)
}
```

### 5. 의존성 주입

```go
// ✅ 구조체에 의존성 주입
type UserService struct {
    repo   UserRepository
    cache  CacheRepository
    logger *slog.Logger
}

func NewUserService(
    repo UserRepository,
    cache CacheRepository,
    logger *slog.Logger,
) *UserService {
    return &UserService{
        repo:   repo,
        cache:  cache,
        logger: logger,
    }
}

// ✅ 옵션 패턴
type ServerOption func(*Server)

func WithPort(port int) ServerOption {
    return func(s *Server) {
        s.port = port
    }
}

func WithTimeout(timeout time.Duration) ServerOption {
    return func(s *Server) {
        s.timeout = timeout
    }
}

func NewServer(opts ...ServerOption) *Server {
    s := &Server{
        port:    8080,           // 기본값
        timeout: 30 * time.Second,
    }
    for _, opt := range opts {
        opt(s)
    }
    return s
}

// 사용
server := NewServer(
    WithPort(3000),
    WithTimeout(60*time.Second),
)
```

### 6. 동시성

```go
// ✅ Goroutine + Channel
func ProcessItems(ctx context.Context, items []Item) ([]Result, error) {
    results := make(chan Result, len(items))
    errs := make(chan error, len(items))

    var wg sync.WaitGroup
    for _, item := range items {
        wg.Add(1)
        go func(item Item) {
            defer wg.Done()
            result, err := processItem(ctx, item)
            if err != nil {
                errs <- err
                return
            }
            results <- result
        }(item)
    }

    // 결과 수집
    go func() {
        wg.Wait()
        close(results)
        close(errs)
    }()

    var finalResults []Result
    for result := range results {
        finalResults = append(finalResults, result)
    }

    // 첫 번째 에러 반환
    select {
    case err := <-errs:
        return nil, err
    default:
        return finalResults, nil
    }
}

// ✅ errgroup 사용 (권장)
import "golang.org/x/sync/errgroup"

func ProcessItems(ctx context.Context, items []Item) ([]Result, error) {
    g, ctx := errgroup.WithContext(ctx)
    results := make([]Result, len(items))

    for i, item := range items {
        i, item := i, item // 클로저 캡처
        g.Go(func() error {
            result, err := processItem(ctx, item)
            if err != nil {
                return err
            }
            results[i] = result
            return nil
        })
    }

    if err := g.Wait(); err != nil {
        return nil, err
    }
    return results, nil
}
```

### 7. 테스트

```go
// ✅ 테이블 기반 테스트
func TestAdd(t *testing.T) {
    tests := []struct {
        name     string
        a, b     int
        expected int
    }{
        {"양수 덧셈", 2, 3, 5},
        {"음수 덧셈", -1, -2, -3},
        {"영과 덧셈", 0, 5, 5},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := Add(tt.a, tt.b)
            if result != tt.expected {
                t.Errorf("Add(%d, %d) = %d; want %d", tt.a, tt.b, result, tt.expected)
            }
        })
    }
}

// ✅ Mock 사용 (testify)
type MockUserRepository struct {
    mock.Mock
}

func (m *MockUserRepository) FindByID(ctx context.Context, id string) (*User, error) {
    args := m.Called(ctx, id)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*User), args.Error(1)
}

func TestUserService_GetUser(t *testing.T) {
    mockRepo := new(MockUserRepository)
    service := NewUserService(mockRepo, nil, slog.Default())

    expectedUser := &User{ID: "123", Name: "테스트"}
    mockRepo.On("FindByID", mock.Anything, "123").Return(expectedUser, nil)

    user, err := service.GetUser(context.Background(), "123")

    assert.NoError(t, err)
    assert.Equal(t, expectedUser, user)
    mockRepo.AssertExpectations(t)
}
```

## 파일 구조

```
project/
├── cmd/
│   └── server/
│       └── main.go       # 엔트리포인트
├── internal/
│   ├── domain/           # 도메인 모델
│   ├── handler/          # HTTP 핸들러
│   ├── service/          # 비즈니스 로직
│   ├── repository/       # 데이터 액세스
│   └── middleware/       # 미들웨어
├── pkg/                  # 외부 공개 패키지
├── config/               # 설정
├── migrations/           # DB 마이그레이션
├── go.mod
└── go.sum
```

## 체크리스트

- [ ] 에러 항상 처리 (_, err 금지)
- [ ] fmt.Errorf("%w", err)로 에러 래핑
- [ ] Context 첫 번째 인자로 전달
- [ ] 작은 인터페이스 정의
- [ ] 생성자 함수 (NewXxx) 사용
- [ ] 테이블 기반 테스트
- [ ] gofmt, golint, go vet 통과
- [ ] 동시성에서 race condition 주의
