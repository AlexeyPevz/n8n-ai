<template>
  <main>
    <section>
      <h2>AI Panel</h2>
      <textarea v-model="prompt" placeholder="Опишите задачу..." />
      <button @click="plan">Plan</button>
      <div class="progress" v-if="progress >= 0">
        <div class="bar" :style="{ width: progress + '%' }"></div>
        <span class="pct">{{ progress }}%</span>
      </div>
    </section>

    <section v-if="planItems.length">
      <h3>Plan</h3>
      <ul>
        <li v-for="(p, i) in planItems" :key="i">{{ p }}</li>
      </ul>
      <button @click="preview">Preview Diff</button>
    </section>

    <section v-if="diff">
      <h3>Diff Preview</h3>
      <div class="changes" v-if="summary.total">
        <span class="chg add">+ {{ summary.add_node }}</span>
        <span class="chg connect">→ {{ summary.connect }}</span>
        <span class="chg set">⋯ {{ summary.set_params }}</span>
        <span class="chg annotate">✎ {{ summary.annotate }}</span>
        <span class="chg del">− {{ summary.delete }}</span>
      </div>
      <ul v-if="diffItems.length">
        <li v-for="(item, i) in diffItems" :key="i" :class="['diff-item', item.kind]">
          <span class="badge" :class="item.kind">{{ item.badge }}</span>
          <span class="text">{{ item.text }}</span>
        </li>
      </ul>
      <pre v-else>{{ diff }}</pre>
      <button @click="apply" :disabled="hasErrors">Apply</button>
      <button @click="undo">Undo</button>
      <button @click="test">Test</button>
      <div v-if="lints.length" class="lints">
        <div v-for="(l, i) in lints" :key="i" :class="['lint', l.level]">
          <strong>[{{ l.level }}]</strong> {{ l.message }} <span v-if="l.node">({{ l.node }})</span>
        </div>
      </div>
    </section>
  </main>
  </template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";

const prompt = ref("");
const planItems = ref<string[]>([]);
const diff = ref<string>("");
const diffList = ref<string[]>([]);
const diffJson = computed<any>(() => {
  try { return diff.value ? JSON.parse(diff.value) : null; } catch { return null; }
});
const summary = computed(() => {
  const s: Record<string, number> = { add_node: 0, connect: 0, set_params: 0, delete: 0, annotate: 0, total: 0 };
  const ops = diffJson.value?.ops || [];
  for (const op of ops) { if (s[op.op] !== undefined) s[op.op]++; s.total++; }
  return s as { add_node: number; connect: number; set_params: number; delete: number; annotate: number; total: number };
});
const diffItems = computed(() => {
  const ops = diffJson.value?.ops || [];
  return ops.map((op: any) => {
    if (op.op === 'add_node') return { kind: 'add', badge: '+', text: `add_node: ${op.node?.name || op.node?.id || ''}` };
    if (op.op === 'connect') return { kind: 'connect', badge: '→', text: `connect: ${op.from} -> ${op.to}` };
    if (op.op === 'set_params') return { kind: 'set', badge: '⋯', text: `set_params: ${op.name}` };
    if (op.op === 'delete') return { kind: 'del', badge: '−', text: `delete: ${op.name}` };
    if (op.op === 'annotate') return { kind: 'annotate', badge: '✎', text: `annotate: ${op.name}` };
    return { kind: 'other', badge: '•', text: op.op };
  });
});
const lastUndoId = ref<string|undefined>();
const apiBase = (import.meta as any).env?.VITE_API_BASE || window.location.origin.replace(/:\d+$/, ":3000");
const workflowId = "demo";
const lints = ref<any[]>([]);
const hasErrors = computed(() => lints.value.some(l => l.level === 'error'));
const progress = ref<number>(-1);

