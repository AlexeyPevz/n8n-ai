<template>
  <n8n-modal
    :name="MODAL_KEY"
    :title="$locale.baseText('ai.diffPreview.title')"
    :subtitle="$locale.baseText('ai.diffPreview.subtitle')"
    :showClose="false"
    :closeOnClickModal="false"
    :closeOnPressEscape="false"
    width="800px"
    :center="true"
    @enter="onApply"
  >
    <template #header>
      <div class="diff-header">
        <div class="diff-header-info">
          <n8n-icon icon="code-branch" size="large" />
          <div>
            <h2>{{ $locale.baseText('ai.diffPreview.title') }}</h2>
            <n8n-text size="small" color="text-light">
              {{ operations.length }} {{ $locale.baseText('ai.diffPreview.changes', { count: operations.length }) }}
            </n8n-text>
          </div>
        </div>
        <n8n-info-tip
          :content="$locale.baseText('ai.diffPreview.helpText')"
          theme="info"
        />
      </div>
    </template>

    <template #content>
      <div class="diff-content">
        <!-- Визуальный превью изменений -->
        <div class="diff-preview">
          <div class="preview-header">
            <n8n-text tag="h4">
              {{ $locale.baseText('ai.diffPreview.visualPreview') }}
            </n8n-text>
            <n8n-button
              type="tertiary"
              size="mini"
              @click="toggleDiffView"
            >
              <n8n-icon :icon="showSideBySide ? 'columns' : 'list'" />
              {{ showSideBySide ? 'Unified' : 'Side by side' }}
            </n8n-button>
          </div>

          <!-- Canvas превью с изменениями -->
          <div class="canvas-preview" :class="{ 'side-by-side': showSideBySide }">
            <div v-if="showSideBySide" class="preview-before">
              <n8n-text size="small" color="text-light">Before</n8n-text>
              <WorkflowCanvas
                :nodes="currentNodes"
                :connections="currentConnections"
                :readonly="true"
                :zoom="0.7"
              />
            </div>
            
            <div class="preview-after">
              <n8n-text v-if="showSideBySide" size="small" color="text-light">After</n8n-text>
              <WorkflowCanvas
                :nodes="previewNodes"
                :connections="previewConnections"
                :readonly="true"
                :zoom="0.7"
                :highlights="diffHighlights"
              />
            </div>
          </div>
        </div>

        <!-- Список изменений -->
        <div class="diff-details">
          <n8n-text tag="h4">
            {{ $locale.baseText('ai.diffPreview.changesList') }}
          </n8n-text>
          
          <div class="changes-list">
            <div
              v-for="(op, index) in operations"
              :key="index"
              class="change-item"
              :class="`change-${op.op}`"
            >
              <div class="change-icon">
                <n8n-icon
                  :icon="getOperationIcon(op.op)"
                  :color="getOperationColor(op.op)"
                />
              </div>
              
              <div class="change-content">
                <n8n-text tag="p" :bold="true" size="small">
                  {{ getOperationTitle(op) }}
                </n8n-text>
                <n8n-text tag="p" size="small" color="text-light">
                  {{ getOperationDescription(op) }}
                </n8n-text>
                
                <!-- Детали для сложных операций -->
                <div v-if="op.op === 'set_params' && op.parameters" class="change-details">
                  <n8n-notice
                    type="info"
                    :content="formatParameters(op.parameters)"
                  />
                </div>
              </div>

              <!-- Действия для отдельных операций -->
              <div class="change-actions">
                <n8n-tooltip :content="$locale.baseText('ai.diffPreview.skipChange')">
                  <n8n-button
                    type="tertiary"
                    size="mini"
                    icon="times"
                    @click="toggleOperation(index)"
                    :disabled="isOperationDisabled(index)"
                  />
                </n8n-tooltip>
              </div>
            </div>
          </div>
        </div>

        <!-- AI объяснение -->
        <div v-if="aiExplanation" class="ai-explanation">
          <n8n-callout theme="secondary" icon="info-circle">
            <n8n-text tag="p">
              <strong>{{ $locale.baseText('ai.diffPreview.aiNote') }}:</strong>
              {{ aiExplanation }}
            </n8n-text>
          </n8n-callout>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="diff-footer">
        <div class="footer-left">
          <n8n-checkbox
            v-model="rememberChoice"
            :label="$locale.baseText('ai.diffPreview.autoApplyNext')"
          />
        </div>
        
        <div class="footer-actions">
          <n8n-button
            type="secondary"
            @click="onModify"
          >
            {{ $locale.baseText('ai.diffPreview.modify') }}
          </n8n-button>
          
          <n8n-button
            type="tertiary"
            @click="onReject"
          >
            {{ $locale.baseText('generic.cancel') }}
          </n8n-button>
          
          <n8n-button
            type="primary"
            @click="onApply"
            :loading="isApplying"
          >
            {{ $locale.baseText('ai.diffPreview.apply') }}
            <template #icon>
              <n8n-icon icon="check" />
            </template>
          </n8n-button>
        </div>
      </div>
    </template>
  </n8n-modal>
