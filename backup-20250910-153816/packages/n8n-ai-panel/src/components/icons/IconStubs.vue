<template>
  <svg :class="cls" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <circle cx="8" cy="8" r="6" fill="currentColor" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ name?: string }>();
const cls = computed(() => `icon-stub ${props.name ?? 'icon'}`);
</script>

<style scoped>
.icon-stub {
  display: inline-block;
  width: 1em;
  height: 1em;
}
</style>
