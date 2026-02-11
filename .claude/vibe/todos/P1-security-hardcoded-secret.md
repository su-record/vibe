# P1 - Hardcoded OAuth Client Secret

## Category: Security (OWASP A07:2021)

## File
- `src/lib/gemini-constants.ts:8`

## Description
The Google OAuth `ANTIGRAVITY_CLIENT_SECRET` is hardcoded in plain text. While the comment says "extracted from Antigravity plugin (public)", this is still a security concern for a published npm package.

## Fix Options
1. Switch to PKCE-only flow without client secret (Google supports this for installed apps)
2. Document clearly why exposure is safe with a security comment
3. Use a backend proxy for token exchange

## Requires
Architecture decision on OAuth flow strategy