</template>

<script lang="ts">
import { defineComponent, ref, computed } from 'vue';
import type { OperationBatch } from '@n8n-ai/schemas';
import { WorkflowCanvas } from './stubs';
import type { I18n } from './types';

export const DIFF_PREVIEW_MODAL_KEY = 'diffPreview';

export default defineComponent({
  name: 'DiffPreviewModal',
  components: {
    WorkflowCanvas,
  },
  props: {
    operations: {
      type: Array as () => OperationBatch['ops'],
      required: true,
    },
    currentNodes: {
      type: Array,
      default: () => [],
    },
    currentConnections: {
      type: Array,
      default: () => [],
    },
    aiExplanation: {
      type: String,
      default: '',
    },
  },
  emits: ['apply', 'reject', 'modify'],
  setup(props, { emit }) {
    // В реальной интеграции i18n будет из n8n
    const i18n: I18n = {
      baseText: (key: string, options?: any) => {
        // Простая заглушка для демо
        const translations: Record<string, string> = {
          'ai.diffPreview.title': 'Review Workflow Changes',
          'ai.diffPreview.subtitle': 'Preview changes before applying',
          'ai.diffPreview.addNode': 'Add {type} node',
          'ai.diffPreview.updateNode': 'Update {name}',
          'ai.diffPreview.connectNodes': 'Connect {from} → {to}',
          'ai.diffPreview.deleteNode': 'Delete {name}',
          'ai.diffPreview.parametersCount': '{count} parameters',
          'generic.cancel': 'Cancel',
        };
        let text = translations[key] || key;
        if (options?.interpolate) {
          Object.entries(options.interpolate).forEach(([k, v]) => {
            text = text.replace(`{${k}}`, String(v));
          });
        }
        return text;
      }
    };
    const MODAL_KEY = DIFF_PREVIEW_MODAL_KEY;
    
    const showSideBySide = ref(false);
    const rememberChoice = ref(false);
    const isApplying = ref(false);
    const disabledOperations = ref(new Set<number>());
    
    // Вычисляем preview состояние
    const { previewNodes, previewConnections, diffHighlights } = computed(() => {
      // Применяем операции к текущему состоянию
      let nodes = [...props.currentNodes];
      let connections = [...props.currentConnections];
      const highlights: any = {
        added: [],
        modified: [],
        deleted: [],
      };
      
      props.operations.forEach((op, index) => {
        if (disabledOperations.value.has(index)) return;
        
        switch (op.op) {
          case 'add_node':
            nodes.push(op.node);
            highlights.added.push(op.node.id);
            break;
            
          case 'set_params':
            const nodeIndex = nodes.findIndex(n => n.name === op.name);
            if (nodeIndex >= 0) {
              nodes[nodeIndex] = {
                ...nodes[nodeIndex],
                parameters: { ...nodes[nodeIndex].parameters, ...op.parameters },
              };
              highlights.modified.push(nodes[nodeIndex].id);
            }
            break;
            
          case 'connect':
            connections.push({
              from: op.from,
              to: op.to,
              index: op.index || 0,
            });
            highlights.added.push(`${op.from}-${op.to}`);
            break;
            
          case 'delete':
            nodes = nodes.filter(n => n.name !== op.name);
            connections = connections.filter(c => c.from !== op.name && c.to !== op.name);
            highlights.deleted.push(op.name);
            break;
        }
      });
      
      return { previewNodes: nodes, previewConnections: connections, diffHighlights: highlights };
    });
    
    const getOperationIcon = (op: string) => {
      const icons: Record<string, string> = {
        add_node: 'plus-circle',
        set_params: 'edit',
        connect: 'link',
        delete: 'trash',
        annotate: 'comment',
      };
      return icons[op] || 'question';
    };
    
    const getOperationColor = (op: string) => {
      const colors: Record<string, string> = {
        add_node: 'success',
        set_params: 'warning',
        connect: 'primary',
        delete: 'danger',
        annotate: 'text-base',
      };
      return colors[op] || 'text-base';
    };
    
    const getOperationTitle = (op: any) => {
      switch (op.op) {
        case 'add_node':
          return i18n.baseText('ai.diffPreview.addNode', { 
            interpolate: { type: op.node.type.split('.').pop() } 
          });
        case 'set_params':
          return i18n.baseText('ai.diffPreview.updateNode', { 
            interpolate: { name: op.name } 
          });
        case 'connect':
          return i18n.baseText('ai.diffPreview.connectNodes', { 
            interpolate: { from: op.from, to: op.to } 
          });
        case 'delete':
          return i18n.baseText('ai.diffPreview.deleteNode', { 
            interpolate: { name: op.name } 
          });
        case 'annotate':
          return i18n.baseText('ai.diffPreview.addNote');
        default:
          return op.op;
      }
    };
    
    const getOperationDescription = (op: any) => {
      switch (op.op) {
        case 'add_node':
          return op.node.position ? 
            `Position: [${op.node.position[0]}, ${op.node.position[1]}]` : '';
        case 'set_params':
          const paramCount = Object.keys(op.parameters || {}).length;
          return i18n.baseText('ai.diffPreview.parametersCount', { 
            interpolate: { count: paramCount } 
          });
        case 'connect':
          return op.index ? `Output index: ${op.index}` : 'Main output';
        default:
          return '';
      }
    };
    
    const formatParameters = (params: Record<string, any>) => {
      return Object.entries(params)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join('\n');
    };
    
    const toggleOperation = (index: number) => {
      if (disabledOperations.value.has(index)) {
        disabledOperations.value.delete(index);
      } else {
        disabledOperations.value.add(index);
      }
    };
    
    const isOperationDisabled = (index: number) => {
      return disabledOperations.value.has(index);
    };
    
    const onApply = async () => {
      isApplying.value = true;
      
      // Фильтруем отключенные операции
      const activeOperations = props.operations.filter(
        (_, index) => !disabledOperations.value.has(index)
      );
      
      emit('apply', {
        operations: activeOperations,
        rememberChoice: rememberChoice.value,
      });
      
      setTimeout(() => {
        isApplying.value = false;
      }, 500);
    };
    
    const onReject = () => {
      emit('reject');
    };
    
    const onModify = () => {
      emit('modify');
    };
    
    const toggleDiffView = () => {
      showSideBySide.value = !showSideBySide.value;
    };
    
    return {
      MODAL_KEY,
      showSideBySide,
      rememberChoice,
      isApplying,
      previewNodes,
      previewConnections,
      diffHighlights,
      getOperationIcon,
      getOperationColor,
      getOperationTitle,
      getOperationDescription,
      formatParameters,
      toggleOperation,
      isOperationDisabled,
      onApply,
      onReject,
      onModify,
      toggleDiffView,
    };
  },
});
</script>

