<template>
  <div
    v-if="total > 0"
    class="changes"
  >
    <span class="chg add">+ {{ addNode }}</span>
    <span class="chg connect">→ {{ connect }}</span>
    <span class="chg set">⋯ {{ setParams }}</span>
    <span class="chg annotate">✎ {{ annotate }}</span>
    <span class="chg del">− {{ del }}</span>
  </div>
  <style scoped>
    .changes {
    display: flex;
    gap: 8px;
    margin: 8px 0;
    color: #334155;
    font-size: 12px;
    }
    .chg.add {
    color: #16a34a;
    }
    .chg.connect {
    color: #0ea5e9;
    }
    .chg.set {
    color: #a855f7;
    }
    .chg.annotate {
    color: #f59e0b;
    }
    .chg.del {
    color: #ef4444;
    }
  </style>
</template>

<script setup lang="ts">
defineProps<{
  addNode: number;
  connect: number;
  setParams: number;
  annotate: number;
  del: number;
  total: number;
}>();
</script>
