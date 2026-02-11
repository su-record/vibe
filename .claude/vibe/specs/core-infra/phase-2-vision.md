---
status: pending
currentPhase: 2
totalPhases: 5
createdAt: 2026-02-09T00:14:38Z
lastUpdated: 2026-02-09T00:14:38Z
---

# SPEC: core-infra — Phase 2: Vision (Gemini Live 스크린 캡처 + 분석)

## Persona
<role>
- Senior TypeScript developer, Gemini API 전문가
- 멀티모달 AI(Vision) 시스템 설계 경험
- 스크린 캡처 및 이미지 처리 파이프라인 구축 경험
- 기존 `BaseInterface` 및 agent tool 패턴 숙지
</role>

## Context
<context>
### Background
- VIBE가 "눈"을 가지려면 화면을 캡처하고 Gemini Live로 분석하는 기능 필요
- Visee 데스크톱(Electron) 앱에서 투명 HUD 오버레이로 실시간 화면 분석
- 로컬 모드: 로컬 스크린 캡처 → Gemini API 전송
- 클라우드 모드: 클라이언트(Electron)가 캡처한 이미지를 API Server로 전송 → Gemini API

### Tech Stack
- Gemini API: `@google/generative-ai` (이미 `lib/gemini-api.ts` 존재)
- 스크린 캡처: 플랫폼별 네이티브 커맨드 (macOS: screencapture, Windows: PowerShell, Linux: scrot)
- 이미지 처리: Node.js Buffer (외부 라이브러리 없이 base64 변환)

### Related Code
- `src/lib/gemini-api.ts`: 기존 Gemini API 클라이언트
- `src/agent/tools/`: 기존 tool 등록 패턴
- `src/agent/preprocessors/MediaPreprocessor.ts`: 미디어 전처리 패턴
- `src/interface/types.ts`: `ExternalMessage` 타입 (type: 'file' 패턴)

### Design Reference
- Google Gemini Live API (multimodal streaming)
- macOS screencapture command
- Electron desktopCapturer API
</context>

## Task
<task>
### Phase 2-1: 스크린 캡처 모듈
1. [ ] 크로스 플랫폼 스크린 캡처 함수
   - File: `src/interface/vision/ScreenCapture.ts` (신규)
   - macOS: `screencapture -x -t png -` (stdout으로 PNG)
   - Windows: PowerShell `[System.Windows.Forms.Screen]::PrimaryScreen` 캡처
   - Linux: `scrot -o -` (stdout으로 PNG)
   - 반환: `Buffer` (PNG raw data)
   - 타임아웃: 5초

2. [ ] 캡처 설정 및 크기 최적화
   - File: `src/interface/vision/ScreenCapture.ts`
   - 최대 해상도: 1920x1080 (초과 시 리사이즈 — node:child_process로 처리)
   - 캡처 영역 설정: 전체 화면 / 특정 영역 (x, y, width, height)
   - JPEG 변환 옵션 (품질 80, 용량 절감): 플랫폼 네이티브로 처리
   - 캡처 간격 제한: 최소 1초 (flood 방지)

### Phase 2-2: Gemini Vision 분석
3. [ ] GeminiVision 클래스
   - File: `src/interface/vision/GeminiVision.ts` (신규)
   - 기존 `lib/gemini-api.ts`의 API 키 관리 활용
   - `analyzeImage(image: Buffer, prompt: string): Promise<string>` — 단일 이미지 분석
   - `analyzeStream(imageStream: AsyncIterable<Buffer>, prompt: string): AsyncIterable<string>` — 연속 프레임 분석 (Live)
   - Gemini API rate limit 준수: 최대 10 req/min (기본)
   - 요청당 이미지 크기 제한: 4MB (초과 시 자동 리사이즈)

4. [ ] Gemini Live 세션 관리
   - File: `src/interface/vision/GeminiVision.ts`
   - Live 세션 시작/종료 lifecycle
   - 연결 끊김 시 자동 재연결 (최대 3회, 지수 백오프)
   - AbortController로 세션 취소 지원
   - 세션당 메모리 제한: 이미지 버퍼 풀 ≤ 50MB

### Phase 2-3: Vision Agent Tool
5. [ ] `vision_capture` tool 등록
   - File: `src/agent/tools/vision-capture.ts` (신규)
   - 기존 tool 등록 패턴 (`ToolRegistry.register()`) 준수
   - Parameters: `{ area?: "full" | "region", region?: {x, y, w, h}, prompt: string }`
   - 스크린 캡처 → Gemini 분석 → 결과 텍스트 반환
   - scope: `read`

