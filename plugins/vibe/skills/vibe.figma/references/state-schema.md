# Figma Create State — Full Reference

> Loaded by vibe.figma SKILL.md Branch 3 Step B for the full state JSON schema, wireHash/designHash rationale, and reuse/reject algorithm.

```
   스키마:
     {
       "feature": "<feature>",
       "fileKey": "<figma fileKey>",
       "createdAt": "<ISO-8601>",
       "updatedAt": "<ISO-8601>",
       "planHash": "<sha256 of plan.md content>",
       "sections": [
         {
           "name": "<섹션 이름 (plan.md 8번 표 기준)>",
           "bp": "mo" | "pc",
           "wireNodeId": "<figma nodeId of wireframe frame>",   // Step D 결과
           "designNodeId": "<figma nodeId of styled frame>",    // Step E 결과 (없으면 null)
           "wireHash": "<sha256 of plan.md 8번 row — 레이아웃 키>",
           "designHash": "<sha256 of plan.md 7번+8번+9번 row — 비주얼 키>",
           "createdAt": "<ISO-8601>",
           "updatedAt": "<ISO-8601>"
         }
       ]
     }

   ⚠ wireHash와 designHash를 분리하는 이유:
     - plan.md 8번(레이아웃)만 변경 → wire 재생성 + design 재생성
     - plan.md 7번(Look & Feel)만 변경 → wire SKIP + design만 재생성
     - 둘 다 변경 안 됨 → 둘 다 cached

   알고리즘:
     - hasNewState == true → 기존 state 무시, 빈 state로 시작 (이전 nodeId 참조 안 함)
     - 파일 없음 → 빈 state 생성 (sections: []), Step D부터 모두 신규 생성
     - 존재 + state.fileKey != 입력 fileKey → ❌ 거부:
         "이 plan.md는 다른 Figma 파일({state.fileKey})에 매핑돼 있습니다.
          다른 파일에 새로 그리려면 --new-state 플래그를 추가하거나
          /tmp/{feature}/figma-create-state.json 을 삭제하세요."
     - 존재 + state.fileKey == 입력 fileKey → reuse 모드:
         · planHash 비교: 다르면 "plan.md가 수정됐습니다. 변경된 섹션만 update 진행" 안내
         · sections 매칭은 Step D(wireHash) / Step E(designHash)에서 각각 결정
```
