<template>
  <main>
    <section>
      <h2>AI Panel</h2>
      <textarea v-model="prompt" placeholder="Опишите задачу..." />
      <button @click="plan">Plan</button>
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
      <pre>{{ diff }}</pre>
      <button @click="apply">Apply</button>
      <button @click="test">Test</button>
    </section>
  </main>
  </template>

<script setup lang="ts">
import { ref } from "vue";

const prompt = ref("");
const planItems = ref<string[]>([]);
const diff = ref<string>("");
const apiBase = (import.meta as any).env?.VITE_API_BASE || window.location.origin.replace(/:\d+$/, ":3000");
const workflowId = "demo";

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
    alert(json.ok ? `Applied: ${json.appliedOperations}` : `Error: ${json.error}`);
  } catch (e) {
    alert(`Apply error: ${String(e)}`);
  }
}
async function test() {
  try {
    const r = await fetch(`${apiBase}/graph/${workflowId}/validate`, { method: "POST" });
    const json = await r.json();
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
</style>

