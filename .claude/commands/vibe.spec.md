---
description: Create SPEC document with Specification Agent
argument-hint: "feature name"
---

# /vibe.spec

SPEC 문서를 작성합니다 (Specification Agent).

## Usage

```
/vibe.spec "기능명"
```

## Description

사용자와 질의응답을 통해 요구사항을 수집하고 EARS 형식의 SPEC 문서를 작성합니다.

## Process

1. **프로젝트 타입 확인**:
   - **신규 프로젝트**: `vibe init <프로젝트명>`으로 생성된 경우
     - 소스코드 없음, 기술 스택 선택 필요
   - **기존 프로젝트**: `vibe init`으로 현재 디렉토리에 추가된 경우
     - 소스코드 분석 필요: `package.json`, `pyproject.toml`, `pubspec.yaml`, `go.mod` 등 확인
     - `CLAUDE.md` 파일 있으면 참조 (기술 스택 명시되어 있음)
     - 파일 구조 분석: `src/`, `lib/`, `app/` 등으로 프레임워크 추정

2. **언어 설정 확인**: `.vibe/config.json`의 `language` 확인 (ko/en, 없으면 ko 기본)

3. **자유로운 대화로 요구사항 수집**:
   - 사용자의 요청을 이해하고 **능동적으로** 필요한 질문 진행
   - **질문은 한 번에 하나씩** - 여러 질문을 동시에 던지지 말 것
   - **선택지는 번호로 제시** - 사용자가 번호로 빠르게 선택 가능
   - **선택지 끝에 안내 문구 추가**: "또는 직접 설명해주셔도 됩니다"
   - 고정된 질문 순서 없이, 기능에 맞는 **자연스러운 대화**로 진행
   - 사용자 답변을 받은 후 다음 질문 진행

   **필수 포함 사항 (반드시 질문해야 함):**
   - **기술 스택 확인 및 제안**
     - **기존 프로젝트인 경우 (`vibe init`):**
       1. 소스코드 분석:
          - `package.json` → Node.js 프로젝트 (React, Vue, Express 등 확인)
          - `pyproject.toml` / `requirements.txt` → Python (FastAPI, Django 등)
          - `pubspec.yaml` → Flutter/Dart
          - `go.mod` → Go
          - `pom.xml` / `build.gradle` → Java/Kotlin
       2. CLAUDE.md 파일 확인 (있으면 우선 참조)
       3. 파일 구조로 프레임워크 추정:
          - `src/components/` → React
          - `lib/screens/` → Flutter
          - `app/models/` → Rails, Django
       4. 확인한 스택 제시: "현재 [Backend: FastAPI, Frontend: Flutter]를 사용 중이시네요"
       5. 기능에 필요한 추가 기술 있으면 제안
     - **신규 프로젝트인 경우 (`vibe init <프로젝트명>`):**
       - 기능에 적합한 기술 스택을 구체적으로 제안 (2-3가지 옵션)
       - 각 기술의 장단점과 선택 근거 설명
   - **디자인 레퍼런스 요청 및 제안**
     - 참고할 UI/UX 디자인이 있는지 확인
     - 유사한 앱/서비스의 디자인 레퍼런스 2-3개 제시
     - 디자인 스타일, 컬러, 레이아웃 방향 제안

   **일반적으로 확인할 사항:**
   - 목적 (Why): 왜 필요한가?
   - 사용자 (Who): 누가 사용하는가?
   - 기능 범위 (What): 어떤 기능들이 필요한가?
   - 제약사항 (Constraints): 기술적/비즈니스적 제약이 있는가?
   - 성공 기준 (Acceptance): 어떻게 되면 성공인가?

3. **SPEC 문서 작성**: `.vibe/specs/{기능명}.md` 생성 (EARS 형식)

4. **품질 검증**: TRUST 5 기준 자체 평가

## Agent

`~/.vibe/agents/specification-agent.md`

## Output

- `.vibe/specs/{기능명}.md` - SPEC 문서 (EARS 형식)
- 품질 점수 (0-100점)
- 개선 제안 사항

## Example 1: 벽돌게임

