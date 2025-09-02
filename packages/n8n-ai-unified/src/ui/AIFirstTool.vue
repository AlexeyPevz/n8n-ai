<template>
  <div class="ai-first-tool">
    <!-- Кнопка в стиле n8n -->
    <n8n-button
      v-if="!isOpen"
      class="ai-trigger-button"
      type="primary"
      size="large"
      icon="robot"
      @click="openPanel"
      :title="$locale.baseText('aiFirstTool.tooltip')"
    >
      AI-first tool
      <n8n-tooltip placement="top">
        <template #content>
          <div class="tooltip-content">
            <strong>{{ $locale.baseText('aiFirstTool.tooltip.title') }}</strong>
            <p>{{ $locale.baseText('aiFirstTool.tooltip.description') }}</p>
            <kbd>Cmd+K</kbd>
          </div>
        </template>
      </n8n-tooltip>
    </n8n-button>

    <!-- Выезжающая панель снизу (как в n8n для логов выполнения) -->
    <transition name="panel-slide">
      <div v-if="isOpen" class="ai-panel" :class="`position-${position}`">
        <!-- Заголовок панели -->
        <div class="panel-header">
          <div class="header-left">
            <n8n-icon icon="robot" size="medium" />
            <span class="panel-title">AI Workflow Assistant</span>
            <n8n-info-tip 
              :content="$locale.baseText('aiFirstTool.info')"
              theme="info"
            />
          </div>
          
          <div class="header-actions">
            <!-- Кнопка Workflow Map -->
            <n8n-button
              type="tertiary"
              size="small"
              icon="sitemap"
              @click="showWorkflowMap"
              title="Workflow Map"
            />
            
            <!-- Кнопка настроек -->
            <n8n-button
              type="tertiary"
              size="small"
              icon="cog"
              @click="showSettings"
            />
            
            <!-- Кнопка закрытия -->
            <n8n-button
              type="tertiary"
              size="small"
              icon="times"
              @click="closePanel"
            />
          </div>
        </div>

        <!-- Основное содержимое -->
        <div class="panel-content">
          <!-- Чат интерфейс -->
          <div class="chat-container">
            <!-- История сообщений -->
            <div class="messages-list" ref="messagesList">
              <div 
                v-for="message in messages" 
                :key="message.id"
                class="message"
                :class="`message-${message.role}`"
              >
                <div class="message-avatar">
                  <n8n-icon 
                    :icon="message.role === 'user' ? 'user' : 'robot'" 
                  />
                </div>
                <div class="message-content">
                  <div v-if="message.type === 'text'" v-html="renderMarkdown(message.content)" />
                  <WorkflowDiff 
                    v-else-if="message.type === 'diff'"
                    :operations="message.operations"
                    @apply="applyOperations"
                    @reject="rejectOperations"
                  />
                  <PlanCard
                    v-else-if="message.type === 'plan'"
                    :plan="message.plan"
                    @approve="approvePlan"
                    @modify="modifyPlan"
                  />
                </div>
              </div>
            </div>

            <!-- Индикатор загрузки -->
            <div v-if="isLoading" class="loading-indicator">
              <n8n-spinner size="small" />
              <span>{{ loadingText }}</span>
            </div>
          </div>

          <!-- Поле ввода -->
          <div class="input-container">
            <n8n-input
              v-model="userInput"
              type="textarea"
              :rows="2"
              :placeholder="$locale.baseText('aiFirstTool.inputPlaceholder')"
              @keydown.enter.ctrl="sendMessage"
              @keydown.enter.meta="sendMessage"
              :disabled="isLoading"
            />
            
            <div class="input-actions">
              <!-- Быстрые действия -->
              <n8n-action-dropdown
                :items="quickActions"
                placement="top-start"
                @select="onQuickAction"
              />
              
              <n8n-button
                type="primary"
                size="small"
                :disabled="!userInput.trim() || isLoading"
                @click="sendMessage"
              >
                {{ $locale.baseText('aiFirstTool.send') }}
                <template #suffix>
                  <kbd>⌘</kbd><kbd>↵</kbd>
                </template>
              </n8n-button>
            </div>
          </div>
        </div>

        <!-- Статус бар -->
        <div class="panel-footer">
          <div class="footer-info">
            <n8n-text size="small" color="text-light">
              <n8n-icon icon="info-circle" size="small" />
              {{ currentModel }} • {{ tokensUsed }} tokens
            </n8n-text>
          </div>
          <div class="footer-actions">
            <n8n-link 
              size="small"
              @click="showHelp"
            >
              {{ $locale.baseText('aiFirstTool.help') }}
            </n8n-link>
          </div>
        </div>
      </div>
    </transition>

    <!-- Модальное окно для Workflow Map -->
    <n8n-modal
      v-model="showMap"
      :title="$locale.baseText('workflowMap.title')"
      width="80%"
    >
      <template #content>
        <WorkflowMap 
          :workflows="workflows"
          @select="onWorkflowSelect"
        />
      </template>
    </n8n-modal>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, nextTick } from 'vue';
import { useAIWorkflow } from './composables/useAIWorkflow';
import type { I18n, Toast } from './components/types';

