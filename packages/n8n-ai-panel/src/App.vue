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

function plan() {
  planItems.value = ["Add HTTP Request node", "Connect to Manual Trigger"];
}
function preview() {
  diff.value = JSON.stringify(
    {
      ops: [
        { op: "add_node", node: { id: "http-1", type: "n8n-nodes-base.httpRequest" } },
        { op: "connect", from: "Manual Trigger", to: "http-1" }
      ]
    },
    null,
    2
  );
}
function apply() {
  alert("Apply clicked");
}
function test() {
  alert("Test clicked");
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

