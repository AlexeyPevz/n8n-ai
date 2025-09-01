<template>
  <div class="workflow-canvas" ref="canvasContainer">
    <!-- Canvas Background -->
    <svg
      ref="svgCanvas"
      class="workflow-svg"
      :width="canvasSize.width"
      :height="canvasSize.height"
      @mousedown="handleCanvasMouseDown"
      @mousemove="handleCanvasMouseMove"
      @mouseup="handleCanvasMouseUp"
      @wheel="handleWheel"
    >
      <!-- Grid Pattern -->
      <defs>
        <pattern
          id="grid"
          :width="gridSize"
          :height="gridSize"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1" r="1" fill="#e1e1e1" />
        </pattern>
      </defs>
      
      <!-- Background -->
      <rect
        width="100%"
        height="100%"
        fill="#fbfbfb"
      />
      <rect
        width="100%"
        height="100%"
        fill="url(#grid)"
        :transform="`translate(${pan.x % gridSize}, ${pan.y % gridSize})`"
      />
      
      <!-- Connections -->
      <g class="connections-layer">
        <WorkflowConnection
          v-for="connection in connections"
          :key="`${connection.from}-${connection.to}`"
          :connection="connection"
          :fromNode="getNode(connection.from)"
          :toNode="getNode(connection.to)"
          :zoom="zoom"
          @delete="deleteConnection"
        />
        
        <!-- Temporary connection while dragging -->
        <path
          v-if="dragConnection"
          class="connection-temp"
          :d="tempConnectionPath"
          fill="none"
          stroke="#ff6d5a"
          stroke-width="2"
          stroke-dasharray="5,5"
        />
      </g>
      
      <!-- Nodes -->
      <g class="nodes-layer" :transform="`translate(${pan.x}, ${pan.y}) scale(${zoom})`">
        <WorkflowNode
          v-for="node in nodes"
          :key="node.id"
          :node="node"
          :selected="selectedNodes.includes(node.id)"
          :zoom="zoom"
          @mousedown="handleNodeMouseDown($event, node)"
          @connection-start="handleConnectionStart"
          @connection-end="handleConnectionEnd"
          @delete="deleteNode"
          @duplicate="duplicateNode"
          @configure="configureNode"
        />
      </g>
    </svg>
    
    <!-- Controls -->
    <div class="canvas-controls">
      <div class="zoom-controls">
        <button @click="zoomIn" class="control-btn" title="Zoom In">
          <IconPlus />
        </button>
        <span class="zoom-level">{{ Math.round(zoom * 100) }}%</span>
        <button @click="zoomOut" class="control-btn" title="Zoom Out">
          <IconMinus />
        </button>
        <button @click="fitToScreen" class="control-btn" title="Fit to Screen">
          <IconExpand />
        </button>
      </div>
    </div>
    
    <!-- Node Palette -->
    <NodePalette
      :visible="showPalette"
      :position="palettePosition"
      @select="addNodeFromPalette"
      @close="showPalette = false"
    />
    
    <!-- Context Menu -->
    <ContextMenu
      v-if="showContextMenu"
      :position="contextMenuPosition"
      :items="contextMenuItems"
      @select="handleContextMenuSelect"
      @close="showContextMenu = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useWorkflowStore } from '@/stores/workflow';
import WorkflowNode from './WorkflowNode.vue';
import WorkflowConnection from './WorkflowConnection.vue';
import NodePalette from './NodePalette.vue';
import ContextMenu from './ContextMenu.vue';
import IconPlus from '../icons/IconPlus.vue';
import IconMinus from '../icons/IconMinus.vue';
import IconExpand from '../icons/IconExpand.vue';

interface Node {
  id: string;
  name: string;
  type: string;
  position: [number, number];
  parameters?: Record<string, any>;
}

interface Connection {
  from: string;
  to: string;
  fromIndex?: number;
  toIndex?: number;
}

const workflowStore = useWorkflowStore();

// Canvas state
const canvasContainer = ref<HTMLElement>();
const svgCanvas = ref<SVGElement>();
const canvasSize = ref({ width: 1920, height: 1080 });
const gridSize = 20;

// View state
const zoom = ref(1);
const pan = ref({ x: 0, y: 0 });
const isPanning = ref(false);
const panStart = ref({ x: 0, y: 0 });

// Nodes and connections
const nodes = computed(() => workflowStore.nodes);
const connections = computed(() => workflowStore.connections);
const selectedNodes = ref<string[]>([]);

// Drag state
const isDraggingNode = ref(false);
const draggedNode = ref<Node | null>(null);
const dragOffset = ref({ x: 0, y: 0 });

// Connection state
const dragConnection = ref<{ from: string; fromIndex: number } | null>(null);
const mousePosition = ref({ x: 0, y: 0 });

// UI state
const showPalette = ref(false);
const palettePosition = ref({ x: 0, y: 0 });
const showContextMenu = ref(false);
const contextMenuPosition = ref({ x: 0, y: 0 });
const contextMenuItems = ref<any[]>([]);