let es: EventSource | null = null;
onMounted(() => {
  try {
    es = new EventSource(`${apiBase}/events`);
    es.addEventListener('build_progress', (ev: MessageEvent) => {
      try { const data = JSON.parse((ev as any).data); progress.value = Math.max(progress.value, data.progress ?? 0); } catch {}
    });
    es.addEventListener('heartbeat', () => { if (progress.value < 0) progress.value = 0; });
  } catch {}
});
onBeforeUnmount(() => { if (es) { es.close(); es = null; } });

function plan() {
  planItems.value = ["Add HTTP Request node", "Connect to Manual Trigger"];
}
async function preview() {
  try {
    const r = await fetch(`${apiBase}/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt.value })
    });
    const json = await r.json();
    diff.value = JSON.stringify(json, null, 2);
    diffList.value = Array.isArray(json?.ops) ? json.ops.map((op: any) => op.op) : [];
  } catch (e) {
    diff.value = `Error: ${String(e)}`;
  }
}
async function apply() {
  try {
    const batch = diff.value ? JSON.parse(diff.value) : null;
    if (!batch || !batch.ops) {
      alert("No batch to apply");
      return;
    }
    const r = await fetch(`${apiBase}/graph/${workflowId}/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch)
    });
    const json = await r.json();
    if (json.ok) {
      lastUndoId.value = json.undoId;
      alert(`Applied: ${json.appliedOperations}`);
    } else {
      lints.value = Array.isArray(json.lints) ? json.lints : [];
      alert(`Error: ${json.error || 'apply_failed'}`);
    }
  } catch (e) {
    alert(`Apply error: ${String(e)}`);
  }
}
async function undo() {
  try {
    const r = await fetch(`${apiBase}/graph/${workflowId}/undo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ undoId: lastUndoId.value })
    });
    const json = await r.json();
    alert(json.ok ? `Undone ops: ${json.undoneOperations}` : `Error: ${json.error}`);
  } catch (e) {
    alert(`Undo error: ${String(e)}`);
  }
}
async function test() {
  try {
    const r = await fetch(`${apiBase}/graph/${workflowId}/validate`, { method: "POST" });
    const json = await r.json();
    lints.value = json.lints || [];
    alert(json.ok ? `Lints: ${json.lints?.length || 0}` : `Error: ${json.error}`);
  } catch (e) {
    alert(`Test error: ${String(e)}`);
  }
}
</script>

<style>
main {
  padding: 16px;
  font-family: system-ui, sans-serif;
}
textarea {
  width: 100%;
  height: 96px;
}
.progress { position: relative; height: 8px; background: #eef2ff; border-radius: 6px; margin: 8px 0 12px; }
.progress .bar { height: 100%; background: #4f46e5; border-radius: 6px; transition: width .2s; }
.progress .pct { position: absolute; top: -18px; right: 0; font-size: 12px; color: #475569; }
.changes { display: flex; gap: 8px; margin: 8px 0 12px; }
.changes .chg { font-size: 12px; padding: 2px 6px; border-radius: 4px; background: #f3f4f6; }
.changes .add { background: #e6ffed; color: #027a48; }
.changes .connect { background: #edf2ff; color: #4959d6; }
.changes .set { background: #fff7ed; color: #9a3412; }
.changes .annotate { background: #f5f3ff; color: #6d28d9; }
.changes .del { background: #fee2e2; color: #b91c1c; }
.diff-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; margin: 4px 0; }
.diff-item.add { background: #f0fdf4; }
.diff-item.connect { background: #eef2ff; }
.diff-item.set { background: #fffbeb; }
.diff-item.annotate { background: #faf5ff; }
.diff-item.del { background: #fef2f2; }
.diff-item .badge { display: inline-flex; width: 20px; justify-content: center; font-weight: 600; }
.lints { margin-top: 8px; }
.lint { font-size: 13px; padding: 6px 8px; border-left: 3px solid #cbd5e1; background: #f8fafc; border-radius: 4px; margin: 4px 0; }
.lint.info { border-color: #38bdf8; }
.lint.warn { border-color: #f59e0b; }
.lint.error { border-color: #ef4444; }
</style>

