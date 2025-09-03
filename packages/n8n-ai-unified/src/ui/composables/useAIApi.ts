/**
 * API клиент для AI функций
 */

// Local copy of OperationBatch type to decouple from workspace path mapping
type OperationBatch = { version: string; ops: Array<any> };

const API_BASE = '/api/v1/ai';

export interface PlanResult {
  operations: OperationBatch;
  explanation?: string;
}

export interface ValidationResult {
  valid: boolean;
  lints: Array<{
    code: string;
    level: 'info' | 'warn' | 'error';
    message: string;
    node?: string;
  }>;
  requiredCredentials?: Array<{
    type: string;
    displayName: string;
    description: string;
    node?: string;
    resolved: boolean;
  }>;
}

export interface ApplyResult {
  success: boolean;
  workflow?: any;
  addedNodeIds?: string[];
  error?: string;
}

export function useAIApi() {
  /**
   * Получить план операций от AI
   */
  const planWorkflow = async (prompt: string): Promise<PlanResult> => {
    const response = await fetch(`${API_BASE}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to plan workflow: ${response.statusText}`);
    }
    
    return response.json();
  };
  
  /**
   * Валидировать workflow с операциями
   */
  const validateWorkflow = async (operations: OperationBatch): Promise<ValidationResult> => {
    const workflowId = getCurrentWorkflowId();
    
    const response = await fetch(`${API_BASE}/graph/${workflowId}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(operations),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to validate workflow: ${response.statusText}`);
    }
    
    return response.json();
  };
  
  /**
   * Применить операции к workflow
   */
  const applyOperations = async (operations: OperationBatch): Promise<ApplyResult> => {
    const workflowId = getCurrentWorkflowId();
    
    const response = await fetch(`${API_BASE}/graph/${workflowId}/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(operations),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to apply operations: ${error}`);
    }
    
    const result = await response.json();
    
    // Определяем какие ноды были добавлены
    const addedNodeIds = (operations.ops || [])
      .filter((op: any) => op.op === 'add_node')
      .map((op: any) => op.node?.id)
      .filter(Boolean);
    
    return {
      success: result.success,
      workflow: result.updatedState,
      addedNodeIds,
      error: result.error,
    };
  };
  
  /**
   * Получить текущий ID workflow
   */
  const getCurrentWorkflowId = (): string => {
    // В реальной интеграции это будет из n8n store
    // Пока используем demo
    return 'demo';
  };
  
  return {
    planWorkflow,
    validateWorkflow,
    applyOperations,
  };
}