export default defineComponent({
  name: 'AIFirstTool',
  components: {
    // В реальной интеграции здесь будут настоящие компоненты
  },
  props: {
    position: {
      type: String,
      default: 'bottom',
      validator: (value: string) => ['bottom', 'right', 'modal'].includes(value),
    },
  },
  setup() {
    // Заглушки для демо
    const i18n: I18n = {
      baseText: (key: string) => key
    };
    const toast: Toast = {
      showMessage: (opts) => console.log('Toast:', opts),
      showError: (error, title) => console.error('Error:', title, error)
    };
    const { processPrompt, state } = useAIWorkflow();
    
    const isOpen = ref(false);
    const userInput = ref('');
    const showMap = ref(false);
    
    const quickActions = computed(() => [
      {
        label: i18n.baseText('aiFirstTool.quickActions.http'),
        value: 'http',
        icon: 'globe',
      },
      {
        label: i18n.baseText('aiFirstTool.quickActions.webhook'),
        value: 'webhook',
        icon: 'webhook',
      },
      {
        label: i18n.baseText('aiFirstTool.quickActions.schedule'),
        value: 'schedule',
        icon: 'clock',
      },
      {
        label: i18n.baseText('aiFirstTool.quickActions.database'),
        value: 'database',
        icon: 'database',
      },
    ]);
    
    const openPanel = () => {
      isOpen.value = true;
      // Фокус на поле ввода
      nextTick(() => {
        document.querySelector('.ai-panel textarea')?.focus();
      });
    };
    
    const closePanel = () => {
      isOpen.value = false;
    };
    
    const sendMessage = async () => {
      if (!userInput.value.trim() || state.value.stage !== 'idle') return;
      
      const prompt = userInput.value;
      userInput.value = '';
      
      try {
        await processPrompt(prompt);
      } catch (error: any) {
        toast.showError(error.message);
      }
    };
    
    // Горячие клавиши
    onMounted(() => {
      document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault();
          openPanel();
        }
      });
    });
    
    // Фейковые сообщения для демо
    const messages = ref([
      {
        id: '1',
        role: 'assistant',
        type: 'text',
        content: 'Hello! I can help you create workflows. Try saying "Create an HTTP request to fetch weather data"'
      }
    ]);
    
    const showWorkflowMap = () => {
      showMap.value = true;
    };
    
    const showSettings = () => {
      console.log('Show settings');
    };
    
    const onQuickAction = (action: string) => {
      console.log('Quick action:', action);
    };
    
    const onWorkflowSelect = (workflow: any) => {
      console.log('Selected workflow:', workflow);
    };
    
    const renderMarkdown = (content: string) => content;
    
    const currentModel = 'GPT-4';
    const tokensUsed = 0;
    const loadingText = 'Processing...';
    const workflows = ref([]);
    
    const showHelp = () => {
      console.log('Show help');
    };
    
    return {
      isOpen,
      userInput,
      messages,
      isLoading: computed(() => state.value.stage !== 'idle'),
      showMap,
      quickActions,
      openPanel,
      closePanel,
      sendMessage,
      showWorkflowMap,
      showSettings,
      onQuickAction,
      onWorkflowSelect,
      renderMarkdown,
      currentModel,
      tokensUsed,
      loadingText,
      workflows,
      showHelp,
    };
  },
});
</script>

<style lang="scss" scoped>
.ai-first-tool {
  // Кнопка в правом нижнем углу
  .ai-trigger-button {
    position: fixed;
    bottom: var(--spacing-l);
    right: var(--spacing-l);
    z-index: 999;
    box-shadow: var(--box-shadow-xlarge);
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: var(--box-shadow-2xlarge);
    }
  }
  
  // Панель AI
  .ai-panel {
    position: fixed;
    background: var(--color-background-xlight);
    border: 1px solid var(--color-foreground-base);
    box-shadow: var(--box-shadow-2xlarge);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    
    &.position-bottom {
      bottom: 0;
      left: 0;
      right: 0;
      height: 400px;
      border-radius: var(--border-radius-large) var(--border-radius-large) 0 0;
    }
    
    &.position-right {
      right: 0;
      top: 0;
      bottom: 0;
      width: 450px;
      border-radius: var(--border-radius-large) 0 0 var(--border-radius-large);
    }
  }
  
  // Анимация выезжания
  .panel-slide-enter-active,
  .panel-slide-leave-active {
    transition: all 0.3s ease;
  }
  
  .panel-slide-enter-from {
    &.position-bottom {
      transform: translateY(100%);
    }
    &.position-right {
      transform: translateX(100%);
    }
  }
  
  .panel-slide-leave-to {
    &.position-bottom {
      transform: translateY(100%);
    }
    &.position-right {
      transform: translateX(100%);
    }
  }
  
  // Заголовок панели
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-s) var(--spacing-m);
    border-bottom: 1px solid var(--color-foreground-base);
    background: var(--color-background-light);
    
    .header-left {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
      
      .panel-title {
        font-weight: var(--font-weight-bold);
        color: var(--color-text-dark);
      }
    }
    
    .header-actions {
      display: flex;
      gap: var(--spacing-xs);
    }
  }
  
  // Контент панели
  .panel-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    
    .chat-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      
      .messages-list {
        flex: 1;
        overflow-y: auto;
        padding: var(--spacing-m);
        
        .message {
          display: flex;
          gap: var(--spacing-s);
          margin-bottom: var(--spacing-m);
          
          &-user {
            .message-avatar {
              background: var(--color-primary);
            }
          }
          
          &-assistant {
            .message-avatar {
              background: var(--color-secondary);
            }
          }
          
          .message-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
          }
          
          .message-content {
            flex: 1;
            padding: var(--spacing-s);
            background: var(--color-background-light);
            border-radius: var(--border-radius-base);
          }
        }
      }
    }
    
    .input-container {
      padding: var(--spacing-m);
      border-top: 1px solid var(--color-foreground-base);
      
      .input-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: var(--spacing-xs);
      }
    }
  }
  
  // Футер панели
  .panel-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-xs) var(--spacing-m);
    border-top: 1px solid var(--color-foreground-base);
    background: var(--color-background-light);
  }
}
</style>