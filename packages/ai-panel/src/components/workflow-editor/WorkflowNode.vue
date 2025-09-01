<template>
  <g
    class="workflow-node"
    :class="{
      'node-selected': selected,
      'node-disabled': node.disabled,
      'node-error': node.hasError,
    }"
    :transform="`translate(${node.position[0]}, ${node.position[1]})`"
    @mousedown="$emit('mousedown', $event)"
    @dblclick="$emit('configure')"
  >
    <!-- Node Background -->
    <rect
      class="node-background"
      x="0"
      y="0"
      :width="nodeWidth"
      :height="nodeHeight"
      rx="4"
      ry="4"
    />
    
    <!-- Node Border -->
    <rect
      class="node-border"
      x="0"
      y="0"
      :width="nodeWidth"
      :height="nodeHeight"
      rx="4"
      ry="4"
      fill="none"
      stroke-width="2"
    />
    
    <!-- Node Icon Background -->
    <rect
      class="node-icon-bg"
      x="0"
      y="0"
      width="60"
      :height="nodeHeight"
      rx="4"
      ry="4"
    />
    
    <!-- Node Icon -->
    <foreignObject x="10" y="15" width="40" height="40">
      <div class="node-icon-wrapper">
        <img
          v-if="nodeType.icon"
          :src="getNodeIcon(nodeType.icon)"
          :alt="nodeType.name"
          class="node-icon"
        />
        <div v-else class="node-icon-placeholder">
          {{ nodeType.name.charAt(0).toUpperCase() }}
        </div>
      </div>
    </foreignObject>
    
    <!-- Node Content -->
    <foreignObject x="70" y="0" :width="nodeWidth - 70" :height="nodeHeight">
      <div class="node-content">
        <div class="node-title">{{ node.name || nodeType.displayName }}</div>
        <div class="node-subtitle" v-if="nodeSubtitle">
          {{ nodeSubtitle }}
        </div>
      </div>
    </foreignObject>
    
    <!-- Input Endpoints -->
    <g class="node-inputs" v-if="nodeType.inputs?.length > 0">
      <g
        v-for="(input, index) in nodeType.inputs"
        :key="`input-${index}`"
        class="node-endpoint node-input"
        :transform="`translate(-8, ${getInputPosition(index)})`"
        @mousedown.stop="handleInputMouseDown"
        @mouseup="handleInputMouseUp(index)"
      >
        <circle
          r="6"
          :fill="connected.inputs[index] ? '#ff6d5a' : '#999'"
          stroke="#fff"
          stroke-width="2"
        />
      </g>
    </g>
    
    <!-- Output Endpoints -->
    <g class="node-outputs" v-if="nodeType.outputs?.length > 0">
      <g
        v-for="(output, index) in nodeType.outputs"
        :key="`output-${index}`"
        class="node-endpoint node-output"
        :transform="`translate(${nodeWidth + 8}, ${getOutputPosition(index)})`"
        @mousedown.stop="handleOutputMouseDown(index)"
      >
        <circle
          r="6"
          :fill="connected.outputs[index] ? '#ff6d5a' : '#999'"
          stroke="#fff"
          stroke-width="2"
          class="endpoint-circle"
        />
        <circle
          r="12"
          fill="transparent"
          class="endpoint-hover-area"
        />
      </g>
    </g>
    
    <!-- Status Indicators -->
    <g class="node-status" v-if="node.status">
      <!-- Execution Status -->
      <g v-if="node.status.execution" :transform="`translate(${nodeWidth - 30}, 10)`">
        <circle
          r="8"
          :fill="getStatusColor(node.status.execution)"
          class="status-indicator"
        />
        <text
          v-if="node.status.execution === 'running'"
          x="0"
          y="4"
          text-anchor="middle"
          fill="white"
          font-size="10"
          font-weight="bold"
        >
          ...
        </text>
      </g>
      
      <!-- Error Badge -->
      <g v-if="node.hasError" :transform="`translate(${nodeWidth - 30}, ${nodeHeight - 10})`">
        <circle r="10" fill="#ff3333" />
        <text x="0" y="4" text-anchor="middle" fill="white" font-size="12" font-weight="bold">
          !
        </text>
      </g>
    </g>
    
    <!-- Selection Handles -->
    <g v-if="selected" class="selection-handles">
      <rect
        v-for="handle in selectionHandles"
        :key="handle.position"
        :x="handle.x - 4"
        :y="handle.y - 4"
        width="8"
        height="8"
        fill="white"
        stroke="#ff6d5a"
        stroke-width="2"
        class="selection-handle"
        :data-position="handle.position"
      />
    </g>
  </g>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useNodeTypesStore } from '@/stores/nodeTypes';

interface NodeType {
  name: string;
  displayName: string;
  group: string;
  icon?: string;
  color?: string;
  inputs: string[];
  outputs: string[];
  properties?: any[];
}

interface NodeStatus {
  execution?: 'waiting' | 'running' | 'success' | 'error';
  itemsProcessed?: number;
  executionTime?: number;
}

interface WorkflowNodeData {
  id: string;
  name?: string;
  type: string;
  position: [number, number];
  parameters?: Record<string, any>;
  disabled?: boolean;
  hasError?: boolean;
  status?: NodeStatus;
}

const props = defineProps<{
  node: WorkflowNodeData;
  selected: boolean;
  zoom: number;
  connected?: {
    inputs: boolean[];
    outputs: boolean[];
  };
}>();