6. [ ] `vision_analyze` tool 등록
   - File: `src/agent/tools/vision-analyze.ts` (신규)
   - Parameters: `{ imagePath: string, prompt: string }`
   - 파일 경로에서 이미지 로드 → Gemini 분석
   - scope: `read`

### Phase 2-4: Vision Interface
7. [ ] VisionInterface 클래스 (BaseInterface 확장)
   - File: `src/interface/vision/VisionInterface.ts` (신규)
   - `BaseInterface` 확장, channel: `'vision'`
   - 외부에서 이미지를 push하면 Gemini 분석 수행
   - 분석 결과를 `ExternalMessage`로 변환하여 AgentLoop에 전달
   - SSE/WebSocket으로 실시간 분석 결과 스트리밍
   - **클라우드 모드**: `POST /api/vision/analyze` 엔드포인트 (multipart/form-data, max 4MB, Bearer token 인증) — 클라이언트가 캡처한 이미지를 API Server로 전송

8. [ ] Vision 모듈 export
   - File: `src/interface/vision/index.ts` (신규)
   - `ScreenCapture`, `GeminiVision`, `VisionInterface` export
   - `src/interface/index.ts` 업데이트
   - `src/interface/types.ts`에 `VisionConfig` 타입 추가
</task>

## Constraints
<constraints>
- 스크린 캡처는 플랫폼 네이티브 커맨드 사용 (외부 npm 패키지 미사용)
- Gemini API 호출은 기존 `lib/gemini-api.ts` 인증 체계 활용
- 이미지 리사이즈는 외부 라이브러리(sharp) 없이 플랫폼 네이티브 도구 사용
- Vision Live 세션의 프레임 버퍼: 최대 50MB/세션
- 캡처 간격 최소 1초 (API rate limit + CPU 보호)
- Gemini API 요청 최대 크기: 4MB/이미지
- 분석 응답 타임아웃: 30초
- 재시도: 최대 3회, 지수 백오프 (1s, 2s, 4s)
- ChannelType에 `'vision'` 추가
- Gemini prompt injection 방지: 시스템 프롬프트에 이미지 내 텍스트 무시 지시
- Gemini API 실패 시: 에러 메시지 반환 (재시도 3회 후 최종 실패)
- Gemini API 401/403 에러: API 키 확인 안내 메시지 반환
- 캡처 실패 시: 플랫폼별 캡처 명령어 확인 안내 반환
- **vision_analyze 경로 보안**: imagePath를 resolve 후 허용 디렉토리(process.cwd(), os.tmpdir()) 내로 제한, symlink 거부, 파일 확장자 검증 (png, jpg, jpeg, gif, webp, bmp)
- **스크린 캡처 리사이즈 명령어**: macOS `sips --resampleWidth 1920`, Windows `PowerShell [System.Drawing]`, Linux `convert` (ImageMagick) — 미설치 시 원본 전송 + 경고 로그
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/interface/vision/ScreenCapture.ts`
- `src/interface/vision/GeminiVision.ts`
- `src/interface/vision/VisionInterface.ts`
- `src/interface/vision/index.ts`
- `src/agent/tools/vision-capture.ts`
- `src/agent/tools/vision-analyze.ts`

### Files to Modify
- `src/interface/types.ts` — ChannelType에 `'vision'` 추가, `VisionConfig` 타입
- `src/interface/index.ts` — vision export 추가
- `src/agent/tools/index.ts` — vision tools 등록

### Verification Commands
- `npx tsc --noEmit`
- `npx vitest run src/interface/vision/`
- `npx vitest run src/agent/`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] `ScreenCapture.capture()` — macOS/Windows/Linux에서 PNG Buffer 반환
- [ ] 캡처 영역 지정 동작 (full/region)
- [ ] 최대 해상도(1920x1080) 초과 시 자동 리사이즈
- [ ] `GeminiVision.analyzeImage()` — 이미지 → Gemini 분석 텍스트 반환
- [ ] `GeminiVision.analyzeStream()` — 연속 프레임 실시간 분석
- [ ] Live 세션 시작/종료 정상 동작
- [ ] 연결 끊김 시 자동 재연결 (최대 3회)
- [ ] `vision_capture` tool — AgentLoop에서 호출 가능
- [ ] `vision_analyze` tool — 파일 경로 이미지 분석 동작
- [ ] VisionInterface — 외부 이미지 push → 분석 결과 전달
- [ ] API rate limit 준수 (10 req/min 초과 시 큐잉)
- [ ] 이미지 4MB 초과 시 자동 리사이즈
- [ ] TypeScript 컴파일 통과
- [ ] 기존 테스트 통과
</acceptance>
