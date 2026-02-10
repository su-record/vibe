# P2 - WebServer Test Coverage Critically Low

## Priority: P2 (Important)
## Category: TEST
## Status: Manual fix required

## Description
The WebServer has 980 lines of security-critical code (JWT verification, WebSocket frame parser, SSE, rate limiting, CORS validation) but only 42 lines of tests.

Other under-tested critical modules:
- `web-browse.ts` (SSRF protection) - no dedicated tests
- `vision-analyze.ts` (path validation) - no dedicated tests
- `MultiChannelRouter.ts` - no tests
- `AgentLoop.ts` (core loop) - no tests

## Recommended Fix
Add unit tests for:
1. JWT verification (valid/invalid/expired tokens)
2. WebSocket frame parsing (valid frames, oversized, reserved opcodes, RSV bits)
3. Rate limiting (within/exceeding limits)
4. CORS origin validation (exact match, wildcard, invalid)
5. SSRF protection (private IPs, redirects, DNS rebinding)
6. Path traversal validation in vision-analyze

## Impact
Security-critical code paths are untested, making regression detection impossible.
