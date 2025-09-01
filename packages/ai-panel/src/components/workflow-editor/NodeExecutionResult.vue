<template>
  <div 
    class="node-execution-result"
    :class="{
      'result-expanded': isExpanded,
      [`result-${nodeExecution.status}`]: true,
    }"
  >
    <!-- Header -->
    <div class="result-header" @click="toggleExpanded">
      <div class="result-icon">
        <IconLoader v-if="nodeExecution.status === 'running'" class="spinning" />
        <IconCheck v-else-if="nodeExecution.status === 'success'" />
        <IconAlert v-else-if="nodeExecution.status === 'error'" />
        <IconClock v-else />
      </div>
      
      <div class="result-info">
        <div class="node-name">{{ node?.name || nodeExecution.nodeId }}</div>
        <div class="node-type">{{ node?.type }}</div>
      </div>
      
      <div class="result-stats">
        <div v-if="nodeExecution.itemsProcessed !== undefined" class="stat-chip">
          <IconData />
          {{ nodeExecution.itemsProcessed }} {{ nodeExecution.itemsProcessed === 1 ? 'item' : 'items' }}
        </div>
        <div v-if="nodeExecution.executionTime" class="stat-chip">
          <IconClock />
          {{ formatDuration(nodeExecution.executionTime) }}
        </div>
      </div>
      
      <IconChevron class="expand-icon" :class="{ 'rotate-180': isExpanded }" />
    </div>
    
    <!-- Content -->
    <div v-show="isExpanded" class="result-content">
      <!-- Error Message -->
      <div v-if="nodeExecution.error" class="error-section">
        <div class="error-title">Error</div>
        <div class="error-message">{{ nodeExecution.error.message }}</div>
        <details v-if="nodeExecution.error.stack" class="error-details">
          <summary>Stack Trace</summary>
          <pre class="error-stack">{{ nodeExecution.error.stack }}</pre>
        </details>
      </div>
      
      <!-- Input/Output Data -->
      <div v-else-if="nodeExecution.data" class="data-section">
        <!-- Input Data -->
        <div v-if="hasInputData" class="data-group">
          <div class="data-title">
            Input Data
            <button @click="inspectData('input')" class="inspect-btn">
              <IconExpand />
              Inspect
            </button>
          </div>
          <div class="data-preview">
            <JsonPreview :data="inputData" :maxItems="3" />
          </div>
        </div>
        
        <!-- Output Data -->
        <div v-if="hasOutputData" class="data-group">
          <div class="data-title">
            Output Data
            <button @click="inspectData('output')" class="inspect-btn">
              <IconExpand />
              Inspect
            </button>
          </div>
          <div class="data-preview">
            <JsonPreview :data="outputData" :maxItems="3" />
          </div>
        </div>
      </div>
      
      <!-- Waiting State -->
      <div v-else-if="nodeExecution.status === 'waiting'" class="waiting-state">
        <IconClock class="waiting-icon" />
        <p>Waiting for execution...</p>
      </div>
      
      <!-- Running State -->
      <div v-else-if="nodeExecution.status === 'running'" class="running-state">
        <IconLoader class="running-icon spinning" />
        <p>Executing node...</p>
        <div v-if="nodeExecution.progress" class="mini-progress">
          <div class="mini-progress-bar">
            <div 
              class="mini-progress-fill"
              :style="{ width: `${nodeExecution.progress}%` }"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Node } from '@/types/workflow';
import JsonPreview from './JsonPreview.vue';
import IconCheck from '../icons/IconCheck.vue';
import IconAlert from '../icons/IconAlert.vue';
import IconClock from '../icons/IconClock.vue';
import IconLoader from '../icons/IconLoader.vue';
import IconChevron from '../icons/IconChevron.vue';
import IconData from '../icons/IconData.vue';
import IconExpand from '../icons/IconExpand.vue';

export interface NodeExecution {
  nodeId: string;
  status: 'waiting' | 'running' | 'success' | 'error';
  startTime?: number;
  executionTime?: number;
  itemsProcessed?: number;
  progress?: number;
  data?: {
    input?: any[][];
    output?: any[][];
  };
  error?: {
    message: string;
    stack?: string;
  };
}

