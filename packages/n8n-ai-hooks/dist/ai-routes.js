/**
 * AI-specific routes для n8n
 */
import { Router } from 'express';
import { introspectAPI } from './introspect-api';
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
            const batch = req.body;
            // TODO: Валидация через схемы
            // TODO: Применение операций к воркфлоу
            res.json({
                success: true,
                workflowId: id,
                appliedOperations: batch.ops.length,
                undoId: `undo_${Date.now()}`
            });
        }
        catch (error) {
            res.status(500).json({
                error: 'Failed to apply batch',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    router.post('/api/v1/ai/graph/:id/validate', async (req, res) => {
        try {
            const { id } = req.params;
            // TODO: Реальная валидация воркфлоу
            res.json({
                valid: true,
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
            res.status(500).json({
                error: 'Failed to validate',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    router.post('/api/v1/ai/graph/:id/simulate', async (req, res) => {
        try {
            const { id } = req.params;
            const { inputData } = req.body;
            // TODO: Реальная симуляция с mock данными
            res.json({
                success: true,
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
            res.status(500).json({
                error: 'Failed to simulate',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
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
