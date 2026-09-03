# Video Quality Checklist

## Pre-Processing

- [ ] Input file exists and is readable before pipeline starts
- [ ] `ffprobe` run on input — codec, resolution, duration, bitrate logged
- [ ] Corrupted/truncated files rejected with clear error (not crash)
- [ ] Input resolution within supported range (min 360p, max 4K)
- [ ] Audio stream present — handle gracefully if missing

## Encoding

- [ ] CRF-based encoding used (not fixed bitrate) for consistent visual quality
- [ ] Target codec available in current FFmpeg build (`ffmpeg -codecs` check)
- [ ] Encoding runs through wrapper library — no raw CLI string concatenation
- [ ] `-movflags +faststart` set for MP4 (enables streaming before full download)
- [ ] Audio normalized: loudness target -16 LUFS (streaming standard)
- [ ] Aspect ratio preserved — no unintended stretching

## Progress & Monitoring

- [ ] Progress events emitted for any operation exceeding 10 seconds
- [ ] Encoding timeout configured — process killed on expiry
- [ ] Estimated time remaining shown in progress (based on bitrate processed)

## Output Validation

- [ ] Output file exists after encoding completes
- [ ] Output duration verified: within ±2 seconds of input
- [ ] Output codec matches requested codec (re-run ffprobe on output)
- [ ] Output file size within acceptable range (flag if >3x input size)
- [ ] Thumbnail: correct dimensions, not blank/corrupted

## Subtitles (if applicable)

- [ ] Subtitle file encoding is UTF-8 (convert if needed)
- [ ] Subtitle timing verified — first/last cue in range of video duration
- [ ] Burn-in subtitles visually tested on dark and light scenes

## HLS / DASH Streaming (if applicable)

- [ ] `.m3u8` manifest references correct segment file names
- [ ] All segment files present in output directory
- [ ] Segment duration consistent (target ±1 second of configured value)
- [ ] CORS headers configured on media server

## Storage & Cleanup

- [ ] Temp directory cleaned in `finally` block — both success and error paths
- [ ] No partial output files left on disk after failure
- [ ] Output written to separate directory from temp files
- [ ] Disk space checked before processing large files (minimum 3x input size free)

## Security

- [ ] Input file path sanitized — no directory traversal (`../`)
- [ ] FFmpeg invoked via array arguments (not shell string) to prevent injection
- [ ] Max file size limit enforced before processing begins
