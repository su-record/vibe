# P2 - XSS in OAuth Callback HTML Responses

## Category: Security (OWASP A03:2021)

## Files
- `src/lib/gpt-oauth.ts:300,364,381`
- `src/lib/gemini-oauth.ts:321,364,381`

## Description
OAuth callback server returns HTML responses with unsanitized values from query params and token data. Attacker can redirect browser to `http://localhost:1455/auth/callback?error=<script>alert(1)</script>`.

## Fix
HTML-encode all dynamic values:

```typescript
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
```

## Estimated Scope
2 files, ~6 injection points