const emit = defineEmits([
  'mousedown',
  'connection-start',
  'connection-end',
  'delete',
  'duplicate',
  'configure'
]);

const nodeTypesStore = useNodeTypesStore();

// Node dimensions
const nodeWidth = 280;
const nodeHeight = 70;

// Get node type info
const nodeType = computed((): NodeType => {
  return nodeTypesStore.getNodeType(props.node.type) || {
    name: props.node.type,
    displayName: props.node.type,
    group: 'unknown',
    inputs: ['main'],
    outputs: ['main'],
  };
});

// Node appearance
const nodeColor = computed(() => {
  if (props.node.hasError) return '#ff3333';
  if (props.node.disabled) return '#aaa';
  return nodeType.value.color || getGroupColor(nodeType.value.group);
});

const nodeSubtitle = computed(() => {
  if (props.node.status?.execution === 'running') {
    return 'Executing...';
  }
  if (props.node.status?.itemsProcessed !== undefined) {
    return `${props.node.status.itemsProcessed} items`;
  }
  if (props.node.parameters?.operation) {
    return props.node.parameters.operation;
  }
  return '';
});

// Selection handles
const selectionHandles = computed(() => [
  { position: 'nw', x: 0, y: 0 },
  { position: 'n', x: nodeWidth / 2, y: 0 },
  { position: 'ne', x: nodeWidth, y: 0 },
  { position: 'e', x: nodeWidth, y: nodeHeight / 2 },
  { position: 'se', x: nodeWidth, y: nodeHeight },
  { position: 's', x: nodeWidth / 2, y: nodeHeight },
  { position: 'sw', x: 0, y: nodeHeight },
  { position: 'w', x: 0, y: nodeHeight / 2 },
]);

// Helper functions
function getGroupColor(group: string): string {
  const colors: Record<string, string> = {
    'input': '#7fb069',
    'output': '#ff6d5a',
    'transform': '#5fa3d3',
    'flow': '#ffa940',
    'function': '#b47cff',
    'data': '#ff6b6b',
    'communication': '#22cce2',
    'utility': '#9b9b9b',
  };
  return colors[group] || '#757575';
}

function getNodeIcon(icon: string): string {
  // In real implementation, this would return the actual icon URL
  return `/node-icons/${icon}`;
}

function getInputPosition(index: number): number {
  const count = nodeType.value.inputs.length;
  if (count === 1) return nodeHeight / 2;
  const spacing = nodeHeight / (count + 1);
  return spacing * (index + 1);
}

function getOutputPosition(index: number): number {
  const count = nodeType.value.outputs.length;
  if (count === 1) return nodeHeight / 2;
  const spacing = nodeHeight / (count + 1);
  return spacing * (index + 1);
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'waiting': return '#666';
    case 'running': return '#5fa3d3';
    case 'success': return '#7fb069';
    case 'error': return '#ff3333';
    default: return '#999';
  }
}

// Connection handlers
function handleInputMouseDown(event: MouseEvent) {
  // Prevent connection creation from inputs
  event.stopPropagation();
}

function handleInputMouseUp(index: number) {
  emit('connection-end', { nodeId: props.node.id, index });
}

function handleOutputMouseDown(index: number) {
  emit('connection-start', { nodeId: props.node.id, index });
}
</script>

<style scoped>
.workflow-node {
  cursor: move;
  transition: filter 0.2s;
}

.workflow-node:hover {
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.15));
}

.node-selected {
  filter: drop-shadow(0 2px 12px rgba(255, 109, 90, 0.3));
}

/* Node Background */
.node-background {
  fill: white;
  filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.1));
}

.node-border {
  stroke: transparent;
  transition: stroke 0.2s;
}

.node-selected .node-border {
  stroke: #ff6d5a;
}

.node-disabled .node-background {
  fill: #f5f5f5;
}

.node-error .node-border {
  stroke: #ff3333;
}

/* Icon */
.node-icon-bg {
  fill: v-bind(nodeColor);
  opacity: 0.1;
}

.node-icon-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.node-icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.node-icon-placeholder {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: v-bind(nodeColor);
  color: white;
  border-radius: 4px;
  font-weight: bold;
  font-size: 18px;
}

/* Content */
.node-content {
  padding: 12px 15px 12px 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.node-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-subtitle {
  font-size: 12px;
  color: #666;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-disabled .node-title,
.node-disabled .node-subtitle {
  color: #999;
}

/* Endpoints */
.node-endpoint {
  cursor: crosshair;
  transition: transform 0.2s;
}

.node-endpoint:hover {
  transform: scale(1.2);
}

.endpoint-circle {
  transition: all 0.2s;
}

.endpoint-hover-area {
  cursor: crosshair;
}

/* Status */
.status-indicator {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

/* Selection */
.selection-handle {
  cursor: nwse-resize;
  transition: transform 0.2s;
}

.selection-handle:hover {
  transform: scale(1.5);
}

.selection-handle[data-position="n"],
.selection-handle[data-position="s"] {
  cursor: ns-resize;
}

.selection-handle[data-position="e"],
.selection-handle[data-position="w"] {
  cursor: ew-resize;
}

.selection-handle[data-position="ne"],
.selection-handle[data-position="sw"] {
  cursor: nesw-resize;
}
</style>