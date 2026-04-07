# Image Extraction Rules — Node Rendering Based

## Core Principle

```
❌ imageRef 개별 다운로드 금지 (텍스처 fill 공유 문제)
✅ 모든 이미지는 Figma screenshot API로 노드 렌더링
```

## Render Methods

| 이미지 유형 | 렌더링 방법 | 출력 위치 |
|-----------|-----------|---------|
| BG 프레임 (합성 배경) | `screenshot {fileKey} {bg.nodeId}` | `bg/{section}-bg.png` |
| 콘텐츠 (타이틀, 버튼) | `screenshot {fileKey} {node.nodeId}` | `content/{name}.png` |
| 벡터 글자 그룹 | `screenshot {fileKey} {group.nodeId}` | `content/{name}.png` |

## BG 프레임 판별

```
BG 프레임 = 다음 중 하나:
  - name에 "BG", "bg" 포함
  - 부모와 크기 동일(±10%) + 자식 이미지 3개 이상
  - 1depth 첫 번째 자식이면서 이미지 노드 다수 보유

→ 프레임 렌더링 1장 → CSS background-image
→ 하위 개별 레이어 다운로드하지 않음
```

## 벡터 글자 판별

```
벡터 글자 그룹 = 다음 모두 충족:
  - 부모 GROUP/FRAME 아래 VECTOR 타입 3개 이상
  - 각 VECTOR 크기 < 60x60
  - 같은 imageRef 공유 (텍스처 fill)

→ 부모 GROUP 통째로 렌더링 (개별 글자 다운로드 금지)
→ 커스텀 폰트 텍스트 = 웹폰트 없음 → 이미지로 사용
```

## Format

- Output format: `.png` (Figma screenshot API 기본)
- 최적화 필요 시 빌드 단계에서 webp 변환 (추출 단계에서는 png)

## Naming

렌더링된 이미지의 파일명 = Figma 노드 name을 kebab-case로:
  - `"Hero"` BG frame → `hero-bg.png`
  - `"Mission 01"` vector group → `mission-01.png`
  - `"Title"` content → `hero-title.png` (섹션명 prefix)
  - `"Btn_Login"` → `btn-login.png`

Rules:
  - 공백 → 하이픈
  - 언더스코어 → 하이픈
  - 숫자 유지: `item11` → `item-11`
  - 대문자 → 소문자

## Destination

```
/tmp/{feature}/{bp-folder}/
  bg/                    ← BG 프레임 렌더링
  content/               ← 콘텐츠 + 벡터 글자 렌더링
  sections/              ← Phase 4 검증용 스크린샷
```

최종 배치 (Phase 5):
```
static/images/{feature}/  ← Nuxt 2
public/images/{feature}/  ← Vue/Nuxt 3
public/{feature}/         ← Next.js
```

## Size Limits

| Type | Warn threshold | Action |
|------|---------------|--------|
| BG 렌더링 | 5 MB | 정상 (합성 이미지라 큰 게 정상) |
| 콘텐츠 렌더링 | 1 MB | 경고 |
| 단일 이미지 > 5 MB | — | ⚠️ 텍스처 fill 의심 → imageRef 다운로드 실수 확인 |

## Fallback

노드 렌더링 불가 시에만 imageRef 다운로드:
  - Figma screenshot API 실패 (rate limit, 권한)
  - 다운로드 후 파일 크기 5MB 초과 → 텍스처 fill 가능성 → 경고 로그
