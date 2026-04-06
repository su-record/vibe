# Feature: figma-extract-tool

**SPEC**: `.claude/vibe/specs/figma-extract-tool.md`

## User Story
**As a** vibe-figma 스킬 사용자
**I want** Figma 디자인에서 노드 트리, CSS, 이미지를 직접 추출
**So that** MCP 타임아웃/인스턴스 분할 불가 없이 정확한 CSS 값으로 코드 생성

## Scenarios

### Scenario 1: 작은 인스턴스 노드 트리 조회
```gherkin
Scenario: KID 인스턴스(487px)의 전체 노드 트리 조회
  Given Figma 토큰이 ~/.vibe/config.json에 설정됨
  And fileKey "jitSR2yFctITa9N1rVYIZD", nodeId "641:78152"
  When "node figma-extract.js tree <fileKey> <nodeId>" 실행
  Then JSON 출력에 자식 노드 5개 이상 포함
  And 각 노드에 css 속성 (font-size, color 등) 포함
  And 에러 없이 5초 이내 완료
```
**Verification**: SPEC AC #1

### Scenario 2: 큰 인스턴스 노드 트리 조회 (MCP 불가 케이스)
```gherkin
Scenario: Daily 인스턴스(3604px)의 자식 노드 분할 조회
  Given fileKey "jitSR2yFctITa9N1rVYIZD", nodeId "641:78153"
  When "node figma-extract.js tree <fileKey> <nodeId>" 실행
  Then JSON 출력에 Daily 내부 자식 노드 포함
  And Step1/Step2 등 하위 섹션 구조가 보임
  And MCP get_metadata에서 안 보이던 레이어가 노출됨
```
**Verification**: SPEC AC #2

### Scenario 3: CSS 속성 추출 정확도
```gherkin
Scenario: 노드의 Figma 속성이 CSS로 정확히 변환됨
  Given KID 인스턴스의 tree 출력
  When "KRAFTON ID 로그인" 텍스트 노드를 확인
  Then css.fontSize = "36px"
  And css.fontFamily에 "Pretendard" 포함
  And css.color = "#ffffff" 또는 "rgba(255,255,255,1)"
  And css.fontWeight = "700"
```
**Verification**: SPEC AC #3

### Scenario 4: 이미지 에셋 다운로드
```gherkin
Scenario: Hero 섹션의 모든 이미지 다운로드
  Given Hero 인스턴스의 tree 출력에서 imageRef가 있는 노드 수집
  When "node figma-extract.js images <fileKey> <nodeIds> --out=./images" 실행
  Then --out 디렉토리에 이미지 파일 저장
  And 모든 파일이 0byte가 아님
  And imageMap JSON 출력
```
**Verification**: SPEC AC #4

### Scenario 5: 토큰 미설정 에러
```gherkin
Scenario: Figma 토큰 없이 실행 시 에러 메시지
  Given ~/.vibe/config.json에 figma 토큰 없음
  And FIGMA_ACCESS_TOKEN 환경변수 없음
  When "node figma-extract.js tree <fileKey> <nodeId>" 실행
  Then stderr에 JSON 에러 출력: {"error": "Figma token not found..."}
  And 종료 코드 1
```

### Scenario 6: Rate limit 재시도
```gherkin
Scenario: Figma API rate limit 시 자동 재시도
  Given Figma API가 429 응답을 반환
  When tree 명령 실행
  Then exponential backoff로 최대 3회 재시도
  And 성공 시 정상 JSON 출력
```
**Verification**: SPEC AC #6

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 (KID 자식 노드) | ⬜ |
| 2 | AC-2 (Daily 분할) | ⬜ |
| 3 | AC-3 (CSS 정확도) | ⬜ |
| 4 | AC-4 (이미지 다운로드) | ⬜ |
| 5 | 에러 처리 | ⬜ |
| 6 | AC-6 (rate limit) | ⬜ |