// Canvas mouse handlers
function handleCanvasMouseDown(event: MouseEvent) {
  if (event.button === 0 && !isDraggingNode.value) {
    // Left click - start panning
    isPanning.value = true;
    panStart.value = {
      x: event.clientX - pan.value.x,
      y: event.clientY - pan.value.y,
    };
    selectedNodes.value = [];
  } else if (event.button === 2) {
    // Right click - show context menu
    event.preventDefault();
    const rect = svgCanvas.value!.getBoundingClientRect();
    const x = (event.clientX - rect.left - pan.value.x) / zoom.value;
    const y = (event.clientY - rect.top - pan.value.y) / zoom.value;
    
    showContextMenu.value = true;
    contextMenuPosition.value = { x: event.clientX, y: event.clientY };
    contextMenuItems.value = [
      { label: 'Add Node', icon: 'plus', action: 'add-node', data: { x, y } },
      { type: 'separator' },
      { label: 'Paste', icon: 'clipboard', action: 'paste', disabled: !hasClipboard() },
      { type: 'separator' },
      { label: 'Select All', icon: 'select-all', action: 'select-all' },
      { label: 'Zoom to Fit', icon: 'expand', action: 'fit-to-screen' },
    ];
  }
}

function handleCanvasMouseMove(event: MouseEvent) {
  const rect = svgCanvas.value!.getBoundingClientRect();
  mousePosition.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
  
  if (isPanning.value) {
    pan.value = {
      x: event.clientX - panStart.value.x,
      y: event.clientY - panStart.value.y,
    };
  } else if (isDraggingNode.value && draggedNode.value) {
    const x = (event.clientX - rect.left - pan.value.x) / zoom.value - dragOffset.value.x;
    const y = (event.clientY - rect.top - pan.value.y) / zoom.value - dragOffset.value.y;
    
    // Snap to grid
    const snappedX = Math.round(x / gridSize) * gridSize;
    const snappedY = Math.round(y / gridSize) * gridSize;
    
    workflowStore.updateNodePosition(draggedNode.value.id, [snappedX, snappedY]);
  }
}

function handleCanvasMouseUp(event: MouseEvent) {
  isPanning.value = false;
  isDraggingNode.value = false;
  draggedNode.value = null;
  
  if (dragConnection.value) {
    // Connection was not completed
    dragConnection.value = null;
  }
}

// Node handlers
function handleNodeMouseDown(event: MouseEvent, node: Node) {
  event.stopPropagation();
  
  if (event.button === 0) {
    isDraggingNode.value = true;
    draggedNode.value = node;
    
    const rect = svgCanvas.value!.getBoundingClientRect();
    dragOffset.value = {
      x: (event.clientX - rect.left - pan.value.x) / zoom.value - node.position[0],
      y: (event.clientY - rect.top - pan.value.y) / zoom.value - node.position[1],
    };
    
    // Select node
    if (event.ctrlKey || event.metaKey) {
      if (selectedNodes.value.includes(node.id)) {
        selectedNodes.value = selectedNodes.value.filter(id => id !== node.id);
      } else {
        selectedNodes.value.push(node.id);
      }
    } else {
      selectedNodes.value = [node.id];
    }
  } else if (event.button === 2) {
    event.preventDefault();
    showNodeContextMenu(node, event);
  }
}

// Connection handlers
function handleConnectionStart(data: { nodeId: string; index: number }) {
  dragConnection.value = { from: data.nodeId, fromIndex: data.index };
}

function handleConnectionEnd(data: { nodeId: string; index: number }) {
  if (dragConnection.value && dragConnection.value.from !== data.nodeId) {
    workflowStore.addConnection({
      from: dragConnection.value.from,
      to: data.nodeId,
      fromIndex: dragConnection.value.fromIndex,
      toIndex: data.index,
    });
  }
  dragConnection.value = null;
}

// Zoom handlers
function handleWheel(event: WheelEvent) {
  event.preventDefault();
  
  const delta = event.deltaY > 0 ? 0.9 : 1.1;
  const newZoom = Math.max(0.1, Math.min(3, zoom.value * delta));
  
  // Zoom towards mouse position
  const rect = svgCanvas.value!.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;
  
  const worldX = (mouseX - pan.value.x) / zoom.value;
  const worldY = (mouseY - pan.value.y) / zoom.value;
  
  zoom.value = newZoom;
  
  pan.value = {
    x: mouseX - worldX * newZoom,
    y: mouseY - worldY * newZoom,
  };
}

function zoomIn() {
  zoom.value = Math.min(3, zoom.value * 1.2);
}

function zoomOut() {
  zoom.value = Math.max(0.1, zoom.value / 1.2);
}

function fitToScreen() {
  if (nodes.value.length === 0) return;
  
  const bounds = calculateNodeBounds();
  const padding = 100;
  
  const scaleX = (canvasSize.value.width - padding * 2) / bounds.width;
  const scaleY = (canvasSize.value.height - padding * 2) / bounds.height;
  
  zoom.value = Math.min(1, Math.min(scaleX, scaleY));
  pan.value = {
    x: padding - bounds.minX * zoom.value,
    y: padding - bounds.minY * zoom.value,
  };
}

