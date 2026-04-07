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

## SCSS Layout (tree.json 직접 매핑)

```scss
// tree.json 데이터:
// {{SECTION_NAME}}: { width:{{WIDTH}}, height:{{HEIGHT}}, overflow:hidden }
// {{CHILD_1}}: { display:flex, flexDirection:column, gap:{{GAP}}px, padding:"{{PADDING}}" }
// scaleFactor = {{SCALE_FACTOR}}

.{{sectionName}} {
  position: relative;
  width: 100%;
  height: {{HEIGHT_SCALED}}px;           // tree: {{HEIGHT}} × {{SCALE_FACTOR}}
  overflow: hidden;                       // tree: overflow:hidden
}

.{{sectionName}}__bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  img { width: 100%; height: 100%; object-fit: cover; }
}

.{{sectionName}}__{{child1Name}} {
  display: flex;                          // tree: display:flex
  flex-direction: column;                 // tree: flexDirection:column
  gap: {{GAP_SCALED}}px;                  // tree: {{GAP}} × {{SCALE_FACTOR}}
  padding: {{PADDING_SCALED}};            // tree: "{{PADDING}}" × {{SCALE_FACTOR}}
}
```

---

## SCSS Components (tree.json 직접 매핑)

```scss
// tree.json 데이터:
// TEXT "{{TEXT_1}}": { fontSize:{{FONT_SIZE}}px, fontWeight:{{FONT_WEIGHT}}, color:{{COLOR}} }

.{{sectionName}}__title {
  font-size: {{FONT_SIZE_SCALED}}px;      // tree: {{FONT_SIZE}} × {{SCALE_FACTOR}}
  font-weight: {{FONT_WEIGHT}};           // tree: 직접 (scaleFactor 미적용)
  color: {{COLOR}};                       // tree: 직접 (scaleFactor 미적용)
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
