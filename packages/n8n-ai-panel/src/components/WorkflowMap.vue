<template>
  <div class="workflow-map-container">
    <!-- Header -->
    <div class="map-header">
      <h2>Workflow Dependencies Map</h2>
      <div class="map-controls">
        <input class="search-input" v-model="searchTerm" placeholder="Search workflows" />
        <button class="filter-active" @click="toggleActiveFilter">Active Only</button>
        <button class="clear-filters" @click="clearFilters">Clear</button>
        <button class="layout-button" @click="setLayout('hierarchical')">Hierarchical</button>
        <button class="layout-button" @click="setLayout('force')">Force</button>
        <button class="layout-button" @click="setLayout('grid')">Grid</button>
        <button class="zoom-in" @click="zoomIn">+</button>
        <button class="zoom-out" @click="zoomOut">-</button>
        <button class="fit-to-screen" @click="fitToScreen">Fit</button>
        <button @click="refreshMap" :disabled="isLoading" class="btn-refresh refresh-button" :class="{ refreshing: isRefreshing }">
          <span v-if="!isLoading">🔄 Refresh</span>
          <span v-else>⏳ Loading...</span>
        </button>
        <select v-model="viewDepth" @change="updateMap" class="depth-selector">
          <option value="1">Depth: 1</option>
          <option value="2">Depth: 2</option>
          <option value="3">Depth: 3</option>
          <option value="4">Depth: 4</option>
          <option value="5">Depth: 5</option>
        </select>
        <label class="checkbox-label">
          <input type="checkbox" v-model="showExternal" @change="updateMap">
          Show External
        </label>
      </div>
    </div>

    <!-- Loading / Error / Empty states -->
    <div v-if="isLoading" class="loading-container">Loading workflow map...</div>
    <div v-if="errorMessage" class="error-state">Failed to load workflow map</div>
    <div v-if="!isLoading && !errorMessage && uiWorkflows.length === 0" class="empty-state">No workflows found</div>

    <!-- Statistics -->
    <div class="map-stats stats-panel" v-if="stats">
      <div class="stat-item">
        <span class="stat-label">Workflows:</span>
        <span class="stat-value">{{ stats.totalWorkflows }} workflows</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Connections:</span>
        <span class="stat-value">{{ stats.totalConnections }} connection</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Active:</span>
        <span class="stat-value">{{ stats.activeWorkflows }} active</span>
      </div>
    </div>

    <!-- Map Visualization -->
    <div class="map-visualization" ref="mapContainer">
      <svg ref="svgElement" width="100%" height="100%">
        <defs>
          <!-- Arrow marker for edges -->
          <marker 
            id="arrowhead" 
            markerWidth="10" 
            markerHeight="7" 
            refX="10" 
            refY="3.5" 
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
          </marker>
          
          <!-- Patterns for node types -->
          <pattern id="webhook-pattern" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="4" height="4" fill="#f8f8f8" />
            <path d="M 0,4 l 4,-4 M -1,1 l 2,-2 M 3,5 l 2,-2" stroke="#ddd" stroke-width="1" />
          </pattern>
        </defs>

        <!-- Pan/Zoom container -->
        <g :transform="viewTransform">
          <!-- Edges -->
          <g class="edges">
            <path
              v-for="edge in edges"
              :key="`${edge.source}-${edge.target}`"
              :d="getEdgePath(edge)"
              :stroke="getEdgeColor(edge)"
              :stroke-width="getEdgeWidth(edge)"
              :stroke-dasharray="edge.type === 'http_webhook' ? '5,5' : ''"
              fill="none"
              marker-end="url(#arrowhead)"
              :opacity="getEdgeOpacity(edge)"
              @mouseover="handleEdgeHover(edge, $event)"
              @mouseout="hideTooltip"
              style="cursor: pointer"
            />
          </g>

          <!-- Nodes -->
          <g class="nodes">
            <g
              v-for="node in nodes"
              :key="node.id"
              :transform="`translate(${node.x}, ${node.y})`"
              @click="handleNodeClick(node)"
              @mouseover="handleNodeHover(node, $event)"
              @mouseout="hideTooltip"
              style="cursor: pointer"
            >
              <!-- Node background -->
              <rect
                x="-60"
                y="-25"
                width="120"
                height="50"
                rx="8"
                :fill="getNodeFill(node)"
                :stroke="getNodeStroke(node)"
                stroke-width="2"
                :class="getNodeClass(node)"
              />
              
              <!-- Node icon -->
              <text
                x="-40"
                y="5"
                font-size="20"
                text-anchor="middle"
              >
                {{ getNodeIcon(node) }}
              </text>
              
              <!-- Node label -->
              <text
                x="10"
                y="0"
                font-size="12"
                text-anchor="middle"
                fill="#333"
              >
                {{ truncateLabel(node.name, 15) }}
              </text>
              
              <!-- Status indicator -->
              <circle
                v-if="node.status"
                cx="50"
                cy="-15"
                r="6"
                :fill="getStatusColor(node.status)"
                :class="{ 'status-pulse': node.status === 'running' }"
              />
            </g>
          </g>
        </g>
      </svg>
    </div>

    <!-- Tooltip -->
    <div
      v-if="tooltip.visible"
      class="map-tooltip"
      :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
    >
      <div class="tooltip-content">
        <h4>{{ tooltip.title }}</h4>
        <div v-for="(value, key) in tooltip.details" :key="key" class="tooltip-item">
          <span class="tooltip-label">{{ key }}:</span>
          <span class="tooltip-value">{{ value }}</span>
        </div>
      </div>
    </div>

    <!-- WebSocket Status -->
    <div class="ws-status" :class="{ 'ws-connected': wsConnected }">
      <span class="ws-indicator"></span>
      <span>{{ wsConnected ? 'Live' : 'Offline' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import axios from 'axios';
import type { MapNode, MapEdge, MapData } from '../types/workflow-map';
import { useWorkflowMap } from '../composables/useWorkflowMap';

// Types moved to ../types/workflow-map

// State
const { isLoading, mapData, nodes, edges, fetchMap } = useWorkflowMap();
const viewDepth = ref(2);
const showExternal = ref(false);
const searchTerm = ref('');
const onlyActive = ref(false);
const isRefreshing = ref(false);
const selectedWorkflowId = ref<string | null>(null);
const stats = computed(() => {
  if (!mapData.value) return null as any;
  return {
    totalWorkflows: (mapData.value as any).stats?.totalWorkflows ?? (mapData.value as any).workflows?.length ?? 0,
    activeWorkflows: (mapData.value as any).stats?.activeWorkflows ?? 0,
    totalConnections: (mapData.value as any).stats?.totalConnections ?? (mapData.value as any).dependencies?.length ?? 0,
  };
});
const uiWorkflows = computed(() => (mapData.value as any)?.workflows ?? []);
const uiDependencies = computed(() => (mapData.value as any)?.dependencies ?? []);
const visibleWorkflows = computed(() => uiWorkflows.value.map((w: any) => ({
  ...w,
  hidden: (onlyActive.value && !w.active) || (searchTerm.value && !w.name.toLowerCase().includes(searchTerm.value.toLowerCase())),
  highlighted: false,
})));
const selectedWorkflow = computed(() => uiWorkflows.value.find((w: any) => w.id === selectedWorkflowId.value));
const errorMessage = ref('');
const svgElement = ref<SVGElement>();
const mapContainer = ref<HTMLElement>();

// WebSocket
const wsConnected = ref(false);
let ws: WebSocket | null = null;

// Visualization state
const viewTransform = ref('translate(0,0) scale(1)');
const tooltip = ref({
  visible: false,
  x: 0,
  y: 0,
  title: '',
  details: {} as Record<string, any>,
});

// Pan & Zoom
let isPanning = false;
let startX = 0;
let startY = 0;
let currentTranslate = { x: 0, y: 0 };
let currentScale = 1;

// Methods
async function refreshMap() {
  try {
    isRefreshing.value = true;
    try { await fetch('/workflow-map/refresh', { method: 'POST' }); } catch {}
    const data = await fetchMap({ depth: viewDepth.value, includeExternal: showExternal.value });
    if (data && Array.isArray(data.nodes) && Array.isArray(data.edges)) {
      layoutGraph(data);
    } else {
      // Fallback to empty state if API shape is unexpected
      nodes.value = [];
      edges.value = [];
    }
    // Copy to UI overlay
    (mapData as any).value = data as any;
  } catch (error) {
    console.error('Failed to load workflow map:', error);
    errorMessage.value = 'failed';
  } finally {
    isRefreshing.value = false;
  }
}

function updateMap() {
  refreshMap();
}

function toggleActiveFilter() {
  onlyActive.value = !onlyActive.value;
}
function clearFilters() {
  searchTerm.value = '';
  onlyActive.value = false;
}
function setLayout(_mode: string) {}
function zoomIn() { currentScale = Math.min(5, currentScale * 1.1); updateViewTransform(); }
function zoomOut() { currentScale = Math.max(0.1, currentScale * 0.9); updateViewTransform(); }
function fitToScreen() { currentScale = 1; currentTranslate = { x: 0, y: 0 }; updateViewTransform(); }
function selectWorkflow(id: string) { selectedWorkflowId.value = id; }
function highlightConnections(id: string) {
  // mark dependent nodes
}
function clearHighlights() {}
function openWorkflow(id: string) { window.open(`/workflow/${id}`, '_blank'); }

function layoutGraph(data: MapData) {
  // Simple force-directed layout
  const nodeMap = new Map<string, MapNode>();
  const layoutNodes: MapNode[] = [];
  
  // Initialize nodes with positions
  (data.nodes || []).forEach((node, index) => {
    const angle = (index / data.nodes.length) * 2 * Math.PI;
    const radius = 300;
    const layoutNode = {
      ...node,
      x: Math.cos(angle) * radius + 400,
      y: Math.sin(angle) * radius + 300,
    };
    nodeMap.set(node.id, layoutNode);
    layoutNodes.push(layoutNode);
  });
  
  // Simple force simulation (simplified)
  for (let i = 0; i < 50; i++) {
    // Repulsion between nodes
    for (let j = 0; j < layoutNodes.length; j++) {
      for (let k = j + 1; k < layoutNodes.length; k++) {
        const node1 = layoutNodes[j];
        const node2 = layoutNodes[k];
        const dx = node2.x! - node1.x!;
        const dy = node2.y! - node1.y!;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 150) {
          const force = (150 - distance) / distance * 0.5;
          node1.x! -= dx * force;
          node1.y! -= dy * force;
          node2.x! += dx * force;
          node2.y! += dy * force;
        }
      }
    }
    
    // Attraction along edges
    (data.edges || []).forEach(edge => {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (source && target) {
        const dx = target.x! - source.x!;
        const dy = target.y! - source.y!;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const force = (distance - 200) / distance * 0.1;
        source.x! += dx * force;
        source.y! += dy * force;
        target.x! -= dx * force;
        target.y! -= dy * force;
      }
    });
  }
  
  nodes.value = layoutNodes;
  edges.value = data.edges;
}

function getEdgePath(edge: MapEdge): string {
  const source = nodes.value.find(n => n.id === edge.source);
  const target = nodes.value.find(n => n.id === edge.target);
  
  if (!source || !target) return '';
  
  const sx = source.x!;
  const sy = source.y!;
  const tx = target.x!;
  const ty = target.y!;
  
  // Calculate control points for curved edge
  const dx = tx - sx;
  const dy = ty - sy;
  const dr = Math.sqrt(dx * dx + dy * dy);
  
  return `M ${sx} ${sy} Q ${sx + dx/2} ${sy + dy/2 - dr/4} ${tx} ${ty}`;
}

function getNodeIcon(node: MapNode): string {
  switch (node.type) {
    case 'workflow': return '📋';
    case 'webhook': return '🔗';
    case 'external': return '🌐';
    default: return '❓';
  }
}

function getNodeFill(node: MapNode): string {
  switch (node.type) {
    case 'workflow': return '#fff';
    case 'webhook': return 'url(#webhook-pattern)';
    case 'external': return '#f0f0f0';
    default: return '#fff';
  }
}

function getNodeStroke(node: MapNode): string {
  if (node.status === 'running') return '#ff6d5a';
  if (node.status === 'error') return '#ff3333';
  if (node.status === 'success') return '#7fb069';
  
  switch (node.type) {
    case 'workflow': return '#4a90e2';
    case 'webhook': return '#f39c12';
    case 'external': return '#95a5a6';
    default: return '#ddd';
  }
}

function getNodeClass(node: MapNode): string {
  const classes = ['map-node'];
  if (node.status === 'running') classes.push('node-running');
  if (node.type === 'external') classes.push('node-external');
  return classes.join(' ');
}

function getEdgeColor(edge: MapEdge): string {
  if (edge.type === 'execute_workflow') return '#4a90e2';
  if (edge.type === 'http_webhook') return '#f39c12';
  if (edge.type === 'trigger_webhook') return '#27ae60';
  return '#666';
}

function getEdgeWidth(edge: MapEdge): number {
  if (edge.probability && edge.probability < 0.7) return 1;
  return 2;
}

function getEdgeOpacity(edge: MapEdge): number {
  if (edge.probability) return Math.max(0.3, edge.probability);
  return 0.8;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'running': return '#ff6d5a';
    case 'success': return '#7fb069';
    case 'error': return '#ff3333';
    case 'waiting': return '#f39c12';
    default: return '#999';
  }
}

