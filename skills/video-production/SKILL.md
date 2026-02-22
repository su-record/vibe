---
name: video-production
description: "Video processing and production patterns — FFmpeg, transcoding, streaming, subtitles."
triggers: [video, ffmpeg, transcode, encode, stream, media, subtitle, thumbnail, hls, dash]
priority: 60
---

# Video Production Skill

FFmpeg 기반 비디오 처리, 트랜스코딩, 스트리밍 구성, 자막 처리 패턴 가이드.

## Core Concepts

### FFmpeg CLI Wrapper Pattern

FFmpeg 호출은 반드시 래퍼를 통해 수행한다. 직접 CLI 문자열을 조합하지 않는다.

**TypeScript (fluent-ffmpeg):**
```typescript
import ffmpeg from 'fluent-ffmpeg';

function transcodeVideo(
  input: string,
  output: string,
  options: TranscodeOptions,
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .outputOptions(buildOutputOptions(options))
      .output(output)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}
```

**Python (ffmpeg-python):**
```python
import ffmpeg

def transcode_video(
    input_path: str,
    output_path: str,
    codec: str = "libx264",
    crf: int = 23,
) -> None:
    (
        ffmpeg
        .input(input_path)
        .output(output_path, vcodec=codec, crf=crf)
        .overwrite_output()
        .run(capture_stdout=True, capture_stderr=True)
    )
```

### Error Handling

비디오 처리는 실패할 수 있다. 반드시 에러를 처리한다.

| 에러 유형 | 원인 | 대응 |
|-----------|------|------|
| Codec not found | FFmpeg 빌드에 코덱 미포함 | 런타임 시 코덱 가용성 확인 |
| Out of memory | 큰 파일 + 고해상도 | 스트리밍 처리, chunk 분할 |
| Corrupted input | 깨진 소스 파일 | `ffprobe`로 사전 검증 |
| Permission denied | 파일 잠금 | 임시 디렉토리 사용, 정리 보장 |
| Timeout | 장시간 인코딩 | progress 콜백 + 타임아웃 설정 |

```typescript
// 입력 파일 사전 검증
async function probeVideo(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(new Error(`Invalid video: ${err.message}`));
      const video = data.streams.find(s => s.codec_type === 'video');
      if (!video) return reject(new Error('No video stream found'));
      resolve({
        width: video.width ?? 0,
        height: video.height ?? 0,
        duration: Number(data.format.duration ?? 0),
        codec: video.codec_name ?? 'unknown',
        bitrate: Number(data.format.bit_rate ?? 0),
      });
    });
  });
}
```

## Common Operations

### Thumbnail Generation

```typescript
function extractThumbnail(
  input: string,
  output: string,
  timeSeconds: number = 1,
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .screenshots({
        timestamps: [timeSeconds],
        filename: path.basename(output),
        folder: path.dirname(output),
        size: '320x240',
      })
      .on('end', resolve)
      .on('error', reject);
  });
}
```

### Resolution Presets

| Preset | Resolution | Bitrate (H.264) | Use Case |
|--------|-----------|-----------------|----------|
| 360p | 640x360 | 800 kbps | Mobile preview |
| 480p | 854x480 | 1.5 Mbps | Standard mobile |
| 720p | 1280x720 | 3 Mbps | HD streaming |
| 1080p | 1920x1080 | 6 Mbps | Full HD |
| 4K | 3840x2160 | 15 Mbps | Ultra HD |

### Codec Selection

| Codec | Format | Pros | Cons |
|-------|--------|------|------|
| H.264 (libx264) | MP4 | Universal compatibility | Larger file size |
| H.265 (libx265) | MP4 | 50% smaller than H.264 | Slower encoding, licensing |
| VP9 (libvpx-vp9) | WebM | Open source, good quality | Slow encoding |
| AV1 (libaom-av1) | MP4/WebM | Best compression | Very slow encoding |

### HLS Streaming

```typescript
function generateHLS(
  input: string,
  outputDir: string,
  variants: HLSVariant[] = DEFAULT_VARIANTS,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(input);
    for (const v of variants) {
      cmd
        .output(path.join(outputDir, `${v.name}.m3u8`))
        .outputOptions([
          `-vf scale=${v.width}:${v.height}`,
          `-b:v ${v.bitrate}`,
          '-hls_time 6',
          '-hls_list_size 0',
          '-hls_segment_filename',
          path.join(outputDir, `${v.name}_%03d.ts`),
        ]);
    }
    cmd.on('end', resolve).on('error', reject).run();
  });
}
```

### Subtitle Processing

```typescript
// SRT → VTT 변환
function srtToVtt(srtContent: string): string {
  const vtt = srtContent
    .replace(/\r\n/g, '\n')
    .replace(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/g, '$1:$2:$3.$4');
  return `WEBVTT\n\n${vtt}`;
}

// 자막 burn-in (하드코딩)
function burnSubtitles(
  input: string,
  subtitleFile: string,
  output: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .outputOptions([`-vf subtitles=${subtitleFile}`])
      .output(output)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}
```

### Watermark

```typescript
function addWatermark(
  input: string,
  watermark: string,
  output: string,
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'bottom-right',
): Promise<void> {
  const overlayMap: Record<string, string> = {
    'top-left': '10:10',
    'top-right': 'W-w-10:10',
    'bottom-left': '10:H-h-10',
    'bottom-right': 'W-w-10:H-h-10',
  };
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .input(watermark)
      .complexFilter([`overlay=${overlayMap[position]}`])
      .output(output)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}
```

## Best Practices

1. **항상 ffprobe로 입력 검증** — 처리 전에 코덱, 해상도, 무결성 확인
2. **임시 파일 정리 보장** — try/finally 또는 cleanup handler 사용
3. **Progress 콜백 구현** — 장시간 작업에 진행률 피드백
4. **스트리밍 처리 선호** — 대용량 파일은 메모리에 올리지 않음
5. **코덱 가용성 런타임 확인** — `ffmpeg -codecs`로 빌드 지원 확인
6. **CRF 기반 품질 제어** — 비트레이트 고정보다 CRF (18-28) 사용
7. **하드웨어 가속 활용** — NVIDIA NVENC, Intel QSV, Apple VideoToolbox 가용 시 사용
