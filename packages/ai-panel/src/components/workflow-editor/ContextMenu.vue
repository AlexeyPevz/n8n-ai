<template>
  <Transition name="context-menu">
    <div
      v-if="visible"
      class="context-menu"
      :style="{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
      }"
      @click.stop
    >
      <div
        v-for="(item, index) in items"
        :key="index"
        class="menu-item"
        :class="{
          'menu-separator': item.type === 'separator',
          'menu-disabled': item.disabled,
          'menu-danger': item.danger,
        }"
        @click="handleSelect(item)"
      >
        <template v-if="item.type !== 'separator'">
          <span class="menu-icon" v-if="item.icon">
            <component :is="getIcon(item.icon)" />
          </span>
          <span class="menu-label">{{ item.label }}</span>
          <span class="menu-shortcut" v-if="item.shortcut">
            {{ item.shortcut }}
          </span>
        </template>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

interface MenuItem {
  label?: string;
  icon?: string;
  action?: string;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  type?: 'separator';
  data?: any;
}

interface Position {
  x: number;
  y: number;
}

const props = defineProps<{
  position: Position;
  items: MenuItem[];
}>();

const emit = defineEmits(['select', 'close']);

const visible = ref(true);
const menuRef = ref<HTMLElement>();

// Adjust position to keep menu on screen
const adjustedPosition = computed(() => {
  const padding = 10;
  let { x, y } = props.position;
  
  // This would be calculated based on menu dimensions and window size
  // For now, just ensure some padding from edges
  x = Math.max(padding, Math.min(x, window.innerWidth - 200));
  y = Math.max(padding, Math.min(y, window.innerHeight - 300));
  
  return { x, y };
});

// Handle item selection
function handleSelect(item: MenuItem) {
  if (item.disabled || item.type === 'separator') return;
  emit('select', item);
  close();
}

// Close menu
function close() {
  visible.value = false;
  setTimeout(() => emit('close'), 200);
}

// Get icon component (simplified - in real app would map to actual icons)
function getIcon(iconName: string) {
  // Return a simple span with emoji for demo
  const icons: Record<string, string> = {
    plus: '➕',
    cog: '⚙️',
    copy: '📋',
    cut: '✂️',
    clipboard: '📋',
    trash: '🗑️',
    expand: '⛶',
    'select-all': '☑️',
  };
  
  return {
    template: `<span>${icons[iconName] || '▪️'}</span>`,
  };
}

// Close on click outside
function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (!target.closest('.context-menu')) {
    close();
  }
}

// Close on escape
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    close();
  }
}

// Lifecycle
onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.context-menu {
  position: fixed;
  min-width: 180px;
  background: white;
  border-radius: 6px;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.15);
  padding: 4px;
  z-index: 2000;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: #333;
  transition: all 0.15s;
  user-select: none;
}

.menu-item:hover:not(.menu-separator):not(.menu-disabled) {
  background: #f5f5f5;
}

.menu-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.menu-danger {
  color: #ff3333;
}

.menu-danger:hover {
  background: #fee;
}

.menu-separator {
  height: 1px;
  margin: 4px 0;
  padding: 0;
  background: #e0e0e0;
  cursor: default;
}

.menu-icon {
  width: 20px;
  margin-right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.menu-label {
  flex: 1;
}

.menu-shortcut {
  margin-left: 20px;
  font-size: 11px;
  color: #999;
}

/* Transition */
.context-menu-enter-active,
.context-menu-leave-active {
  transition: all 0.15s ease;
}

.context-menu-enter-from,
.context-menu-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>