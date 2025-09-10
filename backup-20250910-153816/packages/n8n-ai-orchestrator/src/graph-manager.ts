/**
 * Менеджер графов воркфлоу
 * Управляет состоянием воркфлоу и применением операций
 */

import type { 
  OperationBatch, 
  Node} from '@n8n-ai/schemas';
import { 
  Graph,
  NodeSchema,
  ConnectionSchema,
  OperationBatchSchema 
} from '@n8n-ai/schemas';

export interface WorkflowState {
  id: string;
  name: string;
  nodes: Node[];
  connections: Array<{ from: string; to: string; index?: number }>;
  version: number;
  lastModified: Date;
}

export interface ApplyResult {
  success: boolean;
  undoId?: string;
  appliedOperations?: number;
  error?: string;
  updatedState?: WorkflowState;
}

export interface ValidationResult {
  valid: boolean;
  lints: Array<{
    code: string;
    level: 'info' | 'warn' | 'error';
    message: string;
    node?: string;
  }>;
}

export class GraphManager {
  private workflows: Map<string, WorkflowState> = new Map();
  private undoStacks: Map<string, Array<{ undoId: string; previousState: WorkflowState; batch: OperationBatch }>> = new Map();
  private redoStacks: Map<string, Array<{ undoId: string; nextState: WorkflowState; batch: OperationBatch }>> = new Map();

  constructor() {
    // Инициализируем с дефолтным воркфлоу для демо
    this.createWorkflow('demo', 'Demo Workflow');
  }

