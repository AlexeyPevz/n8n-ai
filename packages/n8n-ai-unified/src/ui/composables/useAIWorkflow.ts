/**
 * Composable для управления AI workflow с модальными окнами
 */

import { ref, computed } from 'vue';
import { useAIApi } from './useAIApi';
import type { OperationBatch } from '@n8n-ai/schemas';
import type { Modal, Toast } from '../components/types';
// Modal keys
export const DIFF_PREVIEW_MODAL_KEY = 'diffPreview';
export const SECRETS_WIZARD_MODAL_KEY = 'secretsWizard';

export interface AIWorkflowState {
  // Текущий процесс
  stage: 'idle' | 'planning' | 'reviewing' | 'secrets' | 'applying' | 'complete';
  
  // Данные для модалок
  pendingOperations: OperationBatch | null;
  requiredCredentials: Array<{
    type: string;
    displayName: string;
    description: string;
    node?: string;
    resolved: boolean;
  }>;
  
  // Настройки пользователя
  autoApply: boolean;
  skipSecretsWizard: boolean;
}

export function useAIWorkflow() {
  // В реальной интеграции эти объекты будут из n8n
  const modal: Modal = {
    open: (name: string, data?: any) => {
      console.log('Opening modal:', name, data);
      // Здесь будет реальный вызов n8n modal
    },
    close: (name: string) => {
      console.log('Closing modal:', name);
    }
  };
  
  const toast: Toast = {
    showMessage: (opts) => console.log('Toast:', opts),
    showError: (error, title) => console.error('Error:', title, error)
  };
  
  // Заглушка для workflow store
  const workflowsStore = {
    getCurrentWorkflow: () => ({
      nodes: [],
      connections: []
    }),
    setWorkflow: (workflow: any) => {
      console.log('Setting workflow:', workflow);
    }
  };
  
  const { planWorkflow, applyOperations, validateWorkflow } = useAIApi();
  
  const state = ref<AIWorkflowState>({
    stage: 'idle',
    pendingOperations: null,
    requiredCredentials: [],
    autoApply: false,
    skipSecretsWizard: false,
  });
  
  /**
   * Обработка промпта от пользователя
   */
  const processPrompt = async (prompt: string) => {
    try {
      state.value.stage = 'planning';
      
      // 1. Получаем план от AI
      const planResult = await planWorkflow(prompt);
      
      if (!planResult.operations || planResult.operations.ops.length === 0) {
        toast.showMessage({
          type: 'info',
          title: 'No changes needed',
          message: 'The AI couldn\'t determine any changes for your request.',
        });
        state.value.stage = 'idle';
        return;
      }
      
      state.value.pendingOperations = planResult.operations;
      
      // 2. Если включен auto-apply, пропускаем preview
      if (state.value.autoApply) {
        await applyPendingOperations();
        return;
      }
      
      // 3. Показываем diff preview
      state.value.stage = 'reviewing';
      showDiffPreview(planResult.operations, planResult.explanation);
      
    } catch (error) {
      toast.showError(
        error,
        'Failed to process request'
      );
      state.value.stage = 'idle';
    }
  };
  
  /**
   * Показать модалку с preview изменений
   */
  const showDiffPreview = (operations: OperationBatch, explanation?: string) => {
    const currentWorkflow = workflowsStore.getCurrentWorkflow();
    
    modal.open(DIFF_PREVIEW_MODAL_KEY, {
      operations: operations.ops,
      currentNodes: currentWorkflow.nodes,
      currentConnections: currentWorkflow.connections,
      aiExplanation: explanation,
      onApply: async (data: { operations: any[], rememberChoice: boolean }) => {
        modal.close(DIFF_PREVIEW_MODAL_KEY);
        
        // Запоминаем выбор пользователя
        if (data.rememberChoice) {
          state.value.autoApply = true;
        }
        
        // Применяем операции
        state.value.pendingOperations = { 
          ops: data.operations, 
          version: 'v1' 
        };
        await applyPendingOperations();
      },
      onReject: () => {
        modal.close(DIFF_PREVIEW_MODAL_KEY);
        state.value.stage = 'idle';
        state.value.pendingOperations = null;
        
        toast.showMessage({
          type: 'info',
          title: 'Changes rejected',
          message: 'No changes were applied to your workflow.',
        });
      },
      onModify: () => {
        modal.close(DIFF_PREVIEW_MODAL_KEY);
        // Возвращаемся к AI панели для модификации
        state.value.stage = 'idle';
        
        // Emit событие для показа сообщения в чате
        window.postMessage({
          type: 'ai:modify-requested',
          operations: state.value.pendingOperations,
        }, '*');
      },
    });
  };
  
  /**
   * Применить pending операции
   */
  const applyPendingOperations = async () => {
    if (!state.value.pendingOperations) return;
    
    try {
      state.value.stage = 'applying';
      
      // 1. Валидируем изменения
      const validation = await validateWorkflow(state.value.pendingOperations);
      
      // 2. Проверяем, нужны ли credentials
      const missingCredentials = validation.requiredCredentials?.filter(
        cred => !cred.resolved
      ) || [];
      
      if (missingCredentials.length > 0 && !state.value.skipSecretsWizard) {
        state.value.requiredCredentials = validation.requiredCredentials || [];
        state.value.stage = 'secrets';
        showSecretsWizard();
        return;
      }
      
      // 3. Применяем операции
      const result = await applyOperations(state.value.pendingOperations);
      
      if (result.success) {
        toast.showMessage({
          type: 'success',
          title: 'Workflow updated!',
          message: `Applied ${state.value.pendingOperations.ops.length} changes successfully.`,
        });
        
        // Обновляем canvas
        workflowsStore.setWorkflow(result.workflow);
        
        // Анимация на канвасе для новых нод
        highlightNewNodes(result.addedNodeIds || []);
        
        state.value.stage = 'complete';
        state.value.pendingOperations = null;
        
        // Через 2 секунды возвращаемся в idle
        setTimeout(() => {
          state.value.stage = 'idle';
        }, 2000);
        
      } else {
        throw new Error(result.error || 'Failed to apply changes');
      }
      
    } catch (error) {
      toast.showError(error, 'Failed to apply changes');
      state.value.stage = 'idle';
    }
  };
  
  /**
   * Показать wizard для настройки credentials
   */
  const showSecretsWizard = () => {
    modal.open(SECRETS_WIZARD_MODAL_KEY, {
      requiredCredentials: state.value.requiredCredentials,
      onComplete: async (configuration: any) => {
        modal.close(SECRETS_WIZARD_MODAL_KEY);
        
        // Сохраняем конфигурацию credentials
        await saveCredentialsConfiguration(configuration);
        
        // Продолжаем применение операций
        await applyPendingOperations();
      },
      onSkip: () => {
        modal.close(SECRETS_WIZARD_MODAL_KEY);
        state.value.skipSecretsWizard = true;
        
        toast.showMessage({
          type: 'warning',
          title: 'Credentials skipped',
          message: 'Some nodes may not work without proper credentials.',
        });
        
        // Применяем операции без credentials
        applyPendingOperations();
      },
    });
  };
  
  /**
   * Сохранить конфигурацию credentials
   */
  const saveCredentialsConfiguration = async (config: any) => {
    // Здесь бы был код для сохранения credentials
    console.log('Saving credentials configuration:', config);
    
    // Обновляем resolved статус
    state.value.requiredCredentials = state.value.requiredCredentials.map(cred => ({
      ...cred,
      resolved: !!config.credentials[cred.type],
    }));
  };
  
  /**
   * Подсветить новые ноды на канвасе
   */
  const highlightNewNodes = (nodeIds: string[]) => {
    // Отправляем событие в canvas
    window.postMessage({
      type: 'canvas:highlight-nodes',
      nodeIds,
      animation: 'pulse',
      duration: 2000,
    }, '*');
  };
  
  /**
   * Сбросить состояние
   */
  const reset = () => {
    state.value = {
      stage: 'idle',
      pendingOperations: null,
      requiredCredentials: [],
      autoApply: false,
      skipSecretsWizard: false,
    };
  };
  
  return {
    state: computed(() => state.value),
    isProcessing: computed(() => state.value.stage !== 'idle' && state.value.stage !== 'complete'),
    processPrompt,
    reset,
    
    // Дополнительные методы для управления
    setAutoApply: (value: boolean) => { state.value.autoApply = value; },
    setSkipSecrets: (value: boolean) => { state.value.skipSecretsWizard = value; },
  };
}