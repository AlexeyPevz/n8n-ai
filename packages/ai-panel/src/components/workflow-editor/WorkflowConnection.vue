<template>
  <g class="workflow-connection" @mouseenter="hover = true" @mouseleave="hover = false">
    <!-- Connection Path -->
    <path
      class="connection-path-shadow"
      :d="pathData"
      fill="none"
      stroke="rgba(0,0,0,0.1)"
      stroke-width="6"
    />
    <path
      class="connection-path"
      :class="{
        'connection-hover': hover,
        'connection-active': active,
        'connection-error': hasError,
      }"
      :d="pathData"
      fill="none"
      :stroke="connectionColor"
      stroke-width="2"
    />
    
    <!-- Connection Data Flow Animation -->
    <circle
      v-if="active"
      class="connection-flow"
      r="4"
      :fill="connectionColor"
    >
      <animateMotion
        :dur="`${2 / zoom}s`"
        repeatCount="indefinite"
        :path="pathData"
      />
    </circle>
    
    <!-- Connection Tools (shown on hover) -->
    <g v-if="hover" class="connection-tools">
      <!-- Delete Button -->
      <g
        class="connection-delete"
        :transform="`translate(${midPoint.x}, ${midPoint.y})`"
        @click="handleDelete"
      >
        <circle r="12" fill="white" stroke="#ddd" stroke-width="1" />
        <path
          d="M -4 -4 L 4 4 M 4 -4 L -4 4"
          stroke="#666"
          stroke-width="2"
          stroke-linecap="round"
        />
      </g>
      
      <!-- Connection Info -->
      <g
        v-if="connectionInfo"
        :transform="`translate(${midPoint.x}, ${midPoint.y - 25})`"
      >
        <rect
          x="-30"
          y="-10"
          width="60"
          height="20"
          rx="10"
          fill="rgba(0,0,0,0.8)"
        />
        <text
          x="0"
          y="4"
          text-anchor="middle"
          fill="white"
          font-size="11"
        >
          {{ connectionInfo }}
        </text>
      </g>
    </g>
  </g>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface Connection {
  from: string;
  to: string;
  fromIndex?: number;
  toIndex?: number;
}

interface Node {
  id: string;
  position: [number, number];
  type: string;
}

const props = defineProps<{
  connection: Connection;
  fromNode?: Node;
  toNode?: Node;
  zoom: number;
  active?: boolean;
  hasError?: boolean;
}>();

const emit = defineEmits(['delete']);

const hover = ref(false);

// Connection appearance
const connectionColor = computed(() => {
  if (props.hasError) return '#ff3333';
  if (props.active) return '#ff6d5a';
  if (hover.value) return '#ff8977';
  return '#999';
});

// Path calculation
const pathData = computed(() => {
  if (!props.fromNode || !props.toNode) return '';
  
  const fromX = props.fromNode.position[0] + 280; // Node width
  const fromY = props.fromNode.position[1] + 35; // Approximate output position
  
  const toX = props.toNode.position[0];
  const toY = props.toNode.position[1] + 35; // Approximate input position
  
  return createSmoothPath(fromX, fromY, toX, toY);
});

const midPoint = computed(() => {
  if (!props.fromNode || !props.toNode) return { x: 0, y: 0 };
  
  const fromX = props.fromNode.position[0] + 280;
  const fromY = props.fromNode.position[1] + 35;
  const toX = props.toNode.position[0];
  const toY = props.toNode.position[1] + 35;
  
  return {
    x: (fromX + toX) / 2,
    y: (fromY + toY) / 2,
  };
});

const connectionInfo = computed(() => {
  // Could show data like "5 items" or execution status
  return null;
});

// Create smooth bezier curve path
function createSmoothPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.abs(x2 - x1);
  const dy = y2 - y1;
  
  // Calculate control points for smooth curve
  let cp1x, cp1y, cp2x, cp2y;
  
  if (x2 > x1) {
    // Normal left-to-right connection
    const distance = Math.min(dx * 0.5, 150);
    cp1x = x1 + distance;
    cp1y = y1;
    cp2x = x2 - distance;
    cp2y = y2;
  } else {
    // Right-to-left connection (loop back)
    const offset = Math.max(50, Math.abs(dy) * 0.5);
    cp1x = x1 + offset;
    cp1y = y1;
    cp2x = x2 - offset;
    cp2y = y2;
  }
  
  return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
}

function handleDelete() {
  emit('delete', props.connection);
}
</script>

<style scoped>
.workflow-connection {
  pointer-events: stroke;
}

/* Path styles */
.connection-path-shadow {
  pointer-events: stroke;
  cursor: pointer;
}

.connection-path {
  transition: stroke 0.2s, stroke-width 0.2s;
  cursor: pointer;
}

.connection-hover {
  stroke-width: 3;
}

.connection-active {
  stroke-dasharray: 5, 5;
  animation: dash 0.5s linear infinite;
}

.connection-error {
  stroke: #ff3333 !important;
}

@keyframes dash {
  to {
    stroke-dashoffset: -10;
  }
}

/* Flow animation */
.connection-flow {
  pointer-events: none;
  filter: drop-shadow(0 0 3px currentColor);
}

/* Tools */
.connection-tools {
  pointer-events: all;
}

.connection-delete {
  cursor: pointer;
  transition: transform 0.2s;
}

.connection-delete:hover {
  transform: scale(1.2);
}

.connection-delete:hover circle {
  fill: #fee;
  stroke: #ff3333;
}

.connection-delete:hover path {
  stroke: #ff3333;
}
</style>