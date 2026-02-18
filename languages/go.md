# Go Quality Rules

## Core Principles (inherited from core)

```markdown
# Core Principles (inherited from core)
Single Responsibility (SRP)
No Duplication (DRY)
Reusability
Low Complexity
Function <= 30 lines
Nesting <= 3 levels
Cyclomatic complexity <= 10
```

## Go Specific Rules

### 1. Error Handling

```go
// Bad: Ignoring error
data, _ := ioutil.ReadFile("config.json")

// Good: Always handle errors
data, err := ioutil.ReadFile("config.json")
if err != nil {
    return fmt.Errorf("failed to read config file: %w", err)
}

// Good: Custom error type
type NotFoundError struct {
    Resource string
    ID       string
}

func (e *NotFoundError) Error() string {
    return fmt.Sprintf("%s not found (ID: %s)", e.Resource, e.ID)
}

// Usage
func GetUser(id string) (*User, error) {
    user, err := repo.FindByID(id)
    if err != nil {
        return nil, fmt.Errorf("failed to get user: %w", err)
    }
    if user == nil {
        return nil, &NotFoundError{Resource: "User", ID: id}
    }
    return user, nil
}
```

### 2. Structs and Interfaces

```go
// Good: Struct definition
type User struct {
    ID        string    `json:"id"`
    Email     string    `json:"email"`
    Name      string    `json:"name"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}

// Good: Constructor function
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

// Good: Small interfaces (Go philosophy)
type Reader interface {
    Read(p []byte) (n int, err error)
}

type Writer interface {
    Write(p []byte) (n int, err error)
}

// Good: Interface composition
type ReadWriter interface {
    Reader
    Writer
}

// Good: Repository interface
type UserRepository interface {
    FindByID(ctx context.Context, id string) (*User, error)
    FindByEmail(ctx context.Context, email string) (*User, error)
    Create(ctx context.Context, user *User) error
    Update(ctx context.Context, user *User) error
    Delete(ctx context.Context, id string) error
}
```

### 3. Context Usage

```go
// Good: Context propagation
func (s *UserService) GetUser(ctx context.Context, id string) (*User, error) {
    // Pass context to downstream functions
    user, err := s.repo.FindByID(ctx, id)
    if err != nil {
        return nil, err
    }
    return user, nil
}

// Good: Context timeout
func (h *Handler) HandleRequest(w http.ResponseWriter, r *http.Request) {
    ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
    defer cancel()

    result, err := h.service.Process(ctx)
    if err != nil {
        if errors.Is(err, context.DeadlineExceeded) {
            http.Error(w, "Request timeout", http.StatusRequestTimeout)
            return
        }
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    json.NewEncoder(w).Encode(result)
}
```

### 4. HTTP Handlers (net/http, Gin, Echo)

```go
// Good: net/http handler
func (h *UserHandler) GetUser(w http.ResponseWriter, r *http.Request) {
    id := chi.URLParam(r, "id")

    user, err := h.service.GetUser(r.Context(), id)
    if err != nil {
        var notFound *NotFoundError
        if errors.As(err, &notFound) {
            http.Error(w, err.Error(), http.StatusNotFound)
            return
        }
        http.Error(w, "Server error", http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(user)
}

// Good: Gin handler
func (h *UserHandler) GetUser(c *gin.Context) {
    id := c.Param("id")

    user, err := h.service.GetUser(c.Request.Context(), id)
    if err != nil {
        var notFound *NotFoundError
        if errors.As(err, &notFound) {
            c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
            return
        }
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
        return
    }

    c.JSON(http.StatusOK, user)
}

// Good: Echo handler
func (h *UserHandler) GetUser(c echo.Context) error {
    id := c.Param("id")

    user, err := h.service.GetUser(c.Request().Context(), id)
    if err != nil {
        var notFound *NotFoundError
        if errors.As(err, &notFound) {
            return c.JSON(http.StatusNotFound, map[string]string{"error": err.Error()})
        }
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Server error"})
    }

    return c.JSON(http.StatusOK, user)
}
```

### 5. Dependency Injection

```go
// Good: Inject dependencies into struct
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

// Good: Options pattern
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
        port:    8080,           // Default
        timeout: 30 * time.Second,
    }
    for _, opt := range opts {
        opt(s)
    }
    return s
}

// Usage
server := NewServer(
    WithPort(3000),
    WithTimeout(60*time.Second),
)
```

### 6. Concurrency

```go
// Good: Goroutine + Channel
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

    // Collect results
    go func() {
        wg.Wait()
        close(results)
        close(errs)
    }()

    var finalResults []Result
    for result := range results {
        finalResults = append(finalResults, result)
    }

    // Return first error
    select {
    case err := <-errs:
        return nil, err
    default:
        return finalResults, nil
    }
}

// Good: Using errgroup (recommended)
import "golang.org/x/sync/errgroup"

func ProcessItems(ctx context.Context, items []Item) ([]Result, error) {
    g, ctx := errgroup.WithContext(ctx)
    results := make([]Result, len(items))

    for i, item := range items {
        i, item := i, item // Closure capture
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

### 7. Testing

```go
// Good: Table-driven tests
func TestAdd(t *testing.T) {
    tests := []struct {
        name     string
        a, b     int
        expected int
    }{
        {"positive addition", 2, 3, 5},
        {"negative addition", -1, -2, -3},
        {"addition with zero", 0, 5, 5},
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

// Good: Using mock (testify)
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

    expectedUser := &User{ID: "123", Name: "Test"}
    mockRepo.On("FindByID", mock.Anything, "123").Return(expectedUser, nil)

    user, err := service.GetUser(context.Background(), "123")

    assert.NoError(t, err)
    assert.Equal(t, expectedUser, user)
    mockRepo.AssertExpectations(t)
}
```

## File Structure

```text
project/
├── cmd/
│   └── server/
│       └── main.go       # Entry point
├── internal/
│   ├── domain/           # Domain models
│   ├── handler/          # HTTP handlers
│   ├── service/          # Business logic
│   ├── repository/       # Data access
│   └── middleware/       # Middleware
├── pkg/                  # Public packages
├── config/               # Configuration
├── migrations/           # DB migrations
├── go.mod
└── go.sum
```

## Checklist

- [ ] Always handle errors (no _, err)
- [ ] Wrap errors with fmt.Errorf("%w", err)
- [ ] Pass Context as first argument
- [ ] Define small interfaces
- [ ] Use constructor functions (NewXxx)
- [ ] Table-driven tests
- [ ] Pass gofmt, golint, go vet
- [ ] Watch for race conditions in concurrency
