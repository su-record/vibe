---
status: pending
phase: 4
---

# SPEC: pc-control — Phase 4: Vision Live (실시간 화면)

## Persona
<role>
Gemini Live 실시간 비전 전문가. 화면 공유, 영역 캡처, 윈도우 캡처를 구분하여 개발 중 실시간으로 AI가 화면을 읽고 응답하는 시스템을 구현한다.
</role>

## Context
<context>

### Background
- VIBE: `vision_capture` + `vision_analyze` 구현됨 (단발 캡처)
- VIBE: GeminiLive WebSocket 연결 구현됨
- **Gap**: 실시간 스트리밍 없음 (단발 캡처만)
- **Gap**: Full/Region/Window 모드 구분 없음
- **Goal**: "화면 보면서 대화하듯" 디버깅, 코드 리뷰, UI 검토

### Tech Stack
- Gemini Multimodal Live API (WebSocket, 양방향 비디오+오디오)
- Screen Capture API (getDisplayMedia)
- Canvas API (영역 크롭)
- Sharp (이미지 리사이즈/압축)

### Vision Modes
| Mode | 대상 | 해상도 | FPS |
|------|------|--------|-----|
| **Full Screen** | 전체 화면 | 1280x720 (다운스케일) | 1-5 |
| **Region** | 지정 영역 (x,y,w,h) | 원본 | 1-5 |
| **Window** | 특정 윈도우 | 원본 | 1-5 |

### Research Insights
- **Gemini**: Foveated capture (저해상도 전체 + 고해상도 관심영역)
- **Gemini**: Polling 대신 MutationObserver/CDP 이벤트 기반 트리거
- **Kimi**: 적응형 프레임 샘플링 (1-30fps, 모션 감지 기반)
- **Kimi**: Differential encoding (delta frames)
- **Security**: 캡처 대상 명시적 동의, 소스 변경 시 재동의, DRM 콘텐츠 블랙 프레임
</context>

## Task
<task>

### Phase 4-1: Screen Capture Engine
1. [ ] `src/vision/ScreenCapture.ts` — 화면 캡처 엔진 (서버 사이드)
   - `ICaptureSource` 인터페이스: `capture()` → `Buffer` (클라이언트/서버 분리)
   - `LocalCaptureSource`: OS 네이티브 모듈 (Windows: screenshot-desktop, macOS: screencapture CLI)
   - `CDPCaptureSource`: CDP `Page.captureScreenshot` (브라우저 윈도우 전용, 샌드박스 호환)
   - `RemoteCaptureSource`: 클라이언트 에이전트 (PWA getDisplayMedia) → WebSocket relay
   - `captureFullScreen()`: 전체 화면 (다운스케일 1280x720)
   - `captureRegion(x, y, width, height)`: 지정 영역
   - `captureWindow(windowId)`: windowId 기반 식별 (title은 display metadata)
   - Sharp로 리사이즈 + WebP/AVIF 압축 (Worker Thread 사용)
   - PII 영역 redaction 옵션 (시스템 알림, 비밀번호 관리자)
   - Verify: 각 모드 캡처 테스트 (로컬 + CDP + mock remote)

2. [ ] `src/vision/AdaptiveFrameSampler.ts` — 적응형 프레임 샘플링
   - 화면 변경 감지: 이전 프레임과 diff (pixel hash 비교)
   - 변경 없으면 프레임 스킵 (대역폭 절감)
   - 변경 있으면 즉시 전송
   - 설정: 최소 FPS (1), 최대 FPS (5), diff 임계값
   - Verify: diff 감지 + 프레임 스킵 테스트

### Phase 4-2: Gemini Live Streaming
3. [ ] `src/vision/GeminiLiveStream.ts` — Gemini Live WebSocket 스트리밍
   - 기존 GeminiLive WebSocket 확장
   - 비디오 프레임 + 오디오 인터리빙 전송
   - 응답 수신: 텍스트 + 오디오 (양방향)
   - 연결 관리: 자동 재연결 + heartbeat
   - Verify: 스트리밍 연결 테스트

4. [ ] `src/vision/VisionSession.ts` — Vision 세션 관리
   - 세션 상태: idle → capturing → streaming → paused → ended
   - 모드 전환: Full → Region → Window (실시간 변경)
   - 히스토리: 최근 N개 프레임 메타데이터 유지
   - 타임아웃: 10분 비활성 → 자동 종료
   - Verify: 세션 상태 전이 테스트

