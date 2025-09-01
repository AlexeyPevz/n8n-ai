<template>
  <div class="data-inspector-overlay" @click="$emit('close')">
    <div class="data-inspector" @click.stop>
      <!-- Header -->
      <div class="inspector-header">
        <h3 class="inspector-title">{{ data.title || 'Data Inspector' }}</h3>
        <div class="inspector-controls">
          <button 
            @click="viewMode = 'table'"
            class="view-btn"
            :class="{ active: viewMode === 'table' }"
          >
            <IconTable />
            Table
          </button>
          <button 
            @click="viewMode = 'json'"
            class="view-btn"
            :class="{ active: viewMode === 'json' }"
          >
            <IconCode />
            JSON
          </button>
          <button @click="copyToClipboard" class="action-btn">
            <IconCopy />
            Copy
          </button>
          <button @click="downloadData" class="action-btn">
            <IconDownload />
            Download
          </button>
          <button @click="$emit('close')" class="close-btn">
            <IconX />
          </button>
        </div>
      </div>
      
      <!-- Content -->
      <div class="inspector-content">
        <!-- Table View -->
        <div v-if="viewMode === 'table'" class="table-view">
          <div v-if="isEmpty" class="empty-state">
            No data to display
          </div>
          
          <div v-else-if="isArrayOfObjects" class="data-table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th class="row-number-header">#</th>
                  <th
                    v-for="column in columns"
                    :key="column"
                    class="column-header"
                    @click="sortBy(column)"
                  >
                    {{ column }}
                    <span v-if="sortColumn === column" class="sort-indicator">
                      {{ sortOrder === 'asc' ? '▲' : '▼' }}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, index) in paginatedRows"
                  :key="index"
                  class="data-row"
                >
                  <td class="row-number">{{ startIndex + index + 1 }}</td>
                  <td
                    v-for="column in columns"
                    :key="column"
                    class="data-cell"
                  >
                    <CellValue :value="row[column]" />
                  </td>
                </tr>
              </tbody>
            </table>
            
            <!-- Pagination -->
            <div v-if="totalPages > 1" class="pagination">
              <button
                @click="currentPage = 1"
                :disabled="currentPage === 1"
                class="page-btn"
              >
                First
              </button>
              <button
                @click="currentPage--"
                :disabled="currentPage === 1"
                class="page-btn"
              >
                Previous
              </button>
              <span class="page-info">
                Page {{ currentPage }} of {{ totalPages }}
                ({{ flatData.length }} total rows)
              </span>
              <button
                @click="currentPage++"
                :disabled="currentPage === totalPages"
                class="page-btn"
              >
                Next
              </button>
              <button
                @click="currentPage = totalPages"
                :disabled="currentPage === totalPages"
                class="page-btn"
              >
                Last
              </button>
            </div>
          </div>
          
          <div v-else class="json-view">
            <JsonTree :data="flatData" :expandAll="false" />
          </div>
        </div>
        
        <!-- JSON View -->
        <div v-else class="json-view">
          <div class="json-controls">
            <button @click="expandAll = !expandAll" class="expand-btn">
              {{ expandAll ? 'Collapse All' : 'Expand All' }}
            </button>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search..."
              class="search-input"
            />
          </div>
          <JsonTree 
            :data="flatData" 
            :expandAll="expandAll"
            :searchQuery="searchQuery"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import JsonTree from './JsonTree.vue';
import CellValue from './CellValue.vue';
import IconTable from '../icons/IconTable.vue';
import IconCode from '../icons/IconCode.vue';
import IconCopy from '../icons/IconCopy.vue';
import IconDownload from '../icons/IconDownload.vue';
import IconX from '../icons/IconX.vue';

const props = defineProps<{
  data: {
    title?: string;
    data: any;
    nodeId?: string;
    type?: string;
  };
}>();

const emit = defineEmits(['close']);

// State
const viewMode = ref<'table' | 'json'>('table');
const currentPage = ref(1);
const itemsPerPage = 50;
const sortColumn = ref<string>('');
const sortOrder = ref<'asc' | 'desc'>('asc');
const expandAll = ref(false);
const searchQuery = ref('');

