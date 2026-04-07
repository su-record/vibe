# Component Output Template — Tree-Based Generation

tree.json 노드를 기반으로 컴포넌트를 생성할 때 이 템플릿을 따른다.

---

## Vue / Nuxt (External SCSS)

```vue
<!--
  tree.json 구조:
  {{SECTION_NAME}} ({{TYPE}} {{WIDTH}}x{{HEIGHT}})
  ├── BG (FRAME — 배경 레이어)
  │   └── imageRef → {{BG_IMAGE}}
  ├── {{CHILD_1}} (FRAME — flex-column, gap:{{GAP}}px)
  │   ├── TEXT "{{TEXT_1}}"
  │   └── TEXT "{{TEXT_2}}"
  └── {{CHILD_2}} (FRAME — flex-row, gap:{{GAP_2}}px)
      └── INSTANCE × {{REPEAT_COUNT}} (반복 패턴)
-->
<template>
  <section class="{{sectionName}}">
    <!-- BG: 부모와 동일 크기 + imageRef → 배경 레이어 -->
    <div class="{{sectionName}}__bg">
      <img src="/images/{{FEATURE_KEY}}/{{bg-file}}.png" alt="" aria-hidden="true" />
    </div>

    <!-- {{CHILD_1}}: tree flex-column, gap:{{GAP}}px → 직접 매핑 -->
    <div class="{{sectionName}}__{{child1Name}}">
      <!-- TEXT 노드 → Claude가 시맨틱 태그 판단 -->
      <h2 class="{{sectionName}}__title">{{TEXT_1}}</h2>
      <p class="{{sectionName}}__desc">{{TEXT_2}}</p>
    </div>

    <!-- {{CHILD_2}}: INSTANCE 반복 → v-for -->
    <ul class="{{sectionName}}__list">
      <li
        v-for="item in items"
        :key="item.id"
        class="{{sectionName}}__item"
      >
        <img :src="item.image" :alt="item.name" class="{{sectionName}}__itemImg" />
        <span class="{{sectionName}}__itemLabel">{{ item.name }}</span>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
/**
 * {{SECTION_DISPLAY_NAME}}
 * tree.json: {{SECTION_NAME}} ({{TYPE}} {{WIDTH}}x{{HEIGHT}})
 *
 * [기능 정의]
 * - {{FEATURE_REQUIREMENT_1}}
 *
 * [인터랙션]
 * ① {{INTERACTION_1}}
 *
 * [상태] {{STATE_LIST}}
 */

interface {{ItemType}} {
  id: string
  name: string
  image: string
}

defineProps<{
  items: {{ItemType}}[]
}>()
</script>
<!-- styles: styles/{{FEATURE_KEY}}/layout/_{{section}}.scss + components/_{{section}}.scss -->
```

---

## SCSS Layout (tree.json → vw 반응형)

```scss
// tree.json 데이터:
// {{SECTION_NAME}}: { width:{{WIDTH}}, height:{{HEIGHT}}, overflow:hidden }
// {{CHILD_1}}: { display:flex, flexDirection:column, gap:{{GAP}}px, padding:"{{PADDING}}" }
// designWidth = {{DESIGN_WIDTH}}px → vw = (px / designWidth) × 100

.{{sectionName}} {
  position: relative;
  width: 100%;
  height: {{HEIGHT_VW}}vw;               // tree: {{HEIGHT}} / {{DESIGN_WIDTH}} × 100
  overflow: hidden;                       // tree: overflow:hidden
  background-image: url('/images/{{FEATURE_KEY}}/{{section}}-bg.png');
  background-size: cover;
  background-position: center top;
}

.{{sectionName}}__{{child1Name}} {
  display: flex;                          // tree: display:flex
  flex-direction: column;                 // tree: flexDirection:column
  gap: {{GAP_VW}}vw;                      // tree: {{GAP}} / {{DESIGN_WIDTH}} × 100
  padding: {{PADDING_VW}};               // tree: "{{PADDING}}" / {{DESIGN_WIDTH}} × 100
}
```

---

## SCSS Components (tree.json → clamp 폰트)

```scss
// tree.json 데이터:
// TEXT "{{TEXT_1}}": { fontSize:{{FONT_SIZE}}px, fontWeight:{{FONT_WEIGHT}}, color:{{COLOR}} }
// designWidth = {{DESIGN_WIDTH}}px

.{{sectionName}}__title {
  // 역할: 제목 → 최소 16px
  font-size: clamp(16px, {{FONT_SIZE_VW}}vw, {{FONT_SIZE}}px); // tree: {{FONT_SIZE}} / {{DESIGN_WIDTH}} × 100
  font-weight: {{FONT_WEIGHT}};           // tree: 직접 (변환 안 함)
  color: {{COLOR}};                       // tree: 직접 (변환 안 함)
}
```

---

## React / Next.js 변환

| Vue | React |
|-----|-------|
| `class="..."` | `className={styles.xxx}` (CSS Module) |
| `v-for="i in items" :key="i.id"` | `{items.map(i => <X key={i.id} />)}` |
| `v-if="condition"` | `{condition && <X />}` |
| `@click="handler"` | `onClick={handler}` |
| `<img src="/images/..."` | `<Image src="/images/..."` |

---

## 검증 체크리스트

- [ ] tree.json에 없는 CSS 값이 SCSS에 없음
- [ ] template 클래스 ↔ SCSS 클래스 1:1 일치
- [ ] 모든 img src가 static/에 실제 존재
- [ ] TEXT 노드의 characters가 template에 그대로 삽입됨
- [ ] Auto Layout 노드 → SCSS에 flex 속성 존재
- [ ] 빌드 성공
