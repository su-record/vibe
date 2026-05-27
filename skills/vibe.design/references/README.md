# vibe.design — Reference Seeds

`awesome-design-md` 생태계에서 추출한 **로컬 시드 카탈로그**. 네트워크 없이도
`/vibe.design init --from=reference --reference=<slug>` 으로 §1·§2·§3 기본값을 시드한다.

각 시드의 `style-preset` 컬럼은 한 문장으로 시각 무드를 요약하며, init 시 §1 Visual
Theme + §2 Color Palette 의 primary/accent + §3 Typography family 의 기본값으로 변환된다.
나머지 §4–§9 는 단축 인터뷰(≤3 질문) 로 채운다.

## Catalog

| Slug | Style Preset | 주된 무드 |
|------|--------------|----------|
| `linear` | minimal, neutral grays + electric purple accent (#5E6AD2), Inter Display | 도구·정확·조용 |
| `vercel` | mono-light, pure black/white + zinc neutrals, Geist Sans | 미니멀·기술 |
| `stripe` | clean white + indigo accent (#635BFF), Sohne / Inter | 신뢰·전문 |
| `notion` | warm off-white (#FBFBFA) + charcoal text, system serif + sans | 따뜻·문서 |
| `github` | crisp white/dark + GitHub blue (#0969DA), system-ui | 개발자·정보밀도 |
| `apple` | premium white + space gray, SF Pro / system | 프리미엄·여백 |
| `figma` | dark canvas + multi-color accents, Inter | 창의·툴링 |
| `tailwind` | white + sky/cyan accent (#06B6D4), Inter | 유틸·교육 |
| `posthog` | playful peach + dark navy, Matter SQ | 친근·실험 |
| `supabase` | dark + emerald accent (#3ECF8E), Custom Sans | 모던·DB |
| `arc` | iridescent gradients + soft pastels, Inter Display | 미래·브라우저 |
| `clerk` | white + purple/violet accent, Inter | 인증·SaaS |

## Adding a new seed

1. 카탈로그 표에 한 줄 추가 (slug · style-preset · 무드)
2. `style-preset` 은 한 문장: `<intensity>, <palette>, <font family>`
3. 라이선스: 시드는 시각 규약 텍스트만 보유 (브랜드 로고/이미지 미포함)

## How `init --from=reference` uses these

1. `--reference=<slug>` 매칭 → `style-preset` 추출
2. `style-preset` 의 palette 토큰 → `DESIGN.md §2 Color Palette` 의 primary/accent 시드
3. font family → `§3 Typography` 의 Family 시드
4. intensity 문구 → `§1 Visual Theme` 의 한 문단 초안
5. `§4–§9` 는 단축 인터뷰 (컴포넌트 radius, spacing scale, breakpoints) 로 보강