function truncateLabel(label: string, maxLength: number): string {
  if (label.length <= maxLength) return label;
  return label.substring(0, maxLength - 3) + '...';
}

function formatPercentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function handleNodeClick(node: MapNode) {
  // Node click handler placeholder
  // TODO: Navigate to workflow or show details
}

function handleNodeHover(node: MapNode, event: MouseEvent) {
  const details: Record<string, any> = {
    Type: node.type,
    ID: node.id,
  };
  
  if (node.metadata) {
    Object.assign(details, node.metadata);
  }
  
  if (node.status) {
    details.Status = node.status;
  }
  
  showTooltip(node.name, details, event);
}

function handleEdgeHover(edge: MapEdge, event: MouseEvent) {
  const details: Record<string, any> = {
    Type: edge.type,
    From: edge.source,
    To: edge.target,
  };
  
  if (edge.probability) {
    details.Confidence = formatPercentage(edge.probability);
  }
  
  if (edge.metadata) {
    Object.assign(details, edge.metadata);
  }
  
  showTooltip('Connection', details, event);
}

function showTooltip(title: string, details: Record<string, any>, event: MouseEvent) {
  const rect = mapContainer.value!.getBoundingClientRect();
  tooltip.value = {
    visible: true,
    x: event.clientX - rect.left + 10,
    y: event.clientY - rect.top + 10,
    title,
    details,
  };
}

