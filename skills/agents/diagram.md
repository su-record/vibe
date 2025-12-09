---
name: diagram
description: 아키텍처, ERD, 플로우차트를 Mermaid 다이어그램으로 생성합니다.
---

# Diagram Generator

아키텍처, ERD, 플로우차트를 Mermaid 다이어그램으로 생성합니다.

## 사용법

```
# ERD 생성
/vibe.diagram --er

# 플로우차트 생성
/vibe.diagram --flow

# 아키텍처 다이어그램
/vibe.diagram --arch
```

## 다이어그램 유형

### 1. ERD (Entity Relationship Diagram)

```mermaid
erDiagram
    USER ||--o{ POST : creates
    USER {
        int id PK
        string email
        string name
    }
    POST {
        int id PK
        int user_id FK
        string title
    }
```

### 2. 플로우차트

```mermaid
flowchart TD
    A[시작] --> B{로그인?}
    B -->|Yes| C[대시보드]
    B -->|No| D[로그인 페이지]
    D --> B
```

### 3. 아키텍처 다이어그램

```mermaid
graph TB
    Client[Client] --> API[API Gateway]
    API --> Auth[Auth Service]
    API --> User[User Service]
    User --> DB[(PostgreSQL)]
```

### 4. 시퀀스 다이어그램

```mermaid
sequenceDiagram
    Client->>API: POST /login
    API->>Auth: Validate credentials
    Auth-->>API: JWT Token
    API-->>Client: 200 OK
```

## 입력

- `.vibe/specs/{기능명}.md` (SPEC 문서)
- `.vibe/plans/{기능명}.md` (PLAN 문서)
- 프로젝트 코드 구조

## 출력

- Mermaid 마크다운 코드
- GitHub/GitLab에서 바로 렌더링 가능
