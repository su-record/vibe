# language: ko
기능: clone-quality-overhaul — vibe.clone 품질 개보수

  배경:
    조건 vibe clone 파이프라인이 설치되어 있다
    그리고 Puppeteer와 Chromium이 사용 가능하다

  시나리오: R1 — 모델이 근거 기반으로 SCSS 값을 수정할 수 있다
    조건 clone-to-scss.js가 초안 SCSS를 생성했다
    그리고 computed.json에 특정 노드의 max-width 근거가 존재한다
    만일 모델이 해당 근거를 인용해 SCSS 값을 반응형 단위로 재구성한다
    그러면 clone-validate.js가 PASS를 반환한다
    그리고 SKILL.md 어디에도 "Do NOT modify SCSS CSS values" 문구가 없다

  시나리오: R2 — MO/PC가 mobile-first 반응형으로 병합된다
    조건 MO와 PC 각각 clone-validate PASS를 받은 SCSS가 존재한다
    만일 clone-merge-responsive.js를 실행한다
    그러면 MO 선언이 기본 규칙으로 출력된다
    그리고 PC와 다른 선언만 "@media (min-width: 1024px)" 블록에 출력된다
    그리고 두 BP에서 동일한 선언은 한 번만 출력된다

  시나리오: R2 — 병합 후 두 뷰포트 모두 픽셀 검증한다
    조건 반응형 병합이 완료됐다
    만일 Phase 5를 실행한다
    그러면 375×812 렌더가 mo/screenshot.png와 비교된다
    그리고 1440×900 렌더가 pc/screenshot.png와 비교된다
    그리고 한쪽이라도 P1이면 클론은 미완료로 판정된다

  시나리오: R3 — 호버 diff가 behaviors.json에 캡처된다
    조건 대상 페이지에 JS로 호버 스타일을 세팅하는 버튼이 있다
    만일 clone-extract.js capture를 실행한다
    그러면 behaviors.json의 hover 배열에 해당 요소의 변경 속성 diff가 기록된다

  시나리오: R3 — in-view 등장 애니메이션이 캡처된다
    조건 대상 페이지에 opacity 0에서 스크롤 인 시 나타나는 섹션이 있다
    만일 clone-extract.js capture를 실행한다
    그러면 behaviors.json의 inview 배열에 변경 diff와 트리거 위치가 기록된다

  시나리오: R3 — --no-interact 시 확장 스윕도 전부 꺼진다
    만일 clone-extract.js capture를 --no-interact로 실행한다
    그러면 behaviors.json에 hover/inview/timeDriven 데이터가 수집되지 않는다

  시나리오: R4 — 150줄 초과 spec은 분할 후 디스패치된다
    조건 특정 섹션의 spec 파일이 150줄을 초과한다
    만일 빌더 디스패치 단계에 도달한다
    그러면 해당 섹션은 하위 컴포넌트 spec으로 분할된다
    그리고 각 빌더 프롬프트에 spec 전문이 인라인으로 포함된다

  시나리오: R5 — --real-content는 확인 후 verbatim 텍스트를 쓴다
    만일 /vibe.clone <url> --real-content 를 실행한다
    그러면 본인 소유/허가 여부 확인 질문이 1회 제시된다
    그리고 승인 시 spec의 텍스트 섹션이 verbatim 사용으로 표기된다

  시나리오: R5 — 플래그 없으면 기존 placeholder 동작 유지
    만일 /vibe.clone <url> 을 플래그 없이 실행한다
    그러면 저작권 텍스트는 placeholder 치환 대상으로 표기된다

  시나리오: R6 — 파비콘과 OG 이미지가 로컬로 수집된다
    조건 대상 페이지에 favicon과 og:image 메타가 있다
    만일 clone-extract.js capture를 실행한다
    그러면 assets/seo/ 에 파일이 다운로드되고 asset-map.json에 기록된다

  시나리오: 회귀 — 기존 계약 불변
    만일 전체 변경을 적용하고 npx vitest run을 실행한다
    그러면 기존 테스트가 무수정으로 통과한다
    그리고 clone-validate.js의 exit code 계약(0/1/2)이 유지된다
