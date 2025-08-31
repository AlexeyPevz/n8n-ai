<template>
  <div class="error-card">
    <div class="hdr">
      <span class="code">{{ code }}</span>
      <button
        class="x"
        @click="$emit('dismiss')"
      >
        ×
      </button>
    </div>
    <div class="msg">
      {{ message }}
    </div>
    <div
      v-if="suggestion"
      class="suggestion"
    >
      {{ suggestion }}
    </div>
    <div
      v-if="actions && actions.length"
      class="actions"
    >
      <button
        v-for="a in actions"
        :key="a"
        class="action"
        @click="$emit('action', a)"
      >
        {{ label(a) }}
      </button>
    </div>
    <details
      v-if="details"
      class="details"
    >
      <summary>Подробности</summary>
      <pre>{{ pretty(details) }}</pre>
    </details>
  </div>
</template>

<script setup lang="ts">
defineProps<{ code: string; message: string; suggestion?: string; actions?: string[]; details?: unknown }>();
defineEmits<{ (e: 'dismiss'): void; (e: 'action', action: string): void }>();

function label(action: string): string {
  if (action === 'critic_autofix') return 'Попробовать авто‑исправить';
  if (action === 'ask_clarifying_question') return 'Уточнить запрос';
  return action;
}

function pretty(obj: unknown): string {
  try { return JSON.stringify(obj, null, 2); } catch { return String(obj); }
}
</script>

<style scoped>
.error-card {
  border: 1px solid #fecaca;
  background: #fef2f2;
  border-radius: 8px;
  padding: 10px 12px;
  margin: 10px 0;
}
.hdr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.code { font-size: 12px; color: #991b1b; font-weight: 600; background: #fee2e2; padding: 2px 6px; border-radius: 4px; }
.x { background: transparent; border: none; font-size: 18px; line-height: 1; cursor: pointer; color: #991b1b; }
.msg { color: #7f1d1d; margin-bottom: 6px; }
.suggestion { color: #7c2d12; background: #fffbeb; border: 1px solid #fed7aa; padding: 6px 8px; border-radius: 6px; margin-bottom: 8px; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; }
.action { background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 6px 10px; cursor: pointer; }
.details summary { cursor: pointer; margin-top: 6px; }
.details pre { background: #fff; padding: 8px; border-radius: 6px; max-height: 200px; overflow: auto; }
</style>