// Computed properties
const tempConnectionPath = computed(() => {
  if (!dragConnection.value) return '';
  
  const fromNode = getNode(dragConnection.value.from);
  if (!fromNode) return '';
  
  const fromX = fromNode.position[0] + 280; // Node width
  const fromY = fromNode.position[1] + 40; // Approximate output position
  
  const toX = (mousePosition.value.x - pan.value.x) / zoom.value;
  const toY = (mousePosition.value.y - pan.value.y) / zoom.value;
  
  return createConnectionPath(fromX, fromY, toX, toY);
});

// Helper functions
function getNode(id: string): Node | undefined {
  return nodes.value.find(n => n.id === id);
}

function createConnectionPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.abs(x2 - x1);
  const cp1x = x1 + dx * 0.5;
  const cp2x = x2 - dx * 0.5;
  
  return `M ${x1} ${y1} C ${cp1x} ${y1}, ${cp2x} ${y2}, ${x2} ${y2}`;
}

function calculateNodeBounds() {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  for (const node of nodes.value) {
    minX = Math.min(minX, node.position[0]);
    minY = Math.min(minY, node.position[1]);
    maxX = Math.max(maxX, node.position[0] + 280);
    maxY = Math.max(maxY, node.position[1] + 80);
  }
  
  return {
    minX, minY, maxX, maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function deleteNode(nodeId: string) {
  workflowStore.deleteNode(nodeId);
}

function duplicateNode(nodeId: string) {
  const node = getNode(nodeId);
  if (node) {
    workflowStore.duplicateNode(nodeId);
  }
}

function configureNode(nodeId: string) {
  // Emit event to parent to show configuration dialog
  emit('configure-node', nodeId);
}

function deleteConnection(connection: Connection) {
  workflowStore.deleteConnection(connection);
}

function addNodeFromPalette(nodeType: string) {
  const position = palettePosition.value;
  workflowStore.addNode({
    type: nodeType,
    position: [position.x, position.y],
  });
  showPalette.value = false;
}

function showNodeContextMenu(node: Node, event: MouseEvent) {
  showContextMenu.value = true;
  contextMenuPosition.value = { x: event.clientX, y: event.clientY };
  contextMenuItems.value = [
    { label: 'Configure', icon: 'cog', action: 'configure', data: node },
    { label: 'Duplicate', icon: 'copy', action: 'duplicate', data: node },
    { type: 'separator' },
    { label: 'Copy', icon: 'clipboard', action: 'copy', data: node },
    { label: 'Cut', icon: 'cut', action: 'cut', data: node },
    { type: 'separator' },
    { label: 'Delete', icon: 'trash', action: 'delete', data: node, danger: true },
  ];
}

function handleContextMenuSelect(item: any) {
  switch (item.action) {
    case 'add-node':
      palettePosition.value = item.data;
      showPalette.value = true;
      break;
    case 'configure':
      configureNode(item.data.id);
      break;
    case 'duplicate':
      duplicateNode(item.data.id);
      break;
    case 'delete':
      deleteNode(item.data.id);
      break;
    case 'fit-to-screen':
      fitToScreen();
      break;
    // ... other actions
  }
  showContextMenu.value = false;
}

function hasClipboard(): boolean {
  // Check if there's something in clipboard
  return false; // Implement clipboard logic
}

// Lifecycle
onMounted(() => {
  // Prevent context menu
  canvasContainer.value?.addEventListener('contextmenu', e => e.preventDefault());
  
  // Update canvas size
  const updateCanvasSize = () => {
    if (canvasContainer.value) {
      canvasSize.value = {
        width: canvasContainer.value.offsetWidth,
        height: canvasContainer.value.offsetHeight,
      };
    }
  };
  
  updateCanvasSize();
  window.addEventListener('resize', updateCanvasSize);
  
  onUnmounted(() => {
    window.removeEventListener('resize', updateCanvasSize);
  });
});

// Emits
const emit = defineEmits(['configure-node']);
</script>

<style scoped>
.workflow-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #f5f5f5;
}

.workflow-svg {
  cursor: grab;
  user-select: none;
}

.workflow-svg:active {
  cursor: grabbing;
}

/* Canvas Controls */
.canvas-controls {
  position: absolute;
  bottom: 20px;
  left: 20px;
  display: flex;
  gap: 10px;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  background: white;
  border-radius: 4px;
  padding: 5px 10px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #666;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.control-btn:hover {
  background: #f0f0f0;
  color: #333;
}

.zoom-level {
  font-size: 14px;
  color: #666;
  min-width: 50px;
  text-align: center;
}

/* Connection styles */
.connection-temp {
  pointer-events: none;
}

/* Prevent text selection */
.workflow-canvas * {
  user-select: none;
  -webkit-user-select: none;
}
</style>