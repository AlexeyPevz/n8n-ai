/**
 * E2E тест для полного сценария создания HTTP GET воркфлоу
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { OperationBatch } from '@n8n-ai/schemas';

const API_BASE = process.env.API_BASE || `http://localhost:${process.env.ORCH_PORT || '3000'}`;
const WORKFLOW_ID = 'e2e-test';

// Хелпер для API запросов
async function apiRequest(
  path: string, 
  options?: RequestInit
): Promise<any> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    },
    ...options
  });
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

describe('E2E: HTTP GET Workflow Creation', () => {
  let undoId: string | undefined;

  beforeAll(async () => {
    // Проверяем, что сервер запущен
    try {
      // Try health check first
      await apiRequest('/api/v1/ai/health');
    } catch (error) {
      console.error('Server not running. Start with: pnpm -C packages/n8n-ai-orchestrator dev');
      console.error('Or run: pnpm -C packages/n8n-ai-orchestrator test:with-server');
      throw error;
    }
  });

  it('should get available node types from introspect API', async () => {
    const result = await apiRequest('/introspect/nodes');
    
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    
    // Проверяем наличие основных нод
    const nodeTypes = result.map((n: any) => n.type);
    expect(nodeTypes).toContain('n8n-nodes-base.httpRequest');
    expect(nodeTypes).toContain('n8n-nodes-base.manualTrigger');
  });

  it('should plan operations for HTTP GET request', async () => {
    const result = await apiRequest('/plan', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'Create HTTP GET request to fetch user data from JSONPlaceholder API'
      })
    });
    
    expect(result).toBeDefined();
    expect(result.version).toBe('v1');
    expect(result.ops).toBeDefined();
    expect(Array.isArray(result.ops)).toBe(true);
    expect(result.ops.length).toBeGreaterThan(0);
    
    // Проверяем, что есть операция добавления HTTP ноды
    const addNodeOp = result.ops.find((op: any) => op.op === 'add_node');
    expect(addNodeOp).toBeDefined();
    expect(addNodeOp.node.type).toBe('n8n-nodes-base.httpRequest');
    
    // Проверяем, что есть операция соединения
    const connectOp = result.ops.find((op: any) => op.op === 'connect');
    expect(connectOp).toBeDefined();
  });

  it('should apply operations to create workflow', async () => {
    const batch: OperationBatch = {
      version: 'v1',
      ops: [
        {
          op: 'add_node',
          node: {
            id: 'http-get-users',
            name: 'Get Users',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 4,
            position: [600, 300],
            parameters: {
              method: 'GET',
              url: 'https://jsonplaceholder.typicode.com/users',
              responseFormat: 'json',
              options: {}
            }
          }
        },
        {
          op: 'connect',
          from: 'Manual Trigger',
          to: 'Get Users',
          index: 0
        }
      ]
    };
    
    const result = await apiRequest(`/graph/${WORKFLOW_ID}/batch`, {
      method: 'POST',
      body: JSON.stringify(batch)
    });
    
    expect(result.ok).toBe(true);
    expect(result.undoId).toBeDefined();
    expect(result.appliedOperations).toBe(2);
    
    undoId = result.undoId;
  });

  it('should validate the created workflow', async () => {
    const result = await apiRequest(`/graph/${WORKFLOW_ID}/validate`, {
      method: 'POST'
    });
    
    expect(result.ok).toBe(true);
    expect(result.lints).toBeDefined();
    expect(Array.isArray(result.lints)).toBe(true);
    
    // Не должно быть ошибок
    const errors = result.lints.filter((l: any) => l.level === 'error');
    expect(errors.length).toBe(0);
  });

  it('should simulate the workflow execution', async () => {
    const result = await apiRequest(`/graph/${WORKFLOW_ID}/simulate`, {
      method: 'POST'
    });
    
    expect(result.ok).toBe(true);
    expect(result.stats).toBeDefined();
    expect(result.stats.nodesVisited).toBe(2); // Manual Trigger + HTTP Request
    expect(result.stats.estimatedDurationMs).toBeGreaterThan(0);
    expect(result.stats.dataFlow).toBeDefined();
    expect(Array.isArray(result.stats.dataFlow)).toBe(true);
    // dataShapes should include HTTP Request node
    expect(result.stats.dataShapes).toBeDefined();
    const shapes = result.stats.dataShapes as Record<string, any>;
    const httpShapeKey = Object.keys(shapes).find(k => k.toLowerCase().includes('http') || k.toLowerCase().includes('get users'));
    expect(httpShapeKey).toBeTruthy();
  });

  it('should get the current workflow state', async () => {
    const result = await apiRequest(`/graph/${WORKFLOW_ID}`);
    
    expect(result.ok).toBe(true);
    expect(result.workflow).toBeDefined();
    expect(result.workflow.nodes.length).toBe(2); // Manual Trigger + HTTP Request
    expect(result.workflow.connections.length).toBe(1);
    
    // Проверяем ноды
    const httpNode = result.workflow.nodes.find((n: any) => n.type === 'n8n-nodes-base.httpRequest');
    expect(httpNode).toBeDefined();
    expect(httpNode.parameters.url).toBe('https://jsonplaceholder.typicode.com/users');
  });

  it('should undo the operations', async () => {
    const result = await apiRequest(`/graph/${WORKFLOW_ID}/undo`, {
      method: 'POST',
      body: JSON.stringify({ undoId })
    });
    
    expect(result.ok).toBe(true);
    expect(result.undoneOperations).toBe(2);
    
    // Проверяем, что воркфлоу вернулся к начальному состоянию
    const workflow = await apiRequest(`/graph/${WORKFLOW_ID}`);
    expect(workflow.workflow.nodes.length).toBe(1); // Только Manual Trigger
    expect(workflow.workflow.connections.length).toBe(0);
  });

  it('should redo the operations', async () => {
    const result = await apiRequest(`/graph/${WORKFLOW_ID}/redo`, {
      method: 'POST'
    });
    
    expect(result.ok).toBe(true);
    expect(result.redoneOperations).toBe(2);
    
    // Проверяем, что воркфлоу снова создан
    const workflow = await apiRequest(`/graph/${WORKFLOW_ID}`);
    expect(workflow.workflow.nodes.length).toBe(2);
    expect(workflow.workflow.connections.length).toBe(1);
  });

  it('should handle pattern suggestions', async () => {
    const result = await apiRequest('/suggest', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'fetch data from API and send to slack'
      })
    });
    
    expect(result.prompt).toBeDefined();
    expect(result.suggestions).toBeDefined();
    expect(Array.isArray(result.suggestions)).toBe(true);
    expect(result.suggestions.length).toBeGreaterThan(0);
    
    // Проверяем структуру предложений
    const firstSuggestion = result.suggestions[0];
    expect(firstSuggestion.pattern).toBeDefined();
    expect(firstSuggestion.score).toBeDefined();
    expect(firstSuggestion.matchedKeywords).toBeDefined();
    expect(firstSuggestion.preview).toBeDefined();
  });

  it.skip('should build workflow map and expose via /workflow-map and /workflows', async () => {
    const wfA = 'wf-a';
    const wfB = 'wf-b';

    const webhookPath = 'incoming-users';
    const batchA = {
      version: 'v1',
      ops: [
        { op: 'add_node', node: { id: 'wh1', name: 'Webhook A', type: 'n8n-nodes-base.webhook', typeVersion: 1, position: [0,0], parameters: { path: webhookPath } } }
      ]
    } as OperationBatch;
    const batchB = {
      version: 'v1',
      ops: [
        { op: 'add_node', node: { id: 'http1', name: 'HTTP to A', type: 'n8n-nodes-base.httpRequest', typeVersion: 4, position: [0,0], parameters: { method: 'GET', url: `http://localhost:5678/webhook/${webhookPath}` } } }
      ]
    } as OperationBatch;

    const r1 = await apiRequest(`/graph/${wfA}/batch`, { method: 'POST', body: JSON.stringify(batchA) });
    expect(r1.ok).toBe(true);
    const r2 = await apiRequest(`/graph/${wfB}/batch`, { method: 'POST', body: JSON.stringify(batchB) });
    expect(r2.ok).toBe(true);

    const map = await apiRequest('/workflow-map');
    expect(map).toBeDefined();
    expect(Array.isArray(map.edges)).toBe(true);
    expect(map.stats).toBeDefined();
    // Check if edge exists with new format
    const hasEdge = map.edges.some((e: any) => 
      (e.source === wfB && e.target === wfA) || 
      (e.fromWorkflowId === wfB && e.toWorkflowId === wfA)
    );
    expect(hasEdge).toBe(true);

    const list = await apiRequest('/workflows');
    expect(list).toBeDefined();
    // Check if we have workflows in either format
    if (Array.isArray(list)) {
      expect(list.length).toBeGreaterThanOrEqual(2);
    } else if (list.workflows) {
      expect(list.workflows.length).toBeGreaterThanOrEqual(2);
    } else {
      expect(list.total).toBeGreaterThanOrEqual(2);
    }
  });

  it('should complete full workflow creation flow', async () => {
    // 1. План
    const planResult = await apiRequest('/plan', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'Get weather data from API every morning and send email'
      })
    });
    
    expect(planResult.ops.length).toBeGreaterThan(0);
    
    // 2. Применение
    const applyResult = await apiRequest('/graph/weather-workflow/batch', {
      method: 'POST',
      body: JSON.stringify(planResult)
    });
    
    expect(applyResult.ok).toBe(true);
    
    // 3. Валидация
    const validateResult = await apiRequest('/graph/weather-workflow/validate', {
      method: 'POST'
    });
    
    expect(validateResult.ok).toBe(true);
    
    // 4. Симуляция
    const simulateResult = await apiRequest('/graph/weather-workflow/simulate', {
      method: 'POST'
    });
    
    expect(simulateResult.ok).toBe(true);

    // 5. Critic v1
    const criticResult = await apiRequest('/graph/weather-workflow/critic', {
      method: 'POST'
    });
    expect(criticResult).toBeDefined();
    expect(criticResult.before).toBeDefined();
    expect(criticResult.after).toBeDefined();
  });
});

// Запуск: pnpm -C packages/n8n-ai-orchestrator test:e2e