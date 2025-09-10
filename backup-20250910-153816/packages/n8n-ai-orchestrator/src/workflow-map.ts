import type { WorkflowState } from './graph-manager.js';

export type WorkflowMapEdge = {
  fromWorkflowId: string;
  toWorkflowId: string;
  via: 'executeWorkflow' | 'http' | 'webhook';
  details?: Record<string, unknown>;
};

export interface WorkflowMapIndex {
  edges: WorkflowMapEdge[];
  updatedAt: number;
}

/**
 * Простая индексация зависимостей между воркфлоу:
 * - http: если есть HTTP Request с url, указывающим на локальный webhook другого воркфлоу
 * - webhook: если есть Webhook нода с path, на которую может ссылаться другой http
 * - executeWorkflow: резерв для ноды Execute Workflow (здесь эвристика по названию)
 */
export function buildWorkflowMap(workflows: WorkflowState[], baseWebhookUrl = 'http://localhost:5678/webhook'): WorkflowMapIndex {
  const edges: WorkflowMapEdge[] = [];

  const webhookByPath = new Map<string, string>();
  for (const wf of workflows) {
    for (const node of wf.nodes) {
      if (node.type === 'n8n-nodes-base.webhook') {
        const path = (node.parameters as Record<string, unknown>)?.path as string | undefined;
        if (path) webhookByPath.set(normalizePath(path), wf.id);
      }
    }
  }

  for (const wf of workflows) {
    for (const node of wf.nodes) {
      if (node.type === 'n8n-nodes-base.httpRequest') {
        const url = (node.parameters as Record<string, unknown>)?.url as string | undefined;
        if (!url) continue;
        // эвристика: http → webhook (локальный)
        if (url.startsWith(baseWebhookUrl)) {
          const path = normalizePath(url.replace(baseWebhookUrl, ''));
          const targetWf = webhookByPath.get(path);
          if (targetWf && targetWf !== wf.id) {
            edges.push({ fromWorkflowId: wf.id, toWorkflowId: targetWf, via: 'http', details: { url } });
          }
        }
      }
      // эвристика: Execute Workflow по названию ноды
      if (node.type.includes('executeWorkflow') || node.name.toLowerCase().includes('execute workflow')) {
        // В реальной интеграции нужно читать конкретный ссылочный workflowId из параметров
        const targetId = (node.parameters as Record<string, unknown>)?.workflowId as string | undefined;
        if (targetId && targetId !== wf.id) {
          edges.push({ fromWorkflowId: wf.id, toWorkflowId: targetId, via: 'executeWorkflow' });
        }
      }
    }
  }

  return { edges, updatedAt: Date.now() };
}

function normalizePath(p: string): string {
  return (p || '').trim().replace(/^\//, '');
}

