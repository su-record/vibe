# Component Output Template

Use this template when generating a section component from Figma reference code.

---

## Normal Mode (External SCSS)

```vue
<!-- components/{{FEATURE_KEY}}/{{ComponentName}}.vue -->
<template>
  <section class="{{sectionName}}">
    <!-- BG Layer (if section has background image) -->
    <div class="{{sectionName}}Bg">
      <img src="/images/{{FEATURE_KEY}}/{{bg-file}}.webp" alt="" aria-hidden="true" />
    </div>

    <!-- Content Layer -->
    <div class="{{sectionName}}Content">
      <!-- Title image (if present) -->
      <div class="{{sectionName}}Title">
        <img src="/images/{{FEATURE_KEY}}/{{title-file}}.webp" alt="{{TITLE_ALT_TEXT}}" />
      </div>

      <!-- Repeating items (from storyboard mock data) -->
      <ul class="{{sectionName}}List">
        <li
          v-for="item in items"
          :key="item.id"
          class="{{sectionName}}Item"
        >
          <img :src="item.image" :alt="item.label" />
          <p class="{{sectionName}}ItemLabel">{{ item.label }}</p>
        </li>
      </ul>

      <!-- CTA Button -->
      <button class="{{sectionName}}Btn" @click="handleAction">
        {{BUTTON_LABEL}}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * {{SECTION_DISPLAY_NAME}}
 *
 * [기능 정의]
 * - {{FEATURE_REQUIREMENT_1}}
 * - {{FEATURE_REQUIREMENT_2}}
 *
 * [인터랙션]
 * ① {{INTERACTION_1}}
 * ② {{INTERACTION_2}}
 *
 * [상태] {{STATE_LIST}}
 */

interface {{ItemType}} {
  id: number
  label: string
  image: string
}

const items: {{ItemType}}[] = [
  { id: 1, label: '{{MOCK_LABEL_1}}', image: '/images/{{FEATURE_KEY}}/{{mock-img-1}}.webp' },
  { id: 2, label: '{{MOCK_LABEL_2}}', image: '/images/{{FEATURE_KEY}}/{{mock-img-2}}.webp' },
  { id: 3, label: '{{MOCK_LABEL_3}}', image: '/images/{{FEATURE_KEY}}/{{mock-img-3}}.webp' },
]

const emit = defineEmits<{
  action: []
}>()

function handleAction(): void {
  // TODO: {{ACTION_DESCRIPTION}}
  emit('action')
}
</script>
<!-- styles: styles/{{FEATURE_KEY}}/layout/_{{section}}.scss + components/_{{section}}.scss -->
```

---

## Literal Mode (Scoped CSS)

```vue
<!-- components/{{FEATURE_KEY}}/{{ComponentName}}.vue -->
<template>
  <section class="{{sectionName}}">
    <!-- 1:1 structure from reference code — preserve all nesting -->
    <div class="bg">
      <img src="/images/{{FEATURE_KEY}}/{{bg-file}}.webp" alt="" aria-hidden="true" />
    </div>
    <div class="titleArea">
      <img src="/images/{{FEATURE_KEY}}/{{title-file}}.webp" alt="{{TITLE_ALT_TEXT}}" />
    </div>
    <!-- Re-insert Phase 1 functional elements at appropriate positions -->
    <button class="ctaBtn" @click="handleAction">{{BUTTON_LABEL}}</button>
  </section>
</template>

<script setup lang="ts">
/**
 * {{SECTION_DISPLAY_NAME}}
 * [기능 정의] {{FEATURE_REQUIREMENT_1}}
 * [인터랙션] ① {{INTERACTION_1}}
 * [상태] {{STATE_LIST}}
 */

function handleAction(): void {
  // TODO: {{ACTION_DESCRIPTION}}
}
</script>

<style scoped>
.{{sectionName}} {
  position: relative;
  width: 100%;
  height: {{SECTION_HEIGHT_SCALED}}px; /* {{SECTION_HEIGHT_ORIGINAL}} × {{SCALE_FACTOR}} */
  overflow: hidden;
}

.bg {
  position: absolute;
  inset: 0;
}

.bg img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.titleArea {
  position: absolute;
  top: {{TITLE_TOP_SCALED}}px;    /* {{TITLE_TOP_ORIGINAL}} × {{SCALE_FACTOR}} */
  left: 50%;
  transform: translateX(-50%);
  width: {{TITLE_WIDTH_SCALED}}px;
  height: {{TITLE_HEIGHT_SCALED}}px;
}

/* {{RESPONSIVE_BREAKPOINT}} */
@media (min-width: {{BP_PC}}px) {
  .{{sectionName}} {
    height: {{SECTION_HEIGHT_PC_SCALED}}px;
  }
}
</style>
```
