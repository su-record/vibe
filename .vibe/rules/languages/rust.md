# 🦀 Rust 품질 규칙

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

## Rust 특화 규칙

### 1. 에러 처리 (Result, Option)

```rust
// ❌ unwrap() 남용
let content = fs::read_to_string("config.json").unwrap();

// ✅ ? 연산자와 적절한 에러 처리
fn read_config(path: &str) -> Result<Config, ConfigError> {
    let content = fs::read_to_string(path)
        .map_err(|e| ConfigError::IoError(e))?;

    let config: Config = serde_json::from_str(&content)
        .map_err(|e| ConfigError::ParseError(e))?;

    Ok(config)
}

// ✅ 커스텀 에러 타입 (thiserror)
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("설정 파일을 읽을 수 없습니다: {0}")]
    ConfigError(#[from] std::io::Error),

    #[error("잘못된 요청입니다: {0}")]
    BadRequest(String),

    #[error("리소스를 찾을 수 없습니다: {resource} (ID: {id})")]
    NotFound { resource: String, id: String },

    #[error("데이터베이스 오류: {0}")]
    DatabaseError(#[from] sqlx::Error),
}

// ✅ anyhow로 간편한 에러 처리 (애플리케이션 레벨)
use anyhow::{Context, Result};

fn process_file(path: &str) -> Result<String> {
    let content = fs::read_to_string(path)
        .context(format!("파일을 읽을 수 없습니다: {}", path))?;

    Ok(content)
}
```

### 2. 구조체와 트레이트

```rust
// ✅ 구조체 정의
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl User {
    pub fn new(email: String, name: String) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            email,
            name,
            created_at: now,
            updated_at: now,
        }
    }
}

// ✅ 트레이트 정의
#[async_trait]
pub trait UserRepository: Send + Sync {
    async fn find_by_id(&self, id: Uuid) -> Result<Option<User>, AppError>;
    async fn find_by_email(&self, email: &str) -> Result<Option<User>, AppError>;
    async fn create(&self, user: &User) -> Result<User, AppError>;
    async fn update(&self, user: &User) -> Result<User, AppError>;
    async fn delete(&self, id: Uuid) -> Result<(), AppError>;
}

// ✅ 트레이트 구현
pub struct PostgresUserRepository {
    pool: PgPool,
}

#[async_trait]
impl UserRepository for PostgresUserRepository {
    async fn find_by_id(&self, id: Uuid) -> Result<Option<User>, AppError> {
        let user = sqlx::query_as!(
            User,
            "SELECT * FROM users WHERE id = $1",
            id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(user)
    }

    // ... 다른 메서드 구현
}
```

### 3. Actix-web / Axum 핸들러

```rust
// ✅ Axum 핸들러
use axum::{
    extract::{Path, State, Json},
    http::StatusCode,
    response::IntoResponse,
};

pub async fn get_user(
    State(repo): State<Arc<dyn UserRepository>>,
    Path(id): Path<Uuid>,
) -> Result<Json<User>, AppError> {
    let user = repo
        .find_by_id(id)
        .await?
        .ok_or(AppError::NotFound {
            resource: "사용자".to_string(),
            id: id.to_string(),
        })?;

    Ok(Json(user))
}

pub async fn create_user(
    State(repo): State<Arc<dyn UserRepository>>,
    Json(dto): Json<CreateUserDto>,
) -> Result<(StatusCode, Json<User>), AppError> {
    let user = User::new(dto.email, dto.name);
    let created = repo.create(&user).await?;

    Ok((StatusCode::CREATED, Json(created)))
}

// ✅ Actix-web 핸들러
use actix_web::{web, HttpResponse, Result};

pub async fn get_user(
    repo: web::Data<dyn UserRepository>,
    path: web::Path<Uuid>,
) -> Result<HttpResponse, AppError> {
    let id = path.into_inner();
    let user = repo
        .find_by_id(id)
        .await?
        .ok_or(AppError::NotFound {
            resource: "사용자".to_string(),
            id: id.to_string(),
        })?;

    Ok(HttpResponse::Ok().json(user))
}
```

### 4. 소유권과 생명주기

```rust
// ❌ 불필요한 클론
fn process(data: &Vec<String>) -> Vec<String> {
    let cloned = data.clone();  // 불필요
    cloned.iter().map(|s| s.to_uppercase()).collect()
}

// ✅ 참조 활용
fn process(data: &[String]) -> Vec<String> {
    data.iter().map(|s| s.to_uppercase()).collect()
}

// ✅ 생명주기 명시
pub struct UserService<'a> {
    repo: &'a dyn UserRepository,
    cache: &'a dyn CacheRepository,
}

impl<'a> UserService<'a> {
    pub fn new(
        repo: &'a dyn UserRepository,
        cache: &'a dyn CacheRepository,
    ) -> Self {
        Self { repo, cache }
    }
}

// ✅ 소유권 이전 vs 빌려오기
fn take_ownership(s: String) { /* s의 소유권을 가짐 */ }
fn borrow(s: &str) { /* s를 빌려옴 */ }
fn borrow_mut(s: &mut String) { /* s를 가변 빌려옴 */ }
```

### 5. 비동기 처리 (Tokio)

