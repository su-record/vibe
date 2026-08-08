---
name: vibe.image
description: 아이콘·배너·목업 같은 래스터 이미지 산출물이 필요할 때 Antigravity 이미지 backend로 생성한다.
argument-hint: '"description" [--pro] [--icon "AppName"] [--size WxH]'
user-invocable: true
---

# /vibe.image

## Done Criteria

- [ ] 요청된 이미지 파일이 지정 경로에 존재한다.
- [ ] 파일 형식과 픽셀 크기가 요청값과 일치한다.
- [ ] 투명 배경 요청 시 alpha channel이 존재한다.
- [ ] 생성 결과 경로가 최종 응답에 포함된다.

Generate images using the Antigravity image backend.

- **Default**: Antigravity fast image - 빠르고 가벼운 이미지 생성
- **--pro**: Antigravity pro image - 고품질 이미지 생성

## Usage

```
/vibe.image "description"          # Generate image with Antigravity (icon, banner, etc.)
/vibe.image --pro "description"    # High-quality generation
/vibe.image --icon "AppName"       # Generate app icon/favicon
```

## MANDATORY Tool Invocation

**CRITICAL: You MUST use the following command to generate images. Do NOT search for scripts, do NOT use gcloud, do NOT use any other method.**

**Step 0: Script path:**
- `[LLM_SCRIPT]` = `{{VIBE_PATH}}/hooks/scripts/llm-orchestrate.js`

**Step 0-b: 비용 게이트 (생성 전 의무)** — 이미지 생성은 되돌릴 수 없는 지출이다. SSOT: `vibe/rules/loop-contract.md` 비용 게이트 절.

```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => { const op={kind:'paid-generation',provider:'antigravity',label:'이미지 {N}장 생성'}; console.log(t.formatCostGate(op, t.evaluateCostGate(op))); })"
```

`ask` 면 생성 전에 무엇을 몇 장 만들지 제시하고 확인받는다. `autonomous` 면 묻지 않고 인박스에 기록한 뒤 진행한다. `.vibe/config.json` 의 `costGate.paidGenerationRequiresApproval: false` 로 끌 수 있다.

**General image generation (Antigravity fast image):**
```bash
node "[LLM_SCRIPT]" antigravity image "IMAGE_DESCRIPTION" --output "OUTPUT_PATH"
```

**Pro quality (Antigravity pro image):**
```bash
node "[LLM_SCRIPT]" antigravity image "IMAGE_DESCRIPTION" --pro --output "OUTPUT_PATH"
```

**With size option:**
```bash
node "[LLM_SCRIPT]" antigravity image "IMAGE_DESCRIPTION" --size "1920x1080" --output "OUTPUT_PATH"
```

## How to Parse User Request

1. Extract the **image description** from the user's message (what to generate)
2. Extract the **output path** from the user's message (where to save)
   - If user specifies a path, use that path
   - Default: `--output "./generated-image.png"`
3. Extract **size** if specified, otherwise default 1024x1024
4. If user requests **high quality / pro / 고품질**, add `--pro` flag

> Read `references/image-generation-examples.md` for full worked examples, the JSON output format, and the --icon prompt template + example commands.

## Prerequisites

- Antigravity API key configured (`vibe antigravity key <key>`)

---

ARGUMENTS: $ARGUMENTS