<style lang="scss" scoped>
.diff-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  
  .diff-header-info {
    display: flex;
    align-items: center;
    gap: var(--spacing-m);
    
    h2 {
      margin: 0;
    }
  }
}

.diff-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-l);
  max-height: 600px;
  overflow-y: auto;
}

.diff-preview {
  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-s);
  }
  
  .canvas-preview {
    background: var(--color-background-light);
    border: 1px solid var(--color-foreground-base);
    border-radius: var(--border-radius-base);
    height: 300px;
    position: relative;
    
    &.side-by-side {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--spacing-s);
      
      .preview-before,
      .preview-after {
        position: relative;
        height: 100%;
      }
    }
  }
}

.diff-details {
  .changes-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-s);
    margin-top: var(--spacing-s);
  }
  
  .change-item {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-s);
    padding: var(--spacing-s);
    background: var(--color-background-light);
    border-radius: var(--border-radius-base);
    border: 1px solid var(--color-foreground-base);
    
    &.change-add_node {
      border-color: var(--color-success-tint-1);
      background: var(--color-success-tint-3);
    }
    
    &.change-set_params {
      border-color: var(--color-warning-tint-1);
      background: var(--color-warning-tint-3);
    }
    
    &.change-delete {
      border-color: var(--color-danger-tint-1);
      background: var(--color-danger-tint-3);
    }
    
    .change-icon {
      flex-shrink: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .change-content {
      flex: 1;
      
      p {
        margin: 0;
      }
      
      .change-details {
        margin-top: var(--spacing-xs);
        
        pre {
          margin: 0;
          font-size: var(--font-size-2xs);
        }
      }
    }
    
    .change-actions {
      flex-shrink: 0;
    }
  }
}

.ai-explanation {
  margin-top: var(--spacing-m);
}

.diff-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  .footer-actions {
    display: flex;
    gap: var(--spacing-s);
  }
}
</style>