  /**
   * Возвращает список всех воркфлоу (для индекса и обзора)
   */
  listWorkflows(): WorkflowState[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Сбрасывает всё состояние (для тестов)
   */
  resetAll(): void {
    this.workflows.clear();
    this.undoStacks.clear();
    this.redoStacks.clear();
    this.createWorkflow('demo', 'Demo Workflow');
  }

  /**
   * Создает новый воркфлоу
   */
  createWorkflow(id: string, name: string): WorkflowState {
    const workflow: WorkflowState = {
      id,
      name,
      nodes: [
        {
          id: 'manual-trigger',
          name: 'Manual Trigger',
          type: 'n8n-nodes-base.manualTrigger',
          typeVersion: 1,
          position: [250, 300],
          parameters: {}
        }
      ],
      connections: [],
      version: 1,
      lastModified: new Date()
    };

    this.workflows.set(id, workflow);
    this.undoStacks.set(id, []);
    this.redoStacks.set(id, []);

    return workflow;
  }

  /**
   * Получает текущее состояние воркфлоу
   */
  getWorkflow(id: string): WorkflowState | null {
    return this.workflows.get(id) || null;
  }

  /**
   * Применяет батч операций к воркфлоу
   */
  applyBatch(workflowId: string, batch: OperationBatch): ApplyResult {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return { success: false, error: 'Workflow not found' };
    }

    // Валидируем батч
    const parseResult = OperationBatchSchema.safeParse(batch);
    if (!parseResult.success) {
      return { 
        success: false, 
        error: 'Invalid operation batch',
      };
    }

    // Создаем копию текущего состояния для undo
    const previousState = JSON.parse(JSON.stringify(workflow));
    
    try {
      // Применяем операции
      let appliedCount = 0;
      for (const op of batch.ops) {
        switch (op.op) {
          case 'add_node': {
            // Проверяем, не существует ли уже нода с таким id
            if (workflow.nodes.find(n => n.id === op.node.id)) {
              throw new Error(`Node with id ${op.node.id} already exists`);
            }
            
            // Валидируем ноду
            const nodeResult = NodeSchema.safeParse(op.node);
            if (!nodeResult.success) {
              throw new Error(`Invalid node: ${nodeResult.error.message}`);
            }
            
            workflow.nodes.push(op.node);
            appliedCount++;
            break;
          }

          case 'connect': {
            // Проверяем существование нод
            const fromNode = workflow.nodes.find(n => n.name === op.from || n.id === op.from);
            const toNode = workflow.nodes.find(n => n.name === op.to || n.id === op.to);
            
            if (!fromNode) {
              throw new Error(`Source node "${op.from}" not found`);
            }
            if (!toNode) {
              throw new Error(`Target node "${op.to}" not found`);
            }
            
            // Проверяем, не существует ли уже такое соединение
            const existingConnection = workflow.connections.find(
              c => c.from === op.from && c.to === op.to && c.index === (op.index ?? 0)
            );
            
            if (!existingConnection) {
              workflow.connections.push({
                from: op.from,
                to: op.to,
                index: op.index
              });
              appliedCount++;
            }
            break;
          }

          case 'set_params': {
            const node = workflow.nodes.find(n => n.name === op.name || n.id === op.name);
            if (!node) {
              throw new Error(`Node "${op.name}" not found`);
            }
            
            // Мержим параметры
            node.parameters = {
              ...node.parameters,
              ...op.parameters
            };
            appliedCount++;
            break;
          }

          case 'delete': {
            const nodeIndex = workflow.nodes.findIndex(n => n.name === op.name || n.id === op.name);
            if (nodeIndex === -1) {
              throw new Error(`Node "${op.name}" not found`);
            }
            
            const nodeId = workflow.nodes[nodeIndex].id;
            const nodeName = workflow.nodes[nodeIndex].name;
            
            // Удаляем ноду
            workflow.nodes.splice(nodeIndex, 1);
            
            // Удаляем все связи с этой нодой
            workflow.connections = workflow.connections.filter(
              c => c.from !== nodeName && c.to !== nodeName && 
                  c.from !== nodeId && c.to !== nodeId
            );
            
            appliedCount++;
            break;
          }

          case 'annotate': {
            // Аннотации пока просто логируем
            // Annotation applied
            appliedCount++;
            break;
          }
        }
      }

      // Обновляем версию и время модификации
      workflow.version++;
      workflow.lastModified = new Date();

      // Сохраняем в undo стек
      const undoId = `undo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const undoStack = this.undoStacks.get(workflowId) || [];
      undoStack.push({ undoId, previousState, batch });
      this.undoStacks.set(workflowId, undoStack);

      // Очищаем redo стек при новой операции
      this.redoStacks.set(workflowId, []);

      return {
        success: true,
        undoId,
        appliedOperations: appliedCount,
        updatedState: workflow
      };

    } catch (error) {
      // Восстанавливаем предыдущее состояние при ошибке
      this.workflows.set(workflowId, previousState);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Отменяет последнюю операцию
   */
  undo(workflowId: string, undoId?: string): ApplyResult {
    const undoStack = this.undoStacks.get(workflowId) || [];
    if (undoStack.length === 0) {
      return { success: false, error: 'Nothing to undo' };
    }

    let undoItem;
    if (undoId) {
      // Ищем конкретную операцию
      const index = undoStack.findIndex(item => item.undoId === undoId);
      if (index === -1) {
        return { success: false, error: 'Undo operation not found' };
      }
      undoItem = undoStack.splice(index, 1)[0];
    } else {
      // Берем последнюю операцию
      undoItem = undoStack.pop()!;
    }

    const currentState = this.workflows.get(workflowId);
    if (!currentState) {
      return { success: false, error: 'Workflow not found' };
    }

    // Сохраняем текущее состояние в redo стек
    const redoStack = this.redoStacks.get(workflowId) || [];
    redoStack.push({ 
      undoId: undoItem.undoId, 
      nextState: JSON.parse(JSON.stringify(currentState)), 
      batch: undoItem.batch 
    });
    this.redoStacks.set(workflowId, redoStack);

    // Восстанавливаем предыдущее состояние
    this.workflows.set(workflowId, undoItem.previousState);

    return {
      success: true,
      undoId: undoItem.undoId,
      appliedOperations: undoItem.batch.ops.length,
      updatedState: undoItem.previousState
    };
  }

  /**
   * Повторяет отмененную операцию
   */
  redo(workflowId: string): ApplyResult {
    const redoStack = this.redoStacks.get(workflowId) || [];
    if (redoStack.length === 0) {
      return { success: false, error: 'Nothing to redo' };
    }

    const redoItem = redoStack.pop()!;
    
    // Применяем батч снова
    const result = this.applyBatch(workflowId, redoItem.batch);
    
    // Удаляем из undo стека, чтобы не дублировать
    if (result.success && result.undoId) {
      const undoStack = this.undoStacks.get(workflowId) || [];
      const lastUndo = undoStack[undoStack.length - 1];
      if (lastUndo && lastUndo.undoId === result.undoId) {
        undoStack.pop();
      }
    }

    return result;
  }

  /**
   * Возвращает список замечаний по воркфлоу
   */
  private computeLints(workflow: WorkflowState): ValidationResult['lints'] {
    const lints: ValidationResult['lints'] = [];

    // Проверка 1: Есть ли триггер
    const hasTrigger = workflow.nodes.some((n) => n.type.includes('Trigger') || n.type.includes('webhook'));
    if (!hasTrigger) {
      lints.push({ code: 'missing_trigger', level: 'warn', message: 'Workflow has no trigger node' });
    }

    // Проверка 2: Подключенность
    for (const node of workflow.nodes) {
      if (node.type.includes('Trigger') || node.type.includes('webhook')) continue;
      const hasIncoming = workflow.connections.some((c) => c.to === node.name || c.to === node.id);
      if (!hasIncoming) {
        lints.push({ code: 'unconnected_node', level: 'warn', message: `Node "${node.name}" has no incoming connections`, node: node.name });
      }
      const hasOutgoing = workflow.connections.some((c) => c.from === node.name || c.from === node.id);
      if (!hasOutgoing) {
        lints.push({ code: 'dangling_branch', level: 'warn', message: `Node "${node.name}" has no outgoing connections`, node: node.name });
      }
    }

    // Проверка 3: Обязательные/enum
    for (const node of workflow.nodes) {
      if (node.type === 'n8n-nodes-base.httpRequest') {
        if (!node.parameters.url) {
          lints.push({ code: 'missing_required_param', level: 'error', message: `Node "${node.name}" is missing required parameter "url"`, node: node.name });
        }
        const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
        const method = (node.parameters as Record<string, unknown>)?.method as string | undefined;
        if (method && !allowedMethods.includes(method)) {
          lints.push({ code: 'invalid_enum', level: 'error', message: `Node "${node.name}" has invalid method "${method}"`, node: node.name });
        }
        const allowedFormats = ['json', 'text', 'binary'];
        const responseFormat = (node.parameters as Record<string, unknown>)?.responseFormat as string | undefined;
        if (responseFormat && !allowedFormats.includes(responseFormat)) {
          lints.push({ code: 'invalid_enum', level: 'error', message: `Node "${node.name}" has invalid responseFormat "${responseFormat}"`, node: node.name });
        }
      }
      if (node.type === 'n8n-nodes-base.webhook') {
        if (!node.parameters.path) {
          lints.push({ code: 'missing_required_param', level: 'error', message: `Node "${node.name}" is missing required parameter "path"`, node: node.name });
        }
      }
    }

    // Проверка 4: Циклы
    if (this.hasCycles(workflow)) {
      lints.push({ code: 'circular_dependency', level: 'error', message: 'Workflow contains circular dependencies' });
    }

    return lints;
  }

  /**
   * Автофикс базовых ошибок (enum/required) для MVP
   */
  private applyAutoFixes(workflow: WorkflowState): void {
    for (const node of workflow.nodes) {
      if (node.type === 'n8n-nodes-base.httpRequest') {
        const params = node.parameters as Record<string, unknown>;
        if (!params.url) params.url = 'https://example.com';
        const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
        const method = params.method as string | undefined;
        if (method && !allowedMethods.includes(method)) params.method = 'GET';
        const allowedFormats = ['json', 'text', 'binary'];
        const responseFormat = params.responseFormat as string | undefined;
        if (responseFormat && !allowedFormats.includes(responseFormat)) params.responseFormat = 'json';
      }
      if (node.type === 'n8n-nodes-base.webhook') {
        const params = node.parameters as Record<string, unknown>;
        if (!params.path) params.path = 'webhook-endpoint';
      }
    }
  }

  /**
   * Валидирует воркфлоу. При autofix=true пытается автоматически исправить базовые ошибки.
   */
  validate(workflowId: string, options?: { autofix?: boolean }): ValidationResult {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return { valid: false, lints: [{ code: 'workflow_not_found', level: 'error', message: 'Workflow not found' }] };
    }

    if (options?.autofix) {
      this.applyAutoFixes(workflow);
    }

    const lints = this.computeLints(workflow);
    return { valid: lints.filter((l) => l.level === 'error').length === 0, lints };
  }

  /**
   * Проверяет наличие циклов в графе
   */
  private hasCycles(workflow: WorkflowState): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      // Находим все исходящие соединения
      const outgoing = workflow.connections.filter(c => 
        c.from === nodeId || 
        workflow.nodes.find(n => n.id === nodeId)?.name === c.from
      );

      for (const conn of outgoing) {
        const targetNode = workflow.nodes.find(n => 
          n.id === conn.to || n.name === conn.to
        );
        
        if (!targetNode) continue;
        
        const targetId = targetNode.id;
        
        if (!visited.has(targetId)) {
          if (dfs(targetId)) return true;
        } else if (recursionStack.has(targetId)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of workflow.nodes) {
      if (!visited.has(node.id)) {
        if (dfs(node.id)) return true;
      }
    }

    return false;
  }

  /**
   * Симулирует выполнение воркфлоу
   */
  simulate(workflowId: string, _mockData?: Record<string, unknown>): {
    ok: boolean;
    stats?: {
      nodesVisited: number;
      estimatedDurationMs: number;
      p95DurationMs: number;
      dataFlow: Array<{ node: string; outputSize: number }>;
      dataShapes?: Record<string, { output?: Array<Record<string, string>> }>;
      warnings?: Array<{ code: string; message: string; node?: string }>;
    };
    error?: string;
  } {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return { ok: false, error: 'Workflow not found' };
    }

    const validation = this.validate(workflowId);
    if (!validation.valid) {
      return { ok: false, error: 'Workflow validation failed' };
    }

    // Простая симуляция - подсчитываем количество нод и оцениваем время
    const nodesVisited = workflow.nodes.length;
    const estimatedDurationMs = nodesVisited * 150; // 150ms на ноду в среднем
    const p95DurationMs = Math.round(estimatedDurationMs * 1.5);
    
    const dataFlow = workflow.nodes.map(node => ({
      node: node.name,
      outputSize: Math.floor(Math.random() * 1000) + 100 // Mock размер данных
    }));

    // Простейший синтез форм данных на основе типа ноды
    const dataShapes: Record<string, { output?: Array<Record<string, string>> }> = {};
    for (const node of workflow.nodes) {
      if (node.type === 'n8n-nodes-base.httpRequest') {
        dataShapes[node.name] = {
          output: [{ id: 'number', name: 'string', email: 'string' }]
        };
      } else if (node.type === 'n8n-nodes-base.webhook') {
        dataShapes[node.name] = {
          output: [{ body: 'object', headers: 'object', query: 'object' }]
        };
      } else if (node.type === 'n8n-nodes-base.code') {
        dataShapes[node.name] = {
          output: [{ result: 'any' }]
        };
      }
    }

    return {
      ok: true,
      stats: {
        nodesVisited,
        estimatedDurationMs,
        p95DurationMs,
        dataFlow,
        dataShapes,
        warnings: validation.lints.filter((l) => l.level === 'warn').map((l) => ({ code: l.code, message: l.message, node: l.node }))
      }
    };
  }
}

// Экспортируем singleton
export const graphManager = new GraphManager();