/**
 * Простая индексация зависимостей между воркфлоу:
 * - http: если есть HTTP Request с url, указывающим на локальный webhook другого воркфлоу
 * - webhook: если есть Webhook нода с path, на которую может ссылаться другой http
 * - executeWorkflow: резерв для ноды Execute Workflow (здесь эвристика по названию)
 */
export function buildWorkflowMap(workflows, baseWebhookUrl = 'http://localhost:5678/webhook') {
    const edges = [];
    const webhookByPath = new Map();
    for (const wf of workflows) {
        for (const node of wf.nodes) {
            if (node.type === 'n8n-nodes-base.webhook') {
                const path = node.parameters?.path;
                if (path)
                    webhookByPath.set(normalizePath(path), wf.id);
            }
        }
    }
    for (const wf of workflows) {
        for (const node of wf.nodes) {
            if (node.type === 'n8n-nodes-base.httpRequest') {
                const url = node.parameters?.url;
                if (!url)
                    continue;
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
                const targetId = node.parameters?.workflowId;
                if (targetId && targetId !== wf.id) {
                    edges.push({ fromWorkflowId: wf.id, toWorkflowId: targetId, via: 'executeWorkflow' });
                }
            }
        }
    }
    return { edges, updatedAt: Date.now() };
}
function normalizePath(p) {
    return (p || '').trim().replace(/^\//, '');
}
