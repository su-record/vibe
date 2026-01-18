# Rust Quality Rules

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

## Rust Specific Rules

### 1. Error Handling (Result, Option)

```rust
// Bad: Overusing unwrap()
let content = fs::read_to_string("config.json").unwrap();

// Good: ? operator with proper error handling
fn read_config(path: &str) -> Result<Config, ConfigError> {
    let content = fs::read_to_string(path)
        .map_err(|e| ConfigError::IoError(e))?;

    let config: Config = serde_json::from_str(&content)
        .map_err(|e| ConfigError::ParseError(e))?;

    Ok(config)
}

// Good: Custom error type (thiserror)
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Cannot read config file: {0}")]
    ConfigError(#[from] std::io::Error),

    #[error("Invalid request: {0}")]
    BadRequest(String),

    #[error("Resource not found: {resource} (ID: {id})")]
    NotFound { resource: String, id: String },

    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),
}

// Good: Easy error handling with anyhow (application level)
use anyhow::{Context, Result};

fn process_file(path: &str) -> Result<String> {
    let content = fs::read_to_string(path)
        .context(format!("Cannot read file: {}", path))?;

    Ok(content)
}
```

### 2. Structs and Traits

```rust
// Good: Struct definition
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

// Good: Trait definition
#[async_trait]
pub trait UserRepository: Send + Sync {
    async fn find_by_id(&self, id: Uuid) -> Result<Option<User>, AppError>;
    async fn find_by_email(&self, email: &str) -> Result<Option<User>, AppError>;
    async fn create(&self, user: &User) -> Result<User, AppError>;
    async fn update(&self, user: &User) -> Result<User, AppError>;
    async fn delete(&self, id: Uuid) -> Result<(), AppError>;
}

// Good: Trait implementation
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

    // ... other method implementations
}
```

### 3. Actix-web / Axum Handlers

```rust
// Good: Axum handler
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
            resource: "User".to_string(),
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

// Good: Actix-web handler
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
            resource: "User".to_string(),
            id: id.to_string(),
        })?;

    Ok(HttpResponse::Ok().json(user))
}
```

### 4. Ownership and Lifetimes

```rust
// Bad: Unnecessary clone
fn process(data: &Vec<String>) -> Vec<String> {
    let cloned = data.clone();  // Unnecessary
    cloned.iter().map(|s| s.to_uppercase()).collect()
}

// Good: Use references
fn process(data: &[String]) -> Vec<String> {
    data.iter().map(|s| s.to_uppercase()).collect()
}

// Good: Explicit lifetimes
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

// Good: Ownership transfer vs borrowing
fn take_ownership(s: String) { /* Takes ownership of s */ }
fn borrow(s: &str) { /* Borrows s */ }
fn borrow_mut(s: &mut String) { /* Mutably borrows s */ }
```

### 5. Async Processing (Tokio)

```rust
// Good: Async function
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

// Good: Concurrent execution
use futures::future::join_all;

pub async fn fetch_users(ids: Vec<Uuid>) -> Vec<Result<User, AppError>> {
    let futures: Vec<_> = ids
        .into_iter()
        .map(|id| fetch_user(id))
        .collect();

    join_all(futures).await
}

// Good: Task creation with tokio::spawn
pub async fn background_job() {
    tokio::spawn(async {
        loop {
            process_queue().await;
            sleep(Duration::from_secs(60)).await;
        }
    });
}
```

### 6. Testing

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use mockall::predicate::*;
    use mockall::mock;

    // Good: Mock creation
    mock! {
        pub UserRepo {}

        #[async_trait]
        impl UserRepository for UserRepo {
            async fn find_by_id(&self, id: Uuid) -> Result<Option<User>, AppError>;
            async fn create(&self, user: &User) -> Result<User, AppError>;
        }
    }

    // Good: Unit test
    #[tokio::test]
    async fn test_get_user_success() {
        let mut mock_repo = MockUserRepo::new();
        let user_id = Uuid::new_v4();
        let expected_user = User::new("test@example.com".into(), "Test".into());

        mock_repo
            .expect_find_by_id()
            .with(eq(user_id))
            .returning(move |_| Ok(Some(expected_user.clone())));

        let service = UserService::new(Arc::new(mock_repo));
        let result = service.get_user(user_id).await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap().email, "test@example.com");
    }

    // Good: Error case test
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

### 7. Dependency Injection

```rust
// Good: Constructor injection
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

// Good: Builder pattern
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

// Usage
let server = ServerBuilder::new()
    .port(3000)
    .host("0.0.0.0")
    .timeout(Duration::from_secs(60))
    .build();
```

## File Structure

```text
project/
├── src/
│   ├── main.rs              # Entry point
│   ├── lib.rs               # Library root
│   ├── config.rs            # Configuration
│   ├── error.rs             # Error definitions
│   ├── domain/              # Domain models
│   │   ├── mod.rs
│   │   └── user.rs
│   ├── handlers/            # HTTP handlers
│   │   ├── mod.rs
│   │   └── user.rs
│   ├── services/            # Business logic
│   │   ├── mod.rs
│   │   └── user.rs
│   ├── repositories/        # Data access
│   │   ├── mod.rs
│   │   └── user.rs
│   └── middleware/          # Middleware
├── tests/                   # Integration tests
├── migrations/              # DB migrations
├── Cargo.toml
└── Cargo.lock
```

## Checklist

- [ ] Minimize unwrap()/expect(), use ? operator
- [ ] Handle errors with thiserror/anyhow
- [ ] Abstract with traits, use dependency injection
- [ ] Minimize Clone, use references
- [ ] Use async/await appropriately
- [ ] Resolve clippy warnings
- [ ] Apply cargo fmt
- [ ] Write tests in #[cfg(test)] module
