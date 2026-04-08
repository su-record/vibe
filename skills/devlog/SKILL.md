---
name: devlog
tier: standard
description: "Auto-generate devlog posts from git commit history. Triggers every N commits, writes markdown to configured target repo."
triggers: [devlog, 개발일지, dev log, devlog 작성, 개발일지 작성]
priority: 60
---
# Devlog Auto-Generator

Git 커밋 히스토리를 분석하여 개발일지를 자동 생성하고, 설정된 블로그 레포에 포스트로 저장합니다.

## Config

`.claude/vibe/config.json`의 `devlog` 섹션:

```json
{
  "devlog": {
    "enabled": true,
    "targetRepo": "/absolute/path/to/blog-repo",
    "targetDir": "posts",
    "prefix": "devlog",
    "interval": 10,
    "autoPush": false,
    "lang": "ko",
    "author": "Su",
    "category": "dev-log",
    "tags": []
  }
}
```

| Key | Required | Default | Description |
|-----|----------|---------|-------------|
| `enabled` | Y | `false` | 활성화 여부 |
| `targetRepo` | Y | — | 블로그 레포 절대 경로 |
| `targetDir` | N | `"posts"` | 포스트 저장 디렉토리 |
| `prefix` | N | `"devlog"` | 파일명 프리픽스 (`{prefix}-{NNNN}.md`) |
| `interval` | N | `10` | 몇 커밋마다 생성할지 |
| `autoPush` | N | `false` | targetRepo에 자동 commit+push |
| `lang` | N | `"ko"` | 작성 언어 |
| `author` | N | git user.name | 작성자 |
| `category` | N | `"dev-log"` | frontmatter category |
| `tags` | N | `[]` | 기본 태그 (프로젝트명 등 자동 추가) |

## Trigger Modes

### 1. Auto (post-commit hook)

`devlog-gen.js` hook이 매 커밋마다 카운터를 확인하고, `interval`에 도달하면 `llm-orchestrate.js`를 통해 개발일지를 생성합니다.

### 2. Manual

사용자가 직접 `/devlog` 또는 `개발일지 작성` 키워드로 트리거. 마지막 개발일지 이후의 커밋을 모아 즉시 생성합니다.

## Generation Process

### Step 1: Collect Commits

마지막 개발일지의 날짜 이후 커밋을 수집합니다:

```bash
# 마지막 devlog 파일에서 날짜 추출
# targetRepo/targetDir/{prefix}-NNNN.md 의 frontmatter date
git log --oneline --after="{last_date}" --reverse
```

### Step 2: Analyze & Group

- 버전 범프 커밋 식별 (X.Y.Z 패턴)
- feat/fix/refactor/docs 분류
- 주요 커밋 선별 (의미 있는 변경)

### Step 3: Generate Markdown

다음 frontmatter 포맷으로 생성:

```markdown
---
title: "{project_name} 개발일지 #{next_number} - {summary_title} ({interval}개 커밋)"
date: "{today}"
category: "{category}"
description: "{one_line_description}"
tags: [{project_tags}, {auto_detected_tags}]
author: "{author}"
lang: "{lang}"
---

# {title}

**작업 기간**: {start_date} ~ {end_date}

## 이번 기간 작업 내용

### {theme} ({interval}개 커밋)

{overview_paragraph}

| 커밋 | 내용 |
|------|------|
| `{meaningful_commit_message}` | **{highlight}** |
...

## 작업 하이라이트

{2-3 highlights with code blocks or diagrams}

## 개발 현황

- **버전**: {start_version} → {end_version}
- **핵심**: {key_changes}

---

**다음 개발일지**: {prefix}-{next+1} (다음 {interval}개 커밋 후)
```

### Step 4: Write File

```
{targetRepo}/{targetDir}/{prefix}-{NNNN}.md
```

번호는 기존 파일에서 마지막 번호 + 1로 자동 결정.

### Step 5: (Optional) Auto Push

`autoPush: true`이면:

```bash
cd {targetRepo}
git add {targetDir}/{prefix}-{NNNN}.md
git commit -m "post: Add {prefix} #{NNNN}"
git push
```

## Rules

- **커밋 메시지 원문 보존** — 커밋 메시지를 그대로 인용, 임의 변경 금지
- **버전 범프 커밋 포함** — 테이블에는 포함하되 하이라이트에서 제외
- **하이라이트는 최대 3개** — 가장 영향력 있는 변경만 선별
- **코드 블록 활용** — Before/After 비교, 아키텍처 다이어그램 권장
- **숫자 강조** — 줄 수 변화(-N줄), 버전 범위, 파일 수 등