```
User: /vibe.spec "벽돌게임"

Claude:
벽돌게임을 만드시는군요! 어떤 스타일의 게임을 생각하고 계신가요?

1. 클래식 벽돌깨기 (Breakout 스타일)
2. 아르카노이드 (파워업 아이템 포함)
3. 특별한 게임플레이가 있는 커스텀 스타일

또는 직접 설명해주셔도 됩니다.

User: 1

Claude:
싱글플레이인가요, 멀티플레이인가요?

1. 싱글플레이
2. 멀티플레이
3. 둘 다

또는 직접 설명해주셔도 됩니다.

User: 1

Claude:
어떤 플랫폼에서 실행하시겠어요?

1. 웹 (브라우저)
2. 모바일 (iOS/Android)
3. 데스크톱 (Windows/Mac)

또는 직접 설명해주셔도 됩니다.

User: 1

Claude:
웹 게임 개발에 적합한 기술 스택을 제안드립니다:

1. **Phaser.js** (추천)
   - 장점: 게임 프레임워크, 물리엔진 내장, 쉬운 시작
   - 단점: 번들 크기가 큼
2. **Canvas + JavaScript**
   - 장점: 가볍고, 세밀한 제어 가능
   - 단점: 물리엔진 직접 구현 필요
3. **PixiJS + Matter.js**
   - 장점: 고성능 렌더링, 물리엔진 분리
   - 단점: 학습 곡선 있음

어떤 걸로 하시겠어요?

User: Phaser.js로 할게요

Claude:
좋은 선택입니다! 디자인 스타일은 어떤 걸 선호하시나요?

레퍼런스 제안:
1. **Atari Breakout** (1976) - 레트로 픽셀 스타일, 단순한 컬러
2. **Arkanoid** (1986) - 네온 그래픽, 파워업 아이템
3. **Brick Breaker Hero** (모던) - 3D 효과, 파티클, 생동감

참고하실 디자인이 있으신가요?

User: Arkanoid 스타일로 가고 싶어요

Claude:
완벽합니다! 레벨 클리어 조건은 어떻게 하시겠어요?

User: 모든 벽돌을 깨면 다음 레벨로 넘어가요

Claude:
게임 오버 조건은요?

User: 공을 3번 놓치면 게임 오버요

Claude:
리더보드가 필요한가요?

[대화 계속...]

✅ SPEC 문서 작성 완료!
📄 .vibe/specs/brick-game.md
```

## Example 2: 푸시 알림 설정 (기존 프로젝트)

```
User: /vibe.spec "푸시 알림 설정"

Claude:
[파일 확인]
- package.json 없음
- pyproject.toml 발견
- pubspec.yaml 발견
- lib/screens/ 폴더 존재

기존 프로젝트네요! 소스코드를 분석했습니다:
- Backend: Python (FastAPI로 추정 - pyproject.toml의 fastapi 확인)
- Frontend: Flutter 3.24+ (pubspec.yaml 확인)
- Database: PostgreSQL 17 (pyproject.toml의 sqlalchemy, psycopg2 확인)

CLAUDE.md도 확인했습니다. 현재 기술 스택이 맞나요?

User: 네 맞아요

Claude:
어떤 종류의 알림들을 관리하고 싶으신가요? (예: 댓글, 좋아요, 팔로우 등)

User: 댓글, 좋아요, 팔로우, 공지, 이벤트, 마케팅 이렇게 6가지요

Claude:
각 카테고리를 ON/OFF만 하면 되나요, 아니면 세부 조정(시간대, 빈도 등)도 필요한가요?

User: ON/OFF만 하면 돼요

Claude:
푸시 알림 전송 서비스는 어떤 걸 사용하시겠어요?

옵션:
1. **Firebase Cloud Messaging (FCM)** (추천)
   - 장점: 무료, Flutter와 통합 쉬움
   - 단점: Google 종속
2. **OneSignal**
   - 장점: 멀티 플랫폼, 대시보드 제공
   - 단점: 무료 플랜 제한

User: FCM 이미 쓰고 있어요

Claude:
좋습니다! 디자인 레퍼런스는 어떤 걸 참고하시겠어요?

제안:
1. **iOS Settings > Notifications** - 토글 스위치 + 그룹핑
2. **Slack 알림 설정** - 카테고리별 세부 조정
3. **Twitter 알림 설정** - 심플한 리스트 + 우선순위

User: iOS Settings 스타일로 할게요

Claude:
완벽합니다! 성능 요구사항이 있나요? (예: 설정 저장 응답 시간 등)

[대화 계속...]
```

## Example 3: 신규 프로젝트 (벽돌게임)

```
User: /vibe.spec "벽돌게임"

Claude:
[파일 확인: .vibe/config.json 없음, CLAUDE.md 없음, package.json 없음]
신규 프로젝트로 시작하시는군요!

벽돌게임을 만드시는군요! 클래식 벽돌깨기(Breakout) 스타일인가요, 아니면 특별한 게임플레이를 생각하고 계신가요?

User: 클래식 스타일이요

Claude:
어떤 플랫폼에서 실행되나요? 웹, 모바일, 데스크톱 중에서요.

User: 웹이요

Claude:
웹 게임 개발에 적합한 기술 스택을 제안드립니다:

1. **Phaser.js** (추천)
   - 장점: 게임 프레임워크, 물리엔진 내장, 쉬운 시작
   - 단점: 번들 크기가 큼
2. **Canvas + JavaScript**
   - 장점: 가볍고, 세밀한 제어 가능
   - 단점: 물리엔진 직접 구현 필요
3. **PixiJS + Matter.js**
   - 장점: 고성능 렌더링, 물리엔진 분리
   - 단점: 학습 곡선 있음

어떤 걸로 하시겠어요?

User: Phaser.js로 할게요

[대화 계속...]
```

## Next Step

```
/vibe.plan "푸시 알림 설정 기능"
```