// Flatten data for display
const flatData = computed(() => {
  const d = props.data.data;
  
  // If it's already a flat array, return it
  if (Array.isArray(d) && d.length > 0 && !Array.isArray(d[0])) {
    return d;
  }
  
  // If it's an array of arrays (n8n format), flatten it
  if (Array.isArray(d) && d.length > 0 && Array.isArray(d[0])) {
    return d.flat();
  }
  
  // If it's a single object, wrap in array
  if (typeof d === 'object' && d !== null && !Array.isArray(d)) {
    return [d];
  }
  
  return d;
});

// Data analysis
const isEmpty = computed(() => !flatData.value || flatData.value.length === 0);

const isArrayOfObjects = computed(() => {
  return Array.isArray(flatData.value) &&
    flatData.value.length > 0 &&
    typeof flatData.value[0] === 'object' &&
    flatData.value[0] !== null;
});

// Table columns
const columns = computed(() => {
  if (!isArrayOfObjects.value) return [];
  
  const columnSet = new Set<string>();
  flatData.value.forEach((item: any) => {
    if (typeof item === 'object' && item !== null) {
      Object.keys(item).forEach(key => columnSet.add(key));
    }
  });
  
  return Array.from(columnSet).sort();
});

// Sorted data
const sortedData = computed(() => {
  if (!sortColumn.value || !isArrayOfObjects.value) {
    return flatData.value;
  }
  
  return [...flatData.value].sort((a, b) => {
    const aVal = a[sortColumn.value];
    const bVal = b[sortColumn.value];
    
    if (aVal === bVal) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    
    const comparison = aVal < bVal ? -1 : 1;
    return sortOrder.value === 'asc' ? comparison : -comparison;
  });
});

// Pagination
const totalPages = computed(() => 
  Math.ceil(sortedData.value.length / itemsPerPage)
);

const startIndex = computed(() => 
  (currentPage.value - 1) * itemsPerPage
);

const paginatedRows = computed(() => 
  sortedData.value.slice(startIndex.value, startIndex.value + itemsPerPage)
);

// Methods
function sortBy(column: string) {
  if (sortColumn.value === column) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn.value = column;
    sortOrder.value = 'asc';
  }
  currentPage.value = 1;
}

async function copyToClipboard() {
  try {
    const text = JSON.stringify(flatData.value, null, 2);
    await navigator.clipboard.writeText(text);
    // Show success toast
  } catch (error) {
    console.error('Failed to copy:', error);
  }
}

function downloadData() {
  const text = JSON.stringify(flatData.value, null, 2);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${props.data.nodeId || 'data'}-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
</script>

<style scoped>
.data-inspector-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
}

.data-inspector {
  background: white;
  border-radius: 8px;
  width: 100%;
  max-width: 1200px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

/* Header */
.inspector-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
}

.inspector-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.inspector-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.view-btn,
.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.view-btn:hover,
.action-btn:hover {
  background: #f5f5f5;
  border-color: #ccc;
}

.view-btn.active {
  background: #ff6d5a;
  border-color: #ff6d5a;
  color: white;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: #999;
  cursor: pointer;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f5f5f5;
  color: #666;
}

/* Content */
.inspector-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Table View */
.table-view {
  flex: 1;
  overflow: auto;
}

.data-table-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table th,
.data-table td {
  text-align: left;
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
}

.row-number-header,
.row-number {
  width: 50px;
  text-align: center;
  background: #fafafa;
  color: #999;
  font-size: 12px;
}

.column-header {
  background: #f8f8f8;
  font-weight: 600;
  color: #333;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  position: sticky;
  top: 0;
  z-index: 10;
}

.column-header:hover {
  background: #f0f0f0;
}

.sort-indicator {
  margin-left: 4px;
  font-size: 10px;
  color: #ff6d5a;
}

.data-row:hover {
  background: #fafafa;
}

.data-cell {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px;
  border-top: 1px solid #e0e0e0;
  background: #fafafa;
}

.page-btn {
  padding: 6px 12px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: #f5f5f5;
  border-color: #ccc;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 13px;
  color: #666;
}

/* JSON View */
.json-view {
  flex: 1;
  overflow: auto;
  padding: 20px;
}

.json-controls {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.expand-btn {
  padding: 6px 12px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.expand-btn:hover {
  background: #f5f5f5;
  border-color: #ccc;
}

.search-input {
  flex: 1;
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  outline: none;
}

.search-input:focus {
  border-color: #ff6d5a;
}

/* Empty State */
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #999;
  font-size: 14px;
}
</style>