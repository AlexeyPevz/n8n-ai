<template>
  <div class="workflow-canvas">
    <div
      ref="canvasRef"
      class="canvas-container"
      @wheel.prevent="onWheel"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
    >
      <div class="scene" :style="sceneStyle">
        <!-- Простая визуализация нод и связей -->
        <svg
          class="connections-layer"
          :width="canvasSize.width"
          :height="canvasSize.height"
        >
        <g
          v-for="connection in connections"
          :key="`${connection.from}-${connection.to}`"
        >
          <path
            :d="getConnectionPath(connection)"
            :class="['connection', getConnectionClass(connection)]"
            fill="none"
            stroke-width="2"
          />
        </g>
        </svg>
      
      <div
        v-for="node in nodes"
        :key="node.id"
        :class="['node', getNodeClass(node)]"
        :style="getNodeStyle(node)"
        @click="$emit('node-click', node)"
      >
        <div class="node-icon">
          {{ getNodeIcon(node.type) }}
        </div>
        <div class="node-name">
          {{ node.name }}
        </div>
        <div v-if="statusById[node.id]" class="node-overlay">
          <span class="st">{{ statusById[node.id].status }}</span>
          <span class="cost">$ {{ (statusById[node.id].estimatedCostCents/100).toFixed(2) }}</span>
        </div>
        <div
          v-if="node.annotation"
          class="node-annotation"
        >
          {{ node.annotation }}
        </div>
      </div>
      </div>
    </div>
    
    <div class="canvas-legend">
      <div class="legend-item">
        <span class="legend-color added" />
        <span>Добавлено</span>
      </div>
      <div class="legend-item">
        <span class="legend-color modified" />
        <span>Изменено</span>
      </div>
      <div class="legend-item">
        <span class="legend-color deleted" />
        <span>Удалено</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Node, Connection } from '@n8n-ai/schemas';

interface Props {
  nodes: Node[];
  connections: Connection[];
  changes?: {
    added: string[];
    modified: string[];
    deleted: string[];
  };
  liveOverlay?: Array<{ id: string; name: string; status: 'idle' | 'running' | 'error'; estimatedCostCents: number }>
}

const props = defineProps<Props>();
defineEmits<{ (e: 'node-click', node: Node): void }>();
const canvasRef = ref<HTMLElement>();

const canvasSize = computed(() => ({
  width: 800,
  height: 600
}));

const nodePositions = computed(() => {
  // Простой layout алгоритм
  const positions: Record<string, { x: number; y: number }> = {};
  const x = 100;
  const y = 100;
  
  props.nodes.forEach((node, index) => {
    positions[node.id] = {
      x: x + (index % 3) * 200,
      y: y + Math.floor(index / 3) * 150
    };
  });
  
  return positions;
});

const statusById = computed<Record<string, { status: 'idle' | 'running' | 'error'; estimatedCostCents: number }>>(() => {
  const map: Record<string, { status: 'idle' | 'running' | 'error'; estimatedCostCents: number }> = {};
  if (props.liveOverlay && Array.isArray(props.liveOverlay)) {
    for (const w of props.liveOverlay) {
      // отображаем лишь если id воркфлоу совпадает с id ноды (упрощение для демо)
      // в реальности нужно маппить воркфлоу→ноды и выводить агрегат
      map[w.id] = { status: w.status, estimatedCostCents: w.estimatedCostCents };
    }
  }
  return map;
});

// Zoom & pan state
const scale = ref(1);
const panX = ref(0);
const panY = ref(0);
const dragging = ref(false);
let lastX = 0;
let lastY = 0;

const sceneStyle = computed(() => ({
  transform: `translate(${panX.value}px, ${panY.value}px) scale(${scale.value})`,
  transformOrigin: '0 0'
}));

function onWheel(e: WheelEvent) {
  const delta = -e.deltaY * 0.001;
  const next = Math.min(2, Math.max(0.5, scale.value + delta));
  scale.value = next;
}
function onMouseDown(e: MouseEvent) {
  if (e.button !== 0) return;
  dragging.value = true;
  lastX = e.clientX;
  lastY = e.clientY;
}
function onMouseMove(e: MouseEvent) {
  if (!dragging.value) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  panX.value += dx;
  panY.value += dy;
  lastX = e.clientX;
  lastY = e.clientY;
}
function onMouseUp() {
  dragging.value = false;
}