### Phase 4-3: MCP Tool 등록
5. [ ] `src/tools/vision/index.ts` — MCP 도구 확장
   - `core_vision_start`: Vision 세션 시작 (mode: full/region/window)
   - `core_vision_stop`: Vision 세션 종료
   - `core_vision_mode`: 모드 전환
   - `core_vision_snapshot`: 현재 프레임 단발 캡처
   - `core_vision_ask`: 현재 화면에 대해 질문
   - Verify: MCP 등록 확인

### Phase 4-4: CLI
6. [ ] `src/cli/commands/vision.ts` — CLI 확장
   - `vibe vision start [--mode full|region|window]`
   - `vibe vision stop`
   - `vibe vision snapshot [--region x,y,w,h]`
   - Verify: CLI 실행 테스트

### Phase 4-5: 테스트
7. [ ] `src/vision/ScreenCapture.test.ts`
8. [ ] `src/vision/AdaptiveFrameSampler.test.ts`
9. [ ] `src/vision/VisionSession.test.ts`
</task>

## Constraints
<constraints>
- 캡처 시작 시 명시적 사용자 동의 필수
- 캡처 소스 변경 시 재동의
- DRM 콘텐츠 → 블랙 프레임 (에러 아닌 대체)
- 프레임 서버 전송 전 PII redaction 옵션
- 전체 화면: 1280x720으로 다운스케일 (대역폭 절감)
- Region: 최소 100x100px, 최대 화면 크기
- Gemini API 비용 고려: 적응형 프레임 샘플링 필수
- [P1] Vision 세션 비용 캡: 기본 max_duration 5분 (설정 가능), 토큰 예산 초과 시 자동 중지 + 사용자 알림
- [P1] 멀티 모니터: 물리 픽셀 좌표계 표준화, 모니터 경계 클램프, 음수 좌표(보조 모니터) 지원
- [P1] DPI 스케일링: devicePixelRatio 반영, 동일 window title 중복 시 windowId 기반 식별
- [P1] 프레임 diff CPU 예산: 다운샘플링 해시 + worker thread, CPU 20% 이하 유지
- [P1] RemoteCaptureSource 클라이언트: PWA `getDisplayMedia` → WebSocket relay, Phase 1에선 LocalCaptureSource/CDPCaptureSource만 구현, RemoteCaptureSource는 인터페이스만 정의 (클라이언트 PWA는 Phase 6 Web 통합 시 구현)
- 함수 ≤30줄, 중첩 ≤3레벨
</constraints>

## Output Format
<output_format>

### Files to Create
- `src/vision/ScreenCapture.ts`
- `src/vision/AdaptiveFrameSampler.ts`
- `src/vision/GeminiLiveStream.ts`
- `src/vision/VisionSession.ts`
- `src/vision/types.ts`
- `src/tools/vision/index.ts`
- `src/cli/commands/vision.ts`
- `src/vision/ScreenCapture.test.ts`
- `src/vision/AdaptiveFrameSampler.test.ts`
- `src/vision/VisionSession.test.ts`

### Files to Modify
- `src/interface/` — Vision 인터페이스 확장
- `src/tools/index.ts` — vision 도구 export

### Verification Commands
- `pnpm test -- --grep vision`
- `pnpm build`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] Full Screen: 전체 화면 캡처 → 1280x720 다운스케일 → Gemini 전송
- [ ] Region: (x,y,w,h) 영역만 캡처 → 원본 해상도 → Gemini 전송
- [ ] Window: 윈도우 제목 기반 캡처 → Gemini 전송
- [ ] 적응형 샘플링: 화면 변경 없으면 프레임 스킵
- [ ] Gemini Live: WebSocket 양방향 스트리밍 (비디오+오디오)
- [ ] 모드 실시간 전환 (Full ↔ Region ↔ Window)
- [ ] `vibe vision start/stop/snapshot` CLI 동작
- [ ] 단발 캡처 응답 ≤2초 (Full Screen 기준)
- [ ] 프레임당 전송 크기 ≤200KB (WebP/AVIF 압축)
- [ ] 캡처 실패 시 JSON 에러 반환 (권한 거부, 윈도우 미존재 등)
- [ ] Gemini WebSocket 재연결: 3회 (2s → 4s → 8s backoff)
- [ ] 동시 Vision 세션: 로컬 1개, SaaS 사용자당 1개
- [ ] 모든 테스트 통과 + 빌드 성공
</acceptance>
