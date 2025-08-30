<template>
  <main>
    <section>
      <h2>AI Panel</h2>
      <div class="prompt-wrap">
        <textarea
          ref="promptEl"
          v-model="prompt"
          placeholder="Опишите задачу..."
          @keydown="onPromptKeydown"
          @input="maybeOpenExpr"
          @blur="closeExprLater"
        />
        <div v-if="exprOpen && exprItems.length" class="expr-suggest">
          <div class="hdr">Подсказки выражений</div>
          <ul>
            <li
              v-for="(s, i) in exprItems"
              :key="s"
              :class="{ active: i === exprIndex }"
              @mousedown.prevent="applyExpr(s)"
            >{{ s }}</li>
          </ul>
          <div class="hint">Enter — вставить • ↑/↓ — навигация • Esc — закрыть</div>
        </div>
      </div>
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
      <div v-if="simStats" class="sim">
        <div class="sim-row">Nodes visited: <strong>{{ simStats.nodesVisited }}</strong></div>
        <div class="sim-row">Estimated: <strong>{{ simStats.estimatedDurationMs }}ms</strong> (p95: {{ simStats.p95DurationMs }}ms)</div>
        <div v-if="simStats.dataShapes" class="sim-shapes">
          <div class="shape" v-for="(shape, node) in simStats.dataShapes" :key="node">
            <div class="shape-title">{{ node }}</div>
            <pre class="shape-pre">{{ shape }}</pre>
          </div>
        </div>
      </div>
    </section>
  </main>
  </template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";

const prompt = ref("");
const promptEl = ref<HTMLTextAreaElement|null>(null);
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
const simStats = ref<any|null>(null);

// Expression autocomplete (stub)
const exprOpen = ref(false);
const exprIndex = ref(0);
const exprAll = [
  "={{ $json }}",
  "={{ $json.field }}",
  "={{ $now }}",
  "={{ $env.VAR }}",
  "={{ $binary.data }}"
];
const exprItems = ref<string[]>(exprAll);

function maybeOpenExpr() {
  const value = prompt.value;
  if (value.includes("={{")) {
    exprItems.value = exprAll;
    exprIndex.value = 0;
    exprOpen.value = true;
  }
}

function closeExpr() {
  exprOpen.value = false;
}

function closeExprLater() {
  // Закрыть после клика по подсказке (mousedown)
  setTimeout(() => { exprOpen.value = false; }, 100);
}

function onPromptKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.code === "Space") {
    exprItems.value = exprAll;
    exprIndex.value = 0;
    exprOpen.value = true;
    e.preventDefault();
    return;
  }
  if (!exprOpen.value) return;
  if (e.key === "ArrowDown") {
    exprIndex.value = (exprIndex.value + 1) % exprItems.value.length;
    e.preventDefault();
  } else if (e.key === "ArrowUp") {
    exprIndex.value = (exprIndex.value - 1 + exprItems.value.length) % exprItems.value.length;
    e.preventDefault();
  } else if (e.key === "Enter") {
    applyExpr(exprItems.value[exprIndex.value]);
    e.preventDefault();
  } else if (e.key === "Escape") {
    closeExpr();
    e.preventDefault();
  }
}

function applyExpr(snippet: string) {
  const el = promptEl.value;
  if (!el) return;
  const start = el.selectionStart ?? prompt.value.length;
  const end = el.selectionEnd ?? start;
  const before = prompt.value.slice(0, start);
  const after = prompt.value.slice(end);
  prompt.value = before + snippet + after;
  // Установим курсор после вставки
  requestAnimationFrame(() => {
    const pos = (before + snippet).length;
    el.focus();
    el.setSelectionRange(pos, pos);
  });
  closeExpr();
}

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
    // simulate as part of test
    const rs = await fetch(`${apiBase}/graph/${workflowId}/simulate`, { method: "POST" });
    const js = await rs.json();
    simStats.value = js?.stats || null;
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
.prompt-wrap { position: relative; }
textarea {
  width: 100%;
  height: 96px;
}
.expr-suggest { position: absolute; left: 0; right: 0; top: 104px; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 8px 20px rgba(0,0,0,0.08); z-index: 10; }
.expr-suggest .hdr { font-size: 12px; color: #64748b; padding: 6px 10px; border-bottom: 1px solid #f1f5f9; }
.expr-suggest ul { list-style: none; margin: 0; padding: 6px 0; max-height: 180px; overflow: auto; }
.expr-suggest li { padding: 6px 10px; cursor: pointer; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; }
.expr-suggest li.active, .expr-suggest li:hover { background: #eef2ff; color: #3730a3; }
.expr-suggest .hint { font-size: 11px; color: #94a3b8; padding: 6px 10px; border-top: 1px solid #f1f5f9; }
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

