<template>
  <Transition name="palette">
    <div
      v-if="visible"
      class="node-palette"
      :style="{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }"
      @click.stop
    >
      <!-- Search -->
      <div class="palette-search">
        <input
          ref="searchInput"
          v-model="searchQuery"
          type="text"
          placeholder="Search nodes..."
          class="search-input"
          @keydown.esc="$emit('close')"
        />
      </div>
      
      <!-- Categories -->
      <div class="palette-categories">
        <button
          v-for="category in categories"
          :key="category.name"
          class="category-tab"
          :class="{ active: activeCategory === category.name }"
          @click="activeCategory = category.name"
        >
          <span class="category-icon" :style="{ color: category.color }">
            {{ category.icon }}
          </span>
          {{ category.label }}
        </button>
      </div>
      
      <!-- Nodes List -->
      <div class="palette-nodes">
        <div
          v-for="node in filteredNodes"
          :key="node.name"
          class="node-item"
          @click="selectNode(node.name)"
        >
          <div class="node-item-icon" :style="{ backgroundColor: getCategoryColor(node.group) + '20' }">
            <img
              v-if="node.icon"
              :src="`/node-icons/${node.icon}`"
              :alt="node.displayName"
              class="node-icon"
            />
            <span v-else class="node-icon-text" :style="{ color: getCategoryColor(node.group) }">
              {{ node.displayName.charAt(0) }}
            </span>
          </div>
          <div class="node-item-content">
            <div class="node-item-name">{{ node.displayName }}</div>
            <div class="node-item-description">{{ node.description }}</div>
          </div>
        </div>
        
        <div v-if="filteredNodes.length === 0" class="no-results">
          No nodes found
        </div>
      </div>
      
      <!-- Quick Actions -->
      <div class="palette-footer">
        <div class="quick-actions">
          <button class="quick-action" @click="selectNode('n8n-nodes-base.httpRequest')">
            <span class="action-icon">🌐</span>
            HTTP Request
          </button>
          <button class="quick-action" @click="selectNode('n8n-nodes-base.set')">
            <span class="action-icon">📝</span>
            Set
          </button>
          <button class="quick-action" @click="selectNode('n8n-nodes-base.if')">
            <span class="action-icon">🔀</span>
            IF
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useNodeTypesStore } from '@/stores/nodeTypes';

interface Position {
  x: number;
  y: number;
}

const props = defineProps<{
  visible: boolean;
  position: Position;
}>();

const emit = defineEmits(['select', 'close']);

const nodeTypesStore = useNodeTypesStore();

const searchInput = ref<HTMLInputElement>();
const searchQuery = ref('');
const activeCategory = ref('all');

// Categories
const categories = [
  { name: 'all', label: 'All', icon: '⚡', color: '#666' },
  { name: 'input', label: 'Input', icon: '📥', color: '#7fb069' },
  { name: 'output', label: 'Output', icon: '📤', color: '#ff6d5a' },
  { name: 'transform', label: 'Transform', icon: '🔄', color: '#5fa3d3' },
  { name: 'flow', label: 'Flow', icon: '🔀', color: '#ffa940' },
  { name: 'function', label: 'Function', icon: '⚙️', color: '#b47cff' },
  { name: 'data', label: 'Data', icon: '💾', color: '#ff6b6b' },
  { name: 'communication', label: 'Communication', icon: '📡', color: '#22cce2' },
];

// Filtered nodes
const filteredNodes = computed(() => {
  let nodes = nodeTypesStore.allNodeTypes;
  
  // Filter by category
  if (activeCategory.value !== 'all') {
    nodes = nodes.filter(node => node.group === activeCategory.value);
  }
  
  // Filter by search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    nodes = nodes.filter(node => 
      node.displayName.toLowerCase().includes(query) ||
      node.name.toLowerCase().includes(query) ||
      (node.description && node.description.toLowerCase().includes(query))
    );
  }
  
  // Sort alphabetically
  return nodes.sort((a, b) => a.displayName.localeCompare(b.displayName));
});

// Focus search on open
watch(() => props.visible, (visible) => {
  if (visible) {
    nextTick(() => {
      searchInput.value?.focus();
    });
  } else {
    searchQuery.value = '';
    activeCategory.value = 'all';
  }
});

// Helper functions
function getCategoryColor(group: string): string {
  const category = categories.find(c => c.name === group);
  return category?.color || '#666';
}

function selectNode(nodeName: string) {
  emit('select', nodeName);
}

// Close on click outside
function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (!target.closest('.node-palette')) {
    emit('close');
  }
}

// Add/remove click listener
watch(() => props.visible, (visible) => {
  if (visible) {
    document.addEventListener('click', handleClickOutside);
  } else {
    document.removeEventListener('click', handleClickOutside);
  }
});
</script>

<style scoped>
.node-palette {
  position: absolute;
  width: 380px;
  max-height: 500px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  z-index: 1000;
  transform: translate(-50%, 20px);
}

/* Search */
.palette-search {
  padding: 12px;
  border-bottom: 1px solid #e0e0e0;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: #ff6d5a;
}

/* Categories */
.palette-categories {
  display: flex;
  padding: 8px 12px;
  gap: 4px;
  border-bottom: 1px solid #e0e0e0;
  overflow-x: auto;
}

.category-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  background: transparent;
  border-radius: 4px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.category-tab:hover {
  background: #f5f5f5;
}

.category-tab.active {
  background: #fee9e7;
  color: #ff6d5a;
}

.category-icon {
  font-size: 16px;
}

/* Nodes List */
.palette-nodes {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.node-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.node-item:hover {
  background: #f8f8f8;
}

.node-item-icon {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.node-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.node-icon-text {
  font-size: 18px;
  font-weight: bold;
}

.node-item-content {
  flex: 1;
  min-width: 0;
}

.node-item-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-item-description {
  font-size: 12px;
  color: #999;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.no-results {
  text-align: center;
  padding: 40px;
  color: #999;
}

/* Footer */
.palette-footer {
  border-top: 1px solid #e0e0e0;
  padding: 8px;
}

.quick-actions {
  display: flex;
  gap: 4px;
}

.quick-action {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px;
  border: 1px solid #e0e0e0;
  background: white;
  border-radius: 4px;
  font-size: 12px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.quick-action:hover {
  background: #f8f8f8;
  border-color: #ff6d5a;
  color: #ff6d5a;
}

.action-icon {
  font-size: 16px;
}

/* Transition */
.palette-enter-active,
.palette-leave-active {
  transition: all 0.2s ease;
}

.palette-enter-from,
.palette-leave-to {
  opacity: 0;
  transform: translate(-50%, 0) scale(0.9);
}

/* Scrollbar */
.palette-nodes::-webkit-scrollbar {
  width: 6px;
}

.palette-nodes::-webkit-scrollbar-track {
  background: transparent;
}

.palette-nodes::-webkit-scrollbar-thumb {
  background: #ddd;
  border-radius: 3px;
}

.palette-nodes::-webkit-scrollbar-thumb:hover {
  background: #ccc;
}
</style>