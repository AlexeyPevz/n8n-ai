<template>
  <div class="workflow-minimap">
    <svg
      ref="svgElement"
      :viewBox="`0 0 ${viewBox.width} ${viewBox.height}`"
      class="minimap-svg"
    >
      <!-- Connections -->
      <g class="connections">
        <path
          v-for="(connection, index) in connections"
          :key="`conn-${index}`"
          :d="getConnectionPath(connection)"
          class="connection-path"
          fill="none"
          stroke="#999"
          stroke-width="2"
        />
      </g>
      
      <!-- Nodes -->
      <g class="nodes">
        <g
          v-for="node in nodes"
          :key="node.id"
          :transform="`translate(${node.position[0]}, ${node.position[1]})`"
          class="minimap-node"
        >
          <rect
            x="-40"
            y="-20"
            width="80"
            height="40"
            rx="4"
            :fill="getNodeColor(node.type)"
            opacity="0.9"
          />
          <text
            x="0"
            y="5"
            text-anchor="middle"
            fill="white"
            font-size="12"
            font-weight="500"
          >
            {{ getNodeLabel(node) }}
          </text>
        </g>
      </g>
      
      <!-- Start/End indicators -->
      <g class="indicators">
        <g v-if="nodes.length > 0" :transform="`translate(${nodes[0].position[0]}, ${nodes[0].position[1] - 40})`">
          <rect x="-30" y="-15" width="60" height="25" rx="12" fill="#7fb069" />
          <text x="0" y="2" text-anchor="middle" fill="white" font-size="11" font-weight="bold">
            START
          </text>
        </g>
        
        <g v-if="nodes.length > 0" :transform="`translate(${nodes[nodes.length - 1].position[0]}, ${nodes[nodes.length - 1].position[1] + 40})`">
          <rect x="-25" y="-10" width="50" height="25" rx="12" fill="#ff6d5a" />
          <text x="0" y="5" text-anchor="middle" fill="white" font-size="11" font-weight="bold">
            END
          </text>
        </g>
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

interface Node {
  id: string;
  name: string;
  type: string;
  position: [number, number];
}

interface Connection {
  from: string;
  to: string;
}

const props = defineProps<{
  nodes: Node[];
  connections: Connection[];
}>();

const svgElement = ref<SVGElement>();

// Calculate viewBox to fit all nodes
const viewBox = computed(() => {
  if (props.nodes.length === 0) {
    return { width: 800, height: 400 };
  }
  
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  props.nodes.forEach(node => {
    minX = Math.min(minX, node.position[0] - 100);
    minY = Math.min(minY, node.position[1] - 100);
    maxX = Math.max(maxX, node.position[0] + 100);
    maxY = Math.max(maxY, node.position[1] + 100);
  });
  
  return {
    width: maxX - minX,
    height: maxY - minY,
  };
});

// Get node by ID
function getNodeById(id: string): Node | undefined {
  return props.nodes.find(n => n.id === id);
}

// Get connection path
function getConnectionPath(connection: Connection): string {
  const fromNode = getNodeById(connection.from);
  const toNode = getNodeById(connection.to);
  
  if (!fromNode || !toNode) return '';
  
  const x1 = fromNode.position[0];
  const y1 = fromNode.position[1] + 20;
  const x2 = toNode.position[0];
  const y2 = toNode.position[1] - 20;
  
  const cp1x = x1;
  const cp1y = y1 + 40;
  const cp2x = x2;
  const cp2y = y2 - 40;
  
  return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
}

// Get node color based on type
function getNodeColor(type: string): string {
  const typeColors: Record<string, string> = {
    'webhook': '#ff6d5a',
    'http': '#ff6d5a',
    'email': '#ea4335',
    'slack': '#4a154b',
    'sheets': '#0f9d58',
    'database': '#336791',
    'transform': '#5fa3d3',
    'ai': '#b47cff',
  };
  
  const typeKey = type.toLowerCase().split('.').pop() || '';
  
  for (const [key, color] of Object.entries(typeColors)) {
    if (typeKey.includes(key)) {
      return color;
    }
  }
  
  return '#757575';
}

// Get short label for node
function getNodeLabel(node: Node): string {
  const typeLabel = node.type.split('.').pop()?.replace(/([A-Z])/g, ' $1').trim() || '';
  
  if (typeLabel.length > 10) {
    return typeLabel.substring(0, 10) + '...';
  }
  
  return typeLabel;
}
</script>

<style scoped>
.workflow-minimap {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.minimap-svg {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
}

.connection-path {
  stroke-dasharray: 4, 2;
  opacity: 0.6;
}

.minimap-node rect {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

.minimap-node text {
  pointer-events: none;
  text-transform: capitalize;
}

.indicators rect {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}
</style>