function getNodeStyle(node: Node) {
  const pos = nodePositions.value[node.id] || { x: 0, y: 0 };
  return {
    left: `${pos.x}px`,
    top: `${pos.y}px`
  };
}

function getNodeClass(node: Node) {
  if (!props.changes) return '';
  
  if (props.changes.added.includes(node.id)) return 'added';
  if (props.changes.modified.includes(node.id)) return 'modified';
  if (props.changes.deleted.includes(node.id)) return 'deleted';
  
  return '';
}

function getConnectionClass(connection: Connection) {
  if (!props.changes) return '';
  
  const connectionId = `${connection.from}-${connection.to}`;
  if (props.changes.added.includes(connectionId)) return 'added';
  if (props.changes.deleted.includes(connectionId)) return 'deleted';
  
  return '';
}

function getConnectionPath(connection: Connection) {
  const fromPos = nodePositions.value[connection.from];
  const toPos = nodePositions.value[connection.to];
  
  if (!fromPos || !toPos) return '';
  
  const x1 = fromPos.x + 150; // node width
  const y1 = fromPos.y + 30;   // node height / 2
  const x2 = toPos.x;
  const y2 = toPos.y + 30;
  
  // Bezier curve
  const cx1 = x1 + (x2 - x1) * 0.5;
  const cx2 = x2 - (x2 - x1) * 0.5;
  
  return `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
}

function getNodeIcon(type: string) {
  const iconMap: Record<string, string> = {
    'n8n-nodes-base.httpRequest': '🌐',
    'n8n-nodes-base.webhook': '🪝',
    'n8n-nodes-base.scheduleTrigger': '⏰',
    'n8n-nodes-base.manualTrigger': '▶️',
    'n8n-nodes-base.set': '📝',
    'n8n-nodes-base.if': '❓',
    'n8n-nodes-base.code': '💻'
  };
  
  return iconMap[type] || '📦';
}
</script>

<style scoped>
.workflow-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  background: #fafafa;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

.canvas-container {
  position: relative;
  width: 100%;
  height: calc(100% - 40px);
  overflow: auto;
}

.scene {
  position: relative;
  width: 100%;
  height: 100%;
  will-change: transform;
}

.connections-layer {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

.connection {
  stroke: #999;
  transition: stroke 0.3s;
}

.connection.added {
  stroke: #4caf50;
  stroke-dasharray: 5, 5;
}

.connection.deleted {
  stroke: #f44336;
  stroke-dasharray: 5, 5;
}

.node {
  position: absolute;
  width: 150px;
  padding: 10px;
  background: white;
  border: 2px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.node .node-overlay {
  margin-top: 6px;
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #334155;
}

.node .node-overlay .st { text-transform: uppercase; }
.node .node-overlay .cost { font-weight: 600; }

.node:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.node.added {
  border-color: #4caf50;
  background: #e8f5e9;
}

.node.modified {
  border-color: #ff9800;
  background: #fff3e0;
}

.node.deleted {
  border-color: #f44336;
  background: #ffebee;
  opacity: 0.7;
}

.node-icon {
  font-size: 24px;
  text-align: center;
  margin-bottom: 5px;
}

.node-name {
  font-size: 14px;
  font-weight: 500;
  text-align: center;
  word-break: break-word;
}

.node-annotation {
  font-size: 11px;
  color: #666;
  text-align: center;
  margin-top: 5px;
  font-style: italic;
}

.canvas-legend {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40px;
  background: white;
  border-top: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 2px solid;
}

.legend-color.added {
  background: #e8f5e9;
  border-color: #4caf50;
}

.legend-color.modified {
  background: #fff3e0;
  border-color: #ff9800;
}

.legend-color.deleted {
  background: #ffebee;
  border-color: #f44336;
}
</style>