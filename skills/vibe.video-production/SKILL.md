---
name: vibe.video-production
invocation: [auto]
tier: standard
description: "Video processing gotchas — FFmpeg commands, transcoding pipelines, HLS/DASH streaming setup, subtitle embedding (SRT/VTT), and thumbnail extraction. Use when the project involves any video manipulation, media processing, or streaming infrastructure. Covers codec selection, bitrate optimization, and common FFmpeg pitfalls. Must use this skill when user works with video files, mentions FFmpeg, or needs media processing — even for simple tasks like 'generate a thumbnail'."
triggers: [video, ffmpeg, transcode, subtitle, thumbnail, hls, video encoding, media processing]
priority: 60
---

# Video Production

## Pre-check (K1)

> Are you processing video files programmatically? If just embedding a YouTube/Vimeo player, this skill is not needed.

## Prerequisite — FFmpeg

이 스킬의 모든 명령은 FFmpeg 에 의존한다. **작업 전에 존재를 먼저 확인한다:**

```bash
ffmpeg -version && ffprobe -version
```

없으면 설치를 안내하고 멈춘다 — 뒤로 갈수록 실패가 비싸진다.

| 환경 | 설치 |
|---|---|
| macOS | `brew install ffmpeg` |
| Debian/Ubuntu | `sudo apt install ffmpeg` |
| 그 외 | https://ffmpeg.org/download.html |

> 코덱까지 갖춰졌는지는 별개다 — 아래 Gotchas 의 "Assuming codec availability" 참조.
> 빌드마다 포함 코덱이 다르므로 인코딩 전에 `ffmpeg -codecs` 로 확인한다.

## Gotchas

| Gotcha | Consequence | Prevention |
|--------|-------------|------------|
| Direct CLI string concatenation | Command injection risk | Always use wrapper library (fluent-ffmpeg for TS, ffmpeg-python for Python) |
| No input validation | Crash on corrupted files | Always `ffprobe` input before processing — check codec, resolution, duration |
| No temp file cleanup | Disk fills up silently | `try/finally` or cleanup handler — never leave partial outputs |
| No progress callback | Long encoding appears frozen | Implement progress events for any operation >10s |
| Memory loading large files | OOM on 4K+ video | Use streaming I/O, never read entire file into memory |
| Assuming codec availability | Fails on different FFmpeg builds | Check `ffmpeg -codecs` at runtime before encoding |
| Fixed bitrate encoding | Inconsistent quality | Use CRF-based quality (18-28 for H.264) instead |
| No timeout | Encoding hangs forever | Set timeout + kill process on expiry |

## Codec Quick Reference

| Use Case | Codec | Note |
|----------|-------|------|
| Maximum compatibility | H.264 (libx264) | CRF 23 default |
| Smaller files | H.265 (libx265) | 50% smaller, slower, licensing issues |
| Open source | VP9 (libvpx-vp9) | Good for WebM |
| Best compression | AV1 (libaom-av1) | Very slow encoding |

## Resolution Presets

| Preset | Resolution | Bitrate (H.264) |
|--------|-----------|-----------------|
| 360p | 640x360 | 800 kbps |
| 720p | 1280x720 | 3 Mbps |
| 1080p | 1920x1080 | 6 Mbps |
| 4K | 3840x2160 | 15 Mbps |

## Done Criteria (K4)

- [ ] All FFmpeg calls go through wrapper library (no raw CLI strings)
- [ ] Input files validated with ffprobe before processing
- [ ] Temp files cleaned up in all paths (success + error)
- [ ] Progress reporting for long operations
- [ ] Codec availability checked at runtime