```rust
// ✅ 비동기 함수
use tokio::time::{sleep, Duration};

pub async fn fetch_with_retry<T, F, Fut>(
    f: F,
    max_retries: u32,
) -> Result<T, AppError>
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = Result<T, AppError>>,
{
    let mut attempts = 0;

    loop {
        match f().await {
            Ok(result) => return Ok(result),
            Err(e) if attempts < max_retries => {
                attempts += 1;
                let delay = Duration::from_millis(100 * 2_u64.pow(attempts));
                sleep(delay).await;
            }
            Err(e) => return Err(e),
        }
    }
}

// ✅ 동시 실행
use futures::future::join_all;

pub async fn fetch_users(ids: Vec<Uuid>) -> Vec<Result<User, AppError>> {
    let futures: Vec<_> = ids
        .into_iter()
        .map(|id| fetch_user(id))
        .collect();

    join_all(futures).await
}

// ✅ tokio::spawn으로 태스크 생성
pub async fn background_job() {
    tokio::spawn(async {
        loop {
            process_queue().await;
            sleep(Duration::from_secs(60)).await;
        }
    });
}
```

### 6. 테스트

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use mockall::predicate::*;
    use mockall::mock;

    // ✅ Mock 생성
    mock! {
        pub UserRepo {}

        #[async_trait]
        impl UserRepository for UserRepo {
            async fn find_by_id(&self, id: Uuid) -> Result<Option<User>, AppError>;
            async fn create(&self, user: &User) -> Result<User, AppError>;
        }
    }

    // ✅ 단위 테스트
    #[tokio::test]
    async fn test_get_user_success() {
        let mut mock_repo = MockUserRepo::new();
        let user_id = Uuid::new_v4();
        let expected_user = User::new("test@example.com".into(), "테스트".into());

        mock_repo
            .expect_find_by_id()
            .with(eq(user_id))
            .returning(move |_| Ok(Some(expected_user.clone())));

        let service = UserService::new(Arc::new(mock_repo));
        let result = service.get_user(user_id).await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap().email, "test@example.com");
    }

    // ✅ 에러 케이스 테스트
    #[tokio::test]
    async fn test_get_user_not_found() {
        let mut mock_repo = MockUserRepo::new();
        let user_id = Uuid::new_v4();

        mock_repo
            .expect_find_by_id()
            .returning(|_| Ok(None));

        let service = UserService::new(Arc::new(mock_repo));
        let result = service.get_user(user_id).await;

        assert!(matches!(result, Err(AppError::NotFound { .. })));
    }
}
```

### 7. 의존성 주입

```rust
// ✅ 생성자 주입
pub struct UserService {
    repo: Arc<dyn UserRepository>,
    cache: Arc<dyn CacheRepository>,
}

impl UserService {
    pub fn new(
        repo: Arc<dyn UserRepository>,
        cache: Arc<dyn CacheRepository>,
    ) -> Self {
        Self { repo, cache }
    }
}

// ✅ Builder 패턴
#[derive(Default)]
pub struct ServerBuilder {
    port: Option<u16>,
    host: Option<String>,
    timeout: Option<Duration>,
}

impl ServerBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn port(mut self, port: u16) -> Self {
        self.port = Some(port);
        self
    }

    pub fn host(mut self, host: impl Into<String>) -> Self {
        self.host = Some(host.into());
        self
    }

    pub fn timeout(mut self, timeout: Duration) -> Self {
        self.timeout = Some(timeout);
        self
    }

    pub fn build(self) -> Server {
        Server {
            port: self.port.unwrap_or(8080),
            host: self.host.unwrap_or_else(|| "127.0.0.1".into()),
            timeout: self.timeout.unwrap_or(Duration::from_secs(30)),
        }
    }
}

// 사용
let server = ServerBuilder::new()
    .port(3000)
    .host("0.0.0.0")
    .timeout(Duration::from_secs(60))
    .build();
```

## 파일 구조

```
project/
├── src/
│   ├── main.rs              # 엔트리포인트
│   ├── lib.rs               # 라이브러리 루트
│   ├── config.rs            # 설정
│   ├── error.rs             # 에러 정의
│   ├── domain/              # 도메인 모델
│   │   ├── mod.rs
│   │   └── user.rs
│   ├── handlers/            # HTTP 핸들러
│   │   ├── mod.rs
│   │   └── user.rs
│   ├── services/            # 비즈니스 로직
│   │   ├── mod.rs
│   │   └── user.rs
│   ├── repositories/        # 데이터 액세스
│   │   ├── mod.rs
│   │   └── user.rs
│   └── middleware/          # 미들웨어
├── tests/                   # 통합 테스트
├── migrations/              # DB 마이그레이션
├── Cargo.toml
└── Cargo.lock
```

## 체크리스트

- [ ] unwrap()/expect() 최소화, ? 연산자 활용
- [ ] thiserror/anyhow로 에러 처리
- [ ] 트레이트로 추상화, 의존성 주입
- [ ] Clone 최소화, 참조 활용
- [ ] async/await 적절히 사용
- [ ] clippy 경고 해결
- [ ] cargo fmt 적용
- [ ] #[cfg(test)] 모듈로 테스트 작성
