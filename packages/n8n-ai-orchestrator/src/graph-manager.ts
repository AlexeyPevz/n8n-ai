/**
 * Менеджер графов воркфлоу
 * Управляет состоянием воркфлоу и применением операций
 */

import { 
  OperationBatch, 
  Node, 
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
            console.log(`Annotation for ${op.name}: ${op.text}`);
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
   * Валидирует воркфлоу
   */
  validate(workflowId: string): ValidationResult {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return {
        valid: false,
        lints: [{
          code: 'workflow_not_found',
          level: 'error',
          message: 'Workflow not found'
        }]
      };
    }

    const lints: ValidationResult['lints'] = [];

    // Проверка 1: Есть ли триггер
    const hasTrigger = workflow.nodes.some(n => 
      n.type.includes('Trigger') || n.type.includes('webhook')
    );
    
    if (!hasTrigger) {
      lints.push({
        code: 'missing_trigger',
        level: 'warn',
        message: 'Workflow has no trigger node'
      });
    }

    // Проверка 2: Все ли ноды подключены
    for (const node of workflow.nodes) {
      // Пропускаем триггеры - они могут не иметь входящих соединений
      if (node.type.includes('Trigger') || node.type.includes('webhook')) {
        continue;
      }

      const hasIncoming = workflow.connections.some(c => 
        c.to === node.name || c.to === node.id
      );
      
      if (!hasIncoming) {
        lints.push({
          code: 'unconnected_node',
          level: 'warn',
          message: `Node "${node.name}" has no incoming connections`,
          node: node.name
        });
      }
    }

    // Проверка 3: Обязательные параметры
    for (const node of workflow.nodes) {
      // Проверяем HTTP Request ноды
      if (node.type === 'n8n-nodes-base.httpRequest') {
        if (!node.parameters.url) {
          lints.push({
            code: 'missing_required_param',
            level: 'error',
            message: `Node "${node.name}" is missing required parameter "url"`,
            node: node.name
          });
        }
      }
      
      // Проверяем Webhook ноды
      if (node.type === 'n8n-nodes-base.webhook') {
        if (!node.parameters.path) {
          lints.push({
            code: 'missing_required_param',
            level: 'error',
            message: `Node "${node.name}" is missing required parameter "path"`,
            node: node.name
          });
        }
      }
    }

    // Проверка 4: Циклические зависимости
    if (this.hasCycles(workflow)) {
      lints.push({
        code: 'circular_dependency',
        level: 'error',
        message: 'Workflow contains circular dependencies'
      });
    }

    return {
      valid: lints.filter(l => l.level === 'error').length === 0,
      lints
    };
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
  simulate(workflowId: string, mockData?: any): {
    ok: boolean;
    stats?: {
      nodesVisited: number;
      estimatedDurationMs: number;
      dataFlow: Array<{ node: string; outputSize: number }>;
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
    
    const dataFlow = workflow.nodes.map(node => ({
      node: node.name,
      outputSize: Math.floor(Math.random() * 1000) + 100 // Mock размер данных
    }));

    return {
      ok: true,
      stats: {
        nodesVisited,
        estimatedDurationMs,
        dataFlow
      }
    };
  }
}

// Экспортируем singleton
export const graphManager = new GraphManager();