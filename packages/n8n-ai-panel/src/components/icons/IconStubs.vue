<template>
  <span :class="cls" aria-hidden="true"></span>
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
