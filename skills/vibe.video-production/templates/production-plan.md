# Video Production Plan Template

## Project Overview

| Field | Value |
|-------|-------|
| Project Name | {{PROJECT_NAME}} |
| Output Format | {{FORMAT}} (e.g., HLS, MP4, WebM) |
| Target Resolution | {{RESOLUTION}} (e.g., 1080p) |
| Target Codec | {{CODEC}} (e.g., H.264 / libx264) |
| Duration (approx.) | {{DURATION}} |
| Deadline | {{DEADLINE}} |

## Input Sources

| Source File | Format | Resolution | Duration | Notes |
|-------------|--------|------------|----------|-------|
| {{INPUT_FILE_1}} | {{FORMAT}} | {{RES}} | {{DUR}} | {{NOTES}} |

Run `ffprobe -v quiet -print_format json -show_streams {{INPUT_FILE}}` to populate this table.

## Processing Pipeline

```
Input Validation (ffprobe)
  ↓
Pre-processing (trim / deinterlace / normalize audio)
  ↓
Transcoding ({{CODEC}}, CRF {{CRF_VALUE}})
  ↓
Post-processing (subtitles / thumbnail extraction / HLS segmentation)
  ↓
Output Validation (verify duration, codec, bitrate)
  ↓
Cleanup (remove temp files)
```

## Encoding Parameters

```bash
# Replace placeholders before running
ffmpeg \
  -i "{{INPUT_FILE}}" \
  -c:v {{VIDEO_CODEC}} \
  -crf {{CRF_VALUE}} \
  -preset {{PRESET}} \
  -c:a aac -b:a 128k \
  -movflags +faststart \
  -progress pipe:1 \
  "{{OUTPUT_FILE}}"
```

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Codec | {{VIDEO_CODEC}} | {{CODEC_RATIONALE}} |
| CRF | {{CRF_VALUE}} | 18-23 = high quality, 24-28 = balanced |
| Preset | {{PRESET}} | `slow` = better compression, `fast` = faster encoding |
| Audio | AAC 128k | Universal compatibility |

## Subtitles

- [ ] Subtitle file: `{{SUBTITLE_FILE}}` (SRT / VTT)
- [ ] Burn-in (hardcoded) or soft subtitle track: {{SUBTITLE_TYPE}}
- [ ] Language code: `{{LANG_CODE}}`

## Thumbnail Extraction

```bash
# Extract frame at {{TIMESTAMP}} seconds
ffmpeg -i "{{INPUT_FILE}}" -ss {{TIMESTAMP}} -frames:v 1 "{{THUMBNAIL_OUTPUT}}"
```

## HLS Output (if streaming)

```bash
ffmpeg -i "{{INPUT_FILE}}" \
  -codec: copy \
  -start_number 0 \
  -hls_time 10 \
  -hls_list_size 0 \
  -f hls \
  "{{HLS_OUTPUT_DIR}}/stream.m3u8"
```

## Quality Gates

- [ ] Input validated with ffprobe before processing starts
- [ ] Progress callback implemented (log every 10 seconds)
- [ ] Timeout set: {{TIMEOUT_SECONDS}}s
- [ ] Output file size within expected range: {{MIN_SIZE}}–{{MAX_SIZE}} MB
- [ ] Output duration matches input: ±2 seconds tolerance
- [ ] Temp files cleaned on success AND error

## Temp File Management

```
temp/
├── {{JOB_ID}}_input_validated.{{EXT}}
├── {{JOB_ID}}_preprocessed.{{EXT}}
└── (cleaned up in finally block)

output/
└── {{JOB_ID}}_final.{{EXT}}
```
