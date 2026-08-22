# Loop Install Adapters

Load only for `vibe.loop install`. Never register a schedule without the user's decision.

| 환경 | 명령 |
|------|------|
| Claude Code (세션 루프) | `/loop <interval> "/vibe.loop run <name>"` |
| Claude Code (클라우드 루틴) | `/schedule`로 cron `<schedule>` + prompt `/vibe.loop run <name>` 등록 |
| OS cron fallback | 아래 참조 — **PATH 를 반드시 명시한다** |

### OS cron 등록

```cron
# PATH 를 적지 않으면 cron 은 /usr/bin:/bin 만 들고 실행한다 — claude 를 찾지 못해
# 루프가 **아무 소리 없이** 한 번도 돌지 않는다. 등록 전에 실제 경로를 확인할 것:
#   which claude   →  예: /usr/local/bin/claude, ~/.local/bin/claude, ~/.nvm/.../bin/claude
PATH=/usr/local/bin:/usr/bin:/bin:<claude 가 있는 디렉토리>

<schedule> cd <project> && claude -p "/vibe.loop run <name>" --permission-mode acceptEdits >> <project>/.vibe/loops/<name>.log 2>&1
```

- **PATH**: `which claude` 결과의 디렉토리를 반드시 포함시킨다. nvm·Homebrew·`~/.local/bin` 중 어디든 cron 기본 PATH 에는 없다
- **로그 리다이렉트**: cron 은 출력을 메일로 보내거나 버린다. 파일로 받아야 루프가 왜 멈췄는지 알 수 있다
- **등록 후 1회 검증**: 다음 실행 시각을 기다리지 말고 같은 명령을 `env -i PATH=... sh -c '...'` 로 한 번 돌려 본다 — cron 과 같은 최소 환경에서 되는지 확인하는 것이 목적이다
| Codex | Automations에 `<schedule>` + `$vibe.loop run <name>` 등록 |
