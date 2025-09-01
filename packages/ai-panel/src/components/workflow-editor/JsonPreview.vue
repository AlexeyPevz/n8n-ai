<template>
  <div class="json-preview">
    <div v-if="isEmpty" class="empty-data">
      No data
    </div>
    
    <div v-else-if="isSimpleValue" class="simple-value">
      {{ formatSimpleValue(data) }}
    </div>
    
    <div v-else-if="isArray" class="array-preview">
      <div class="array-info">
        Array ({{ data.length }} {{ data.length === 1 ? 'item' : 'items' }})
      </div>
      <div v-if="data.length > 0" class="array-items">
        <div
          v-for="(item, index) in displayItems"
          :key="index"
          class="array-item"
        >
          <span class="item-index">[{{ index }}]</span>
          <JsonPreview :data="item" :maxItems="maxItems - 1" :compact="true" />
        </div>
        <div v-if="hasMore" class="more-items">
          ... and {{ data.length - displayItems.length }} more
        </div>
      </div>
    </div>
    
    <div v-else-if="isObject" class="object-preview">
      <div v-if="compact" class="object-compact">
        {{ formatCompactObject(data) }}
      </div>
      <div v-else class="object-properties">
        <div
          v-for="[key, value] in displayEntries"
          :key="key"
          class="object-property"
        >
          <span class="property-key">{{ key }}:</span>
          <JsonPreview :data="value" :maxItems="maxItems - 1" :compact="true" />
        </div>
        <div v-if="hasMoreKeys" class="more-items">
          ... and {{ Object.keys(data).length - displayEntries.length }} more
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  data: any;
  maxItems?: number;
  compact?: boolean;
}>();

const maxItemsCount = computed(() => props.maxItems ?? 5);

// Type checks
const isEmpty = computed(() => 
  props.data === null || props.data === undefined
);

const isSimpleValue = computed(() => 
  typeof props.data !== 'object' || props.data === null
);

const isArray = computed(() => 
  Array.isArray(props.data)
);

const isObject = computed(() => 
  !isEmpty.value && !isSimpleValue.value && !isArray.value
);

// Display items
const displayItems = computed(() => {
  if (!isArray.value) return [];
  return props.data.slice(0, maxItemsCount.value);
});

const hasMore = computed(() => 
  isArray.value && props.data.length > maxItemsCount.value
);

const displayEntries = computed(() => {
  if (!isObject.value) return [];
  return Object.entries(props.data).slice(0, maxItemsCount.value);
});

const hasMoreKeys = computed(() => 
  isObject.value && Object.keys(props.data).length > maxItemsCount.value
);

// Formatting
function formatSimpleValue(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return value.toString();
  return String(value);
}

function formatCompactObject(obj: any): string {
  const keys = Object.keys(obj);
  if (keys.length === 0) return '{}';
  
  const preview = keys.slice(0, 3).map(key => {
    const value = obj[key];
    const formattedValue = 
      typeof value === 'string' ? `"${value.substring(0, 20)}${value.length > 20 ? '...' : ''}"` :
      typeof value === 'number' ? value :
      typeof value === 'boolean' ? value :
      Array.isArray(value) ? `[${value.length}]` :
      typeof value === 'object' && value !== null ? '{...}' :
      'null';
    
    return `${key}: ${formattedValue}`;
  }).join(', ');
  
  const more = keys.length > 3 ? ', ...' : '';
  return `{ ${preview}${more} }`;
}
</script>

<style scoped>
.json-preview {
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.4;
  color: #333;
}

.empty-data {
  color: #999;
  font-style: italic;
}

.simple-value {
  color: #0066cc;
}

/* Array Preview */
.array-preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.array-info {
  color: #666;
  font-size: 11px;
}

.array-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-left: 16px;
}

.array-item {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.item-index {
  color: #999;
  flex-shrink: 0;
}

/* Object Preview */
.object-preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.object-compact {
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.object-properties {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-left: 16px;
}

.object-property {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.property-key {
  color: #9d4edd;
  flex-shrink: 0;
}

.more-items {
  color: #999;
  font-size: 11px;
  font-style: italic;
  padding-left: 16px;
}

/* Nested styling */
.json-preview .json-preview {
  display: inline-flex;
}

.json-preview .json-preview .array-items,
.json-preview .json-preview .object-properties {
  padding-left: 0;
}
</style>