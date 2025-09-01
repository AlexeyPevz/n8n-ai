<template>
  <div v-if="value >= 0" class="progress">
    <div class="bar" :style="{ width: value + '%' }" />
    <span class="pct">{{ value }}%</span>
  </div>
  <slot />
  <style scoped>
  .progress { position: relative; height: 8px; background: #e2e8f0; border-radius: 4px; margin: 8px 0; }
  .bar { height: 100%; background: #3b82f6; border-radius: 4px; transition: width .2s ease; }
  .pct { position: absolute; right: 0; top: -18px; font-size: 12px; color: #334155; }
  </style>
</template>

<script setup lang="ts">
defineProps<{ value: number }>();
</script>

