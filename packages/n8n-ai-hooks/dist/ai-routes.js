/**
 * AI-specific routes для n8n
 */
import { Router } from 'express';
import { introspectAPI } from './introspect-api';
import { OperationBatchSchema } from '@n8n-ai/schemas';
// Простейший in-memory стек для Undo по workflowId
const undoStacks = new Map();
export function createAIRoutes() {
    const router = Router();
    // Introspect API endpoints
    router.get('/api/v1/ai/introspect/nodes', (req, res) => {
        try {
            const nodes = introspectAPI.getAllNodes();
            res.json({ nodes });
        }
        catch (error) {
            res.status(500).json({
                error: 'Failed to get nodes',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    router.get('/api/v1/ai/introspect/node/:type', (req, res) => {
        try {
            const { type } = req.params;
            const version = req.query.version ? parseInt(req.query.version) : undefined;
            const node = introspectAPI.getNode(type, version);
            if (!node) {
                return res.status(404).json({
                    error: 'Node not found',
                    type,
                    version
                });
            }
            res.json({ node });
        }
        catch (error) {
            res.status(500).json({
                error: 'Failed to get node',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    router.post('/api/v1/ai/introspect/loadOptions', async (req, res) => {
        try {
            const { nodeType, propertyName, currentNodeParameters } = req.body;
            if (!nodeType || !propertyName) {
                return res.status(400).json({
                    error: 'Missing required fields',
                    required: ['nodeType', 'propertyName']
                });
            }
            const options = await introspectAPI.resolveLoadOptions(nodeType, propertyName, currentNodeParameters || {});
            res.json({ options });
        }
        catch (error) {
            res.status(500).json({
                error: 'Failed to resolve options',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    // Graph Mutation API endpoints (заглушки)
    router.post('/api/v1/ai/graph/:id/batch', async (req, res) => {
        try {
            const { id } = req.params;
            const parsed = OperationBatchSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ ok: false, error: 'invalid_operation_batch', issues: parsed.error.format() });
            }
            const batch = parsed.data;
            // TODO: Применение операций к воркфлоу
            const undoId = `undo_${Date.now()}`;
            const stack = undoStacks.get(id) ?? [];
            stack.push({ undoId, batch });
            undoStacks.set(id, stack);
            return res.json({ ok: true, workflowId: id, appliedOperations: batch.ops.length, undoId });
        }
        catch (error) {
            return res.status(500).json({ ok: false, error: 'failed_to_apply_batch', message: error instanceof Error ? error.message : 'Unknown error' });
        }
    });
    // Undo последнего применённого батча
    router.post('/api/v1/ai/graph/:id/undo', async (req, res) => {
        try {
            const { id } = req.params;
            const { undoId } = (req.body ?? {});
            const stack = undoStacks.get(id) ?? [];
            if (stack.length === 0) {
                return res.status(404).json({ ok: false, error: 'nothing_to_undo' });
            }
            let entry;
            if (undoId) {
                const idx = stack.findIndex((e) => e.undoId === undoId);
                if (idx === -1)
                    return res.status(404).json({ ok: false, error: 'undo_id_not_found' });
                entry = stack.splice(idx, 1)[0];
            }
            else {
                entry = stack.pop();
            }
            undoStacks.set(id, stack);
            const undoneOps = entry?.batch?.ops?.length ?? 0;
            return res.json({ ok: true, workflowId: id, undoneOperations: undoneOps });
        }
        catch (error) {
            return res.status(500).json({ ok: false, error: 'failed_to_undo', message: error instanceof Error ? error.message : 'Unknown error' });
        }
    });
    router.post('/api/v1/ai/graph/:id/validate', async (req, res) => {
        try {
            const { id } = req.params;
            // TODO: Реальная валидация воркфлоу
            return res.json({
                ok: true,
                lints: [
                    {
                        code: 'no_error_handling',
                        level: 'warn',
                        message: 'Consider adding error handling to HTTP Request node',
                        node: 'HTTP Request'
                    }
                ]
            });
        }
        catch (error) {
            return res.status(500).json({ ok: false, error: 'failed_to_validate', message: error instanceof Error ? error.message : 'Unknown error' });
        }
    });
    router.post('/api/v1/ai/graph/:id/simulate', async (req, res) => {
        try {
            const { id } = req.params;
            const { inputData } = req.body;
            // TODO: Реальная симуляция с mock данными
            return res.json({
                ok: true,
                stats: {
                    nodesVisited: 3,
                    estimatedDurationMs: 1500,
                    dataShapes: {
                        'HTTP Request': {
                            output: [{ id: 'number', name: 'string', email: 'string' }]
                        }
                    }
                }
            });
        }
        catch (error) {
            return res.status(500).json({ ok: false, error: 'failed_to_simulate', message: error instanceof Error ? error.message : 'Unknown error' });
        }
    });
    // Health check
    router.get('/api/v1/ai/health', (req, res) => {
        res.json({
            status: 'ok',
            version: '0.1.0',
            apis: ['introspect', 'graph', 'validate', 'simulate']
        });
    });
    return router;
}
