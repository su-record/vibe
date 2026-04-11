# Component Index Template

Phase 0에서 프로젝트 기존 컴포넌트를 인덱싱할 때 이 구조를 따른다.

---

## 인덱스 구조

```json
{
  "sources": [
    {
      "type": "local",
      "path": "components/",
      "name": "project-components",
      "excludedFolders": ["__tests__", "stories"]
    },
    {
      "type": "local",
      "path": "composables/",
      "name": "project-composables"
    }
  ],
  "components": [
    {
      "name": "BaseButton",
      "path": "components/common/BaseButton.vue",
      "props": ["label: string", "variant: 'primary' | 'secondary'", "disabled: boolean"],
      "slots": ["default"],
      "classes": ["base-button", "base-button--primary", "base-button--secondary"],
      "description": "공통 버튼 컴포넌트"
    },
    {
      "name": "GNB",
      "path": "components/layout/GNB.vue",
      "props": ["menuItems: MenuItem[]"],
      "slots": [],
      "classes": ["gnb", "gnb__logo", "gnb__menu"],
      "description": "글로벌 네비게이션 바"
    }
  ],
  "composables": [
    {
      "name": "useAuth",
      "path": "composables/useAuth.ts",
      "params": [],
      "returns": "{ user: User, login: (email: string, pw: string) => Promise<void> }",
      "description": "인증 상태 관리"
    }
  ],
  "types": [
    {
      "name": "User",
      "path": "types/User.ts",
      "fields": ["id: string", "email: string", "name: string"]
    }
  ],
  "designTokens": {
    "source": "styles/_variables.scss",
    "colors": [
      { "name": "$color-primary", "value": "#3b82f6" },
      { "name": "$color-navy", "value": "#0a1628" }
    ],
    "spacing": [
      { "name": "$space-sm", "value": "8px" },
      { "name": "$space-md", "value": "16px" }
    ],
    "typography": [
      { "name": "$font-pretendard", "value": "'Pretendard', sans-serif" }
    ]
  }
}
```

---

## 인덱싱 규칙

### 소스 스캔 (Phase 0)

```
Glob 패턴:
  components/**/*.vue, components/**/*.tsx  → 컴포넌트
  composables/**/*.ts, hooks/**/*.ts       → Composables/Hooks
  types/**/*.ts, types.ts                  → 타입 정의
  styles/_variables.scss, tailwind.config.* → 디자인 토큰
```

### 컴포넌트 추출 (Read 기반)

각 파일에서:
- **Props**: `defineProps<{...}>` 또는 `interface Props` 패턴
- **Slots**: `<slot>` 또는 `{children}` 패턴
- **Classes**: 최상위 template 요소의 `class="..."` 또는 `className={...}`
- **Description**: JSDoc `@description` 또는 파일 첫 번째 주석

### 제한

- 파일 50개 초과 시 우선순위 디렉토리만: components/ui/ → components/common/ → components/shared/
- 파일당 Read 최대 300줄
- 전체 인덱싱 2분 이내

### Figma 노드 ↔ 컴포넌트 매핑 (Phase 3)

```
tree.json 노드의 name/type으로 component-index 매칭:

  name "Btn_*" + component-index에 BaseButton 존재
    → <BaseButton :label="..." variant="primary" /> 로 재사용

  name "GNB" + component-index에 GNB 존재
    → <GNB :menu-items="..." /> 로 재사용

  매칭 안 됨 → 새 컴포넌트 생성
  50% 미만 props 호환 → 매칭 거부, 새로 생성
```

---

## 저장 위치

```
/tmp/{feature}/{bp-folder}/component-index.json
```

Phase 3에서 Read로 로드하여 컴포넌트 재사용 판단에 사용.