function hideTooltip() {
  tooltip.value.visible = false;
}

// WebSocket connection
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/api/v1/ai/live`;
  
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    // WebSocket connected
    wsConnected.value = true;
    
    // Subscribe to all workflows in the current map
    if (nodes.value.length > 0) {
      const workflowIds = nodes.value
        .filter(n => n.type === 'workflow')
        .map(n => n.id);
      
      ws!.send(JSON.stringify({
        type: 'subscribe',
        workflowIds,
      }));
    }
  };
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleWebSocketMessage(message);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  ws.onclose = () => {
    // WebSocket disconnected
    wsConnected.value = false;
    
    // Reconnect after 5 seconds
    setTimeout(connectWebSocket, 5000);
  };
}

function handleWebSocketMessage(message: any) {
  switch (message.type) {
    case 'workflow_status':
    case 'execution_status':
      updateNodeStatus(message.workflowId, message.status);
      break;
    case 'execution_progress':
      // Update overlay data
      break;
    case 'cost_update':
      // Update overlay data
      break;
    case 'stats_update':
      if (mapData.value) {
        (mapData.value as any).stats = { ...((mapData.value as any).stats || {}), ...message.stats };
      }
      break;
      
    case 'node_status':
      // Could show node-level status in the future
      break;
      
    case 'cost_update':
      // Could show cost information
      break;
      
    case 'connection_status':
      // Could animate connections
      break;
  }
}

function updateNodeStatus(workflowId: string, status: string) {
  const node = nodes.value.find(n => n.id === workflowId);
  if (node) {
    node.status = status as any;
  }
}

// Pan & Zoom handlers
function handleWheel(event: WheelEvent) {
  event.preventDefault();
  
  const scaleDelta = event.deltaY > 0 ? 0.9 : 1.1;
  const newScale = currentScale * scaleDelta;
  
  if (newScale >= 0.1 && newScale <= 5) {
    currentScale = newScale;
    updateViewTransform();
  }
}

function handleMouseDown(event: MouseEvent) {
  if (event.button === 0) { // Left button
    isPanning = true;
    startX = event.clientX;
    startY = event.clientY;
  }
}

function handleMouseMove(event: MouseEvent) {
  if (isPanning) {
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    
    currentTranslate.x += dx;
    currentTranslate.y += dy;
    
    startX = event.clientX;
    startY = event.clientY;
    
    updateViewTransform();
  }
}

function handleMouseUp() {
  isPanning = false;
}

function updateViewTransform() {
  viewTransform.value = `translate(${currentTranslate.x},${currentTranslate.y}) scale(${currentScale})`;
}

// Lifecycle
onMounted(() => {
  isLoading.value = true;
  refreshMap().finally(() => { isLoading.value = false; });
  connectWebSocket();
  
  // Add pan & zoom listeners
  if (mapContainer.value) {
    mapContainer.value.addEventListener('wheel', handleWheel);
    mapContainer.value.addEventListener('mousedown', handleMouseDown);
    mapContainer.value.addEventListener('mousemove', handleMouseMove);
    mapContainer.value.addEventListener('mouseup', handleMouseUp);
    mapContainer.value.addEventListener('mouseleave', handleMouseUp);
  }
});

onUnmounted(() => {
  if (ws) {
    ws.close();
  }
  
  // Remove pan & zoom listeners
  if (mapContainer.value) {
    mapContainer.value.removeEventListener('wheel', handleWheel);
    mapContainer.value.removeEventListener('mousedown', handleMouseDown);
    mapContainer.value.removeEventListener('mousemove', handleMouseMove);
    mapContainer.value.removeEventListener('mouseup', handleMouseUp);
    mapContainer.value.removeEventListener('mouseleave', handleMouseUp);
  }
});
</script>

<style scoped>
.workflow-map-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
  position: relative;
}

.map-header {
  background: white;
  border-bottom: 1px solid #ddd;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.map-header h2 {
  margin: 0;
  font-size: 20px;
  color: #333;
}

.map-controls {
  display: flex;
  gap: 16px;
  align-items: center;
}

.btn-refresh {
  padding: 8px 16px;
  background: #4a90e2;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.btn-refresh:hover:not(:disabled) {
  background: #357abd;
}

.btn-refresh:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.depth-selector {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #666;
}

.map-stats {
  background: white;
  border-bottom: 1px solid #ddd;
  padding: 12px 24px;
  display: flex;
  gap: 32px;
}

.stat-item {
  display: flex;
  gap: 8px;
  align-items: center;
}

.stat-label {
  color: #666;
  font-size: 14px;
}

.stat-value {
  color: #333;
  font-weight: 600;
  font-size: 16px;
}

.map-visualization {
  flex: 1;
  position: relative;
  overflow: hidden;
  cursor: grab;
}

.map-visualization:active {
  cursor: grabbing;
}

.map-node {
  transition: all 0.2s;
}

.map-node:hover {
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
}

.node-running rect {
  animation: pulse 1.5s infinite;
}

.node-external {
  opacity: 0.7;
}

@keyframes pulse {
  0% { filter: drop-shadow(0 0 0 rgba(255, 109, 90, 0.4)); }
  50% { filter: drop-shadow(0 0 10px rgba(255, 109, 90, 0.6)); }
  100% { filter: drop-shadow(0 0 0 rgba(255, 109, 90, 0.4)); }
}

.status-pulse {
  animation: status-pulse 1s infinite;
}

@keyframes status-pulse {
  0% { r: 6; opacity: 1; }
  50% { r: 8; opacity: 0.7; }
  100% { r: 6; opacity: 1; }
}

.map-tooltip {
  position: absolute;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 12px;
  border-radius: 6px;
  pointer-events: none;
  z-index: 1000;
  max-width: 300px;
}

.tooltip-content h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
}

.tooltip-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  margin: 4px 0;
}

.tooltip-label {
  color: #aaa;
}

.tooltip-value {
  color: white;
  text-align: right;
}

.ws-status {
  position: absolute;
  bottom: 16px;
  right: 16px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.ws-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ff3333;
}

.ws-connected .ws-indicator {
  background: #7fb069;
}
</style>