<template>
  <div class="execution-panel" :class="{ 'panel-open': isOpen }">
    <!-- Panel Header -->
    <div class="panel-header" @click="togglePanel">
      <div class="panel-title">
        <IconPlay v-if="!execution" class="title-icon" />
        <IconLoader v-else-if="execution.status === 'running'" class="title-icon spinning" />
        <IconCheck v-else-if="execution.status === 'success'" class="title-icon success" />
        <IconAlert v-else-if="execution.status === 'error'" class="title-icon error" />
        
        <span>Execution</span>
        <span v-if="execution" class="execution-id">#{{ execution.id.slice(-6) }}</span>
      </div>
      
      <div class="panel-controls">
        <button
          v-if="!isRunning"
          @click.stop="startExecution"
          class="control-btn primary"
          :disabled="!canExecute"
        >
          <IconPlay />
          Execute Workflow
        </button>
        
        <button
          v-else
          @click.stop="stopExecution"
          class="control-btn danger"
        >
          <IconStop />
          Stop
        </button>
        
        <button @click.stop="togglePanel" class="control-btn">
          <IconChevron :class="{ 'rotate-180': isOpen }" />
        </button>
      </div>
    </div>
    
    <!-- Panel Content -->
    <div class="panel-content" v-show="isOpen">
      <!-- Execution Info -->
      <div v-if="execution" class="execution-info">
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Status</span>
            <span class="info-value" :class="`status-${execution.status}`">
              {{ execution.status }}
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">Started</span>
            <span class="info-value">{{ formatTime(execution.startedAt) }}</span>
          </div>
          <div class="info-item" v-if="execution.stoppedAt">
            <span class="info-label">Duration</span>
            <span class="info-value">{{ formatDuration(execution.duration) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Mode</span>
            <span class="info-value">{{ execution.mode }}</span>
          </div>
        </div>
        
        <!-- Progress Bar -->
        <div v-if="isRunning" class="execution-progress">
          <div class="progress-bar">
            <div 
              class="progress-fill"
              :style="{ width: `${executionProgress}%` }"
            />
          </div>
          <div class="progress-text">
            {{ executedNodes }} / {{ totalNodes }} nodes executed
          </div>
        </div>
      </div>
      
      <!-- Node Execution Results -->
      <div class="node-results">
        <h3 class="section-title">Node Execution</h3>
        
        <div v-if="!nodeExecutions.length" class="empty-state">
          <IconWorkflow class="empty-icon" />
          <p>No execution data yet</p>
          <p class="empty-hint">Click "Execute Workflow" to run</p>
        </div>
        
        <div v-else class="results-list">
          <NodeExecutionResult
            v-for="nodeExec in nodeExecutions"
            :key="nodeExec.nodeId"
            :nodeExecution="nodeExec"
            :node="getNode(nodeExec.nodeId)"
            @inspect="inspectNodeData"
          />
        </div>
      </div>
      
      <!-- Execution Log -->
      <div class="execution-log" v-if="showLog">
        <h3 class="section-title">
          Execution Log
          <button @click="clearLog" class="clear-btn">Clear</button>
        </h3>
        
        <div class="log-entries" ref="logContainer">
          <div
            v-for="(entry, index) in logEntries"
            :key="index"
            class="log-entry"
            :class="`log-${entry.level}`"
          >
            <span class="log-time">{{ formatLogTime(entry.timestamp) }}</span>
            <span class="log-node" v-if="entry.nodeId">[{{ getNodeName(entry.nodeId) }}]</span>
            <span class="log-message">{{ entry.message }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Data Inspector Modal -->
    <DataInspector
      v-if="inspectedData"
      :data="inspectedData"
      @close="inspectedData = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useWorkflowStore } from '@/stores/workflow';
import { useExecutionStore } from '@/stores/execution';
import NodeExecutionResult from './NodeExecutionResult.vue';
import DataInspector from './DataInspector.vue';
import IconPlay from '../icons/IconPlay.vue';
import IconStop from '../icons/IconStop.vue';
import IconLoader from '../icons/IconLoader.vue';
import IconCheck from '../icons/IconCheck.vue';
import IconAlert from '../icons/IconAlert.vue';
import IconChevron from '../icons/IconChevron.vue';
import IconWorkflow from '../icons/IconWorkflow.vue';

const workflowStore = useWorkflowStore();
const executionStore = useExecutionStore();

// Panel state
const isOpen = ref(false);
const showLog = ref(true);
const inspectedData = ref<any>(null);

// Execution state
const execution = computed(() => executionStore.currentExecution);
const isRunning = computed(() => execution.value?.status === 'running');
const nodeExecutions = computed(() => executionStore.nodeExecutions);
const logEntries = computed(() => executionStore.logEntries);

// Progress calculation
const totalNodes = computed(() => workflowStore.nodes.length);
const executedNodes = computed(() => 
  nodeExecutions.value.filter(ne => ne.status !== 'waiting').length
);
const executionProgress = computed(() => 
  totalNodes.value > 0 ? (executedNodes.value / totalNodes.value) * 100 : 0
);

// Can execute check
const canExecute = computed(() => {
  const validation = workflowStore.validateWorkflow();
  return validation.valid && workflowStore.nodes.length > 0;
});

// Auto-scroll log
const logContainer = ref<HTMLElement>();
watch(logEntries, () => {
  if (logContainer.value) {
    nextTick(() => {
      logContainer.value.scrollTop = logContainer.value.scrollHeight;
    });
  }
});

// Open panel when execution starts
watch(isRunning, (running) => {
  if (running) {
    isOpen.value = true;
  }
});

// Methods
function togglePanel() {
  isOpen.value = !isOpen.value;
}

async function startExecution() {
  try {
    await executionStore.startExecution({
      workflowId: workflowStore.workflowId,
      mode: 'manual',
      data: workflowStore.saveWorkflow(),
    });
  } catch (error) {
    console.error('Failed to start execution:', error);
  }
}

async function stopExecution() {
  try {
    await executionStore.stopExecution();
  } catch (error) {
    console.error('Failed to stop execution:', error);
  }
}

function getNode(nodeId: string) {
  return workflowStore.nodeById.get(nodeId);
}

function getNodeName(nodeId: string) {
  const node = getNode(nodeId);
  return node?.name || nodeId;
}

function inspectNodeData(data: any) {
  inspectedData.value = data;
}

function clearLog() {
  executionStore.clearLog();
}

// Formatting helpers
function formatTime(timestamp: string | Date): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function formatLogTime(timestamp: Date): string {
  return timestamp.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
}
</script>

<style scoped>
.execution-panel {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  border-top: 1px solid #ddd;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  transition: height 0.3s ease;
  height: 60px;
  z-index: 100;
}

.execution-panel.panel-open {
  height: 400px;
}

/* Header */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 60px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.title-icon {
  width: 20px;
  height: 20px;
}

.title-icon.spinning {
  animation: spin 1s linear infinite;
}

.title-icon.success {
  color: #7fb069;
}

.title-icon.error {
  color: #ff3333;
}

.execution-id {
  font-size: 14px;
  color: #999;
  font-weight: normal;
}

.panel-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.control-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  color: #666;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.control-btn:hover {
  background: #f5f5f5;
  border-color: #ccc;
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.control-btn.primary {
  background: #ff6d5a;
  border-color: #ff6d5a;
  color: white;
}

.control-btn.primary:hover {
  background: #ff5544;
}

.control-btn.danger {
  background: #ff3333;
  border-color: #ff3333;
  color: white;
}

.control-btn.danger:hover {
  background: #ee2222;
}

.rotate-180 {
  transform: rotate(180deg);
}

/* Content */
.panel-content {
  height: calc(100% - 60px);
  overflow-y: auto;
  padding: 20px;
}

/* Execution Info */
.execution-info {
  background: #f8f8f8;
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 20px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 12px;
  color: #999;
  text-transform: uppercase;
}

.info-value {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.status-running {
  color: #5fa3d3;
}

.status-success {
  color: #7fb069;
}

.status-error {
  color: #ff3333;
}

/* Progress */
.execution-progress {
  margin-top: 16px;
}

.progress-bar {
  height: 6px;
  background: #e0e0e0;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: #5fa3d3;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 12px;
  color: #666;
  text-align: center;
}

/* Node Results */
.node-results {
  margin-bottom: 30px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #999;
}

.empty-icon {
  width: 48px;
  height: 48px;
  opacity: 0.3;
  margin-bottom: 16px;
}

.empty-hint {
  font-size: 12px;
  margin-top: 8px;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Execution Log */
.execution-log {
  border-top: 1px solid #e0e0e0;
  padding-top: 20px;
}

.clear-btn {
  font-size: 12px;
  font-weight: normal;
  color: #999;
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
}

.clear-btn:hover {
  color: #666;
}

.log-entries {
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  background: #1e1e1e;
  color: #d4d4d4;
  border-radius: 4px;
  padding: 12px;
  max-height: 200px;
  overflow-y: auto;
}

.log-entry {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
  line-height: 1.4;
}

.log-time {
  color: #858585;
  white-space: nowrap;
}

.log-node {
  color: #4fc3f7;
}

.log-message {
  flex: 1;
}

.log-info {
  color: #d4d4d4;
}

.log-success {
  color: #7fb069;
}

.log-warning {
  color: #ffa940;
}

.log-error {
  color: #ff6b6b;
}

/* Animations */
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Scrollbar */
.panel-content::-webkit-scrollbar,
.log-entries::-webkit-scrollbar {
  width: 6px;
}

.panel-content::-webkit-scrollbar-track,
.log-entries::-webkit-scrollbar-track {
  background: transparent;
}

.panel-content::-webkit-scrollbar-thumb {
  background: #ddd;
  border-radius: 3px;
}

.log-entries::-webkit-scrollbar-thumb {
  background: #444;
}
</style>