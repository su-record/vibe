# Optional Devlog Auto-Push

Load only when `devlog.autoPush` is `true`. External push still requires confirmation.

```bash
cd {targetRepo}
git add {targetDir}/{prefix}-{NNNN}.md
git commit -m "post: Add {prefix} #{NNNN}"
git push
```
