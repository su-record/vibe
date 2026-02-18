---
description: Voice-to-coding command via Gemini audio transcription
argument-hint: "--pro for high accuracy, --lang ko for Korean"
---

# /vibe.voice

마이크로 음성을 녹음하고 Gemini를 통해 텍스트로 변환하여 코딩 명령으로 사용합니다.

## Prerequisites

- **Gemini 인증 필수** (`vibe gemini auth` 또는 `vibe gemini key <key>`)
- **sox 설치 필수** (`brew install sox` on macOS, `apt install sox` on Linux)

## Usage

```
/vibe.voice                    # 녹음 후 변환 (gemini-3-flash)
/vibe.voice --pro              # 고정밀 모드 (gemini-3-pro)
/vibe.voice --lang ko          # 한국어 힌트
/vibe.voice --duration 30      # 최대 녹음 시간 (기본: 60초)
```

## MANDATORY Execution Steps

**반드시 아래 순서로 실행하세요.**

### Step 1: getCurrentTime 호출

시작 시간을 기록합니다.

### Step 2: 음성 녹음 및 변환

**스크립트 경로:**
- `[LLM_SCRIPT]` = `{{VIBE_PATH}}/hooks/scripts/llm-orchestrate.js`

```bash
node "[LLM_SCRIPT]" gemini voice $ARGUMENTS
```

**대체 경로** (프로젝트 로컬):
```bash
node ./node_modules/@su-record/vibe/dist/hooks/scripts/llm-orchestrate.js gemini voice $ARGUMENTS
```

### Step 3: 결과 처리

JSON 출력을 파싱합니다:

**성공 시:**
```json
{ "success": true, "transcription": "변환된 텍스트", "duration": 5.2, "model": "gemini-3-flash" }
```

**실패 시:**
```json
{ "success": false, "error": "에러 메시지" }
```

### Step 4: 변환된 텍스트를 코딩 명령으로 실행

1. `success: true`이면 `transcription` 값을 사용자에게 보여줍니다
2. 사용자가 확인하면 해당 텍스트를 코딩 명령으로 실행합니다
3. `success: false`이면 에러 메시지를 표시하고 트러블슈팅을 안내합니다

### Step 5: getCurrentTime 호출

종료 시간을 기록합니다.

## Troubleshooting

| Error | Fix |
|-------|-----|
| "sox is not installed" | `brew install sox` (macOS) 또는 `apt install sox` (Linux) |
| "Gemini credentials not found" | `vibe gemini auth` 또는 `vibe gemini key <key>` 실행 |
| "Recording failed: empty audio" | 마이크 권한 확인, 기본 오디오 입력 장치 확인 |
| 변환 결과가 부정확 | `--pro` 옵션으로 gemini-3-pro 사용, 마이크 가까이에서 말하기 |

ARGUMENTS: $ARGUMENTS