const props = defineProps<{
  nodeExecution: NodeExecution;
  node?: Node;
}>();

const emit = defineEmits(['inspect']);

const isExpanded = ref(false);

// Computed
const hasInputData = computed(() => 
  props.nodeExecution.data?.input && props.nodeExecution.data.input.length > 0
);

const hasOutputData = computed(() => 
  props.nodeExecution.data?.output && props.nodeExecution.data.output.length > 0
);

const inputData = computed(() => props.nodeExecution.data?.input || []);
const outputData = computed(() => props.nodeExecution.data?.output || []);

// Methods
function toggleExpanded() {
  isExpanded.value = !isExpanded.value;
}

function inspectData(type: 'input' | 'output') {
  const data = type === 'input' ? inputData.value : outputData.value;
  emit('inspect', {
    title: `${props.node?.name || props.nodeExecution.nodeId} - ${type.charAt(0).toUpperCase() + type.slice(1)} Data`,
    data,
    nodeId: props.nodeExecution.nodeId,
    type,
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
</script>

<style scoped>
.node-execution-result {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  overflow: hidden;
  transition: all 0.2s;
}

.node-execution-result:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.result-expanded {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

/* Status colors */
.result-waiting {
  border-left: 4px solid #999;
}

.result-running {
  border-left: 4px solid #5fa3d3;
}

.result-success {
  border-left: 4px solid #7fb069;
}

.result-error {
  border-left: 4px solid #ff3333;
}

/* Header */
.result-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  user-select: none;
}

.result-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
}

.result-success .result-icon {
  color: #7fb069;
}

.result-error .result-icon {
  color: #ff3333;
}

.result-running .result-icon {
  color: #5fa3d3;
}

.result-info {
  flex: 1;
  min-width: 0;
}

.node-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-type {
  font-size: 12px;
  color: #999;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-stats {
  display: flex;
  gap: 8px;
}

.stat-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: #f0f0f0;
  border-radius: 12px;
  font-size: 12px;
  color: #666;
}

.stat-chip svg {
  width: 12px;
  height: 12px;
}

.expand-icon {
  width: 16px;
  height: 16px;
  color: #999;
  transition: transform 0.2s;
}

/* Content */
.result-content {
  border-top: 1px solid #f0f0f0;
  padding: 16px;
}

/* Error Section */
.error-section {
  background: #fee;
  border-radius: 4px;
  padding: 12px;
}

.error-title {
  font-size: 12px;
  font-weight: 600;
  color: #ff3333;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.error-message {
  font-size: 13px;
  color: #cc0000;
  margin-bottom: 8px;
}

.error-details {
  margin-top: 8px;
}

.error-details summary {
  font-size: 12px;
  color: #999;
  cursor: pointer;
  user-select: none;
}

.error-stack {
  margin-top: 8px;
  font-size: 11px;
  color: #666;
  background: white;
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
}

/* Data Section */
.data-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.data-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.data-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
}

.inspect-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 11px;
  font-weight: normal;
  text-transform: none;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.inspect-btn:hover {
  background: #f5f5f5;
  border-color: #ff6d5a;
  color: #ff6d5a;
}

.inspect-btn svg {
  width: 12px;
  height: 12px;
}

.data-preview {
  background: #f8f8f8;
  border-radius: 4px;
  padding: 8px;
  font-size: 12px;
}

/* State displays */
.waiting-state,
.running-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  color: #999;
}

.waiting-icon,
.running-icon {
  width: 24px;
  height: 24px;
  opacity: 0.5;
}

.mini-progress {
  width: 100%;
  max-width: 200px;
}

.mini-progress-bar {
  height: 4px;
  background: #e0e0e0;
  border-radius: 2px;
  overflow: hidden;
}

.mini-progress-fill {
  height: 100%;
  background: #5fa3d3;
  transition: width 0.3s ease;
}

/* Animations */
.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.rotate-180 {
  transform: rotate(180deg);
}
</style>