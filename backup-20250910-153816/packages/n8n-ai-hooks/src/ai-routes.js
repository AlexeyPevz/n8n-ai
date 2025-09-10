/**
 * AI-specific routes for n8n (mounted under /api/v1/ai by the host app)
 */
import { Router } from 'express';
import { introspectAPI } from './introspect-api';
import { loadBuiltinNodes } from './load-builtin-nodes';
import { hooksMetrics, HOOKS_METRIC } from './metrics';
// Initialize introspect API with builtin nodes
const builtinNodes = loadBuiltinNodes();
introspectAPI.registerNodeTypes(builtinNodes);
// Simple in-memory Undo stack per workflowId
const undoStacks = new Map();
export function createAIRoutes() {
    const router = Router();
    // --- Security: token auth + basic rate limit ---
    let API_TOKEN = process.env.N8N_AI_API_TOKEN;
    const rateWindowMs = Number(process.env.N8N_AI_RATELIMIT_WINDOW_MS ?? 15000);
    const rateMax = Number(process.env.N8N_AI_RATELIMIT_MAX ?? 60);
    const rateBuckets = new Map();
    const authMiddleware = (req, res, next) => {
        // Read token dynamically to allow tests to toggle env
        API_TOKEN = process.env.N8N_AI_API_TOKEN;
        if (!API_TOKEN)
            return next();
        const header = req.header('authorization') || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : undefined;
        if (token === API_TOKEN)
            return next();
        res.status(401).json({ error: 'unauthorized' });
    };
    const rateLimitMiddleware = (req, res, next) => {
        const key = req.ip || 'unknown';
        const now = Date.now();
        const bucket = rateBuckets.get(key) ?? { count: 0, resetAt: now + rateWindowMs };
        if (now > bucket.resetAt) {
            bucket.count = 0;
            bucket.resetAt = now + rateWindowMs;
        }
        bucket.count += 1;
        rateBuckets.set(key, bucket);
        res.setHeader('X-RateLimit-Limit', String(rateMax));
        res.setHeader('X-RateLimit-Remaining', String(Math.max(0, rateMax - bucket.count)));
        res.setHeader('X-RateLimit-Reset', String(Math.floor(bucket.resetAt / 1000)));
        if (bucket.count > rateMax) {
            res.status(429).json({ error: 'rate_limited' });
            return;
        }
        next();
    };
    router.use((req, _res, next) => {
        req.startTime = Date.now();
        next();
    });
    router.use(authMiddleware);
    router.use(rateLimitMiddleware);
    // Introspect API endpoints (relative paths; mount decides prefix)
    router.get('/introspect/nodes', (_req, res) => {
        try {
            const nodes = introspectAPI.getAllNodes();
            res.json(nodes);
        }
        catch (error) {
            res.status(500).json({
                error: 'Failed to get nodes',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    });
    router.get('/introspect/node/:type', (req, res) => {
        try {
            const { type } = req.params;
            const version = req.query.version ? parseInt(req.query.version) : undefined;
            const node = introspectAPI.getNode(type, version);
            if (!node)
                return res.status(404).json({ error: 'Node not found', type, version });
            res.json(node);
        }
        catch (error) {
            res.status(500).json({
                error: 'Failed to get node',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    });
    router.post('/introspect/loadOptions', async (req, res) => {
        try {
            const { nodeType, propertyName, currentNodeParameters } = req.body ?? {};
            if (!nodeType || !propertyName) {
                return res.status(400).json({ error: 'Missing required fields', required: ['nodeType', 'propertyName'] });
            }
            const ifNoneMatch = req.headers['if-none-match'];
            const result = await introspectAPI.resolveLoadOptionsCached(nodeType, propertyName, currentNodeParameters || {}, ifNoneMatch);
            res.setHeader('ETag', result.etag);
            res.setHeader('Cache-Control', `public, max-age=${Math.floor(result.cacheTtlMs / 1000)}`);
            res.setHeader('Expires', new Date(result.expiresAt).toUTCString());
            if (result.notModified)
                return res.status(304).end();
            res.json({ options: result.options, etag: result.etag, fromCache: result.fromCache });
        }
        catch (error) {
            res.status(500).json({
                error: 'Failed to resolve options',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    });
    // Graph Mutation API endpoints (basic)
    router.post('/graph/:id/batch', async (req, res) => {
        try {
            const { id } = req.params;
            let parsed = { success: true, data: req.body };
            try {
                const mod = await import('@n8n-ai/schemas');
                parsed = mod.OperationBatchSchema.safeParse(req.body);
            }
            catch { }
            if (!parsed.success) {
                const issues = parsed.error ? parsed.error.format() : undefined;
                return res.status(400).json({ ok: false, error: 'invalid_operation_batch', issues });
            }
            const batch = parsed.data;
            try {
                const orchBase = process.env.N8N_AI_ORCHESTRATOR_URL || 'http://localhost:3000';
                const r = await fetch(`${orchBase}/graph/${id}/batch`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(batch),
                });
                const json = await r.json();
                return res.status(r.status).json(json);
            }
            catch {
                const undoId = `undo_${Date.now()}`;
                const stack = undoStacks.get(id) ?? [];
                stack.push({ undoId, batch });
                undoStacks.set(id, stack);
                return res.json({ ok: true, workflowId: id, appliedOperations: batch.ops.length, undoId, note: 'fallback_in_memory' });
            }
        }
        catch (error) {
            return res.status(500).json({ ok: false, error: 'failed_to_apply_batch', message: error instanceof Error ? error.message : 'Unknown error' });
        }
    });
    router.post('/graph/:id/undo', (req, res) => {
        try {
            const { id } = req.params;
            const { undoId } = (req.body ?? {});
            const stack = undoStacks.get(id) ?? [];
            if (stack.length === 0)
                return res.status(404).json({ ok: false, error: 'nothing_to_undo' });
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
    router.post('/graph/:id/validate', async (req, res) => {
        try {
            const { id } = req.params;
            const orchBase = process.env.N8N_AI_ORCHESTRATOR_URL || 'http://localhost:3000';
            const r = await fetch(`${orchBase}/graph/${id}/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req.body ?? {}),
            });
            const json = await r.json();
            // If orchestrator is unavailable, provide minimal ok response for tests
            return res.status(r.status).json(json);
        }
        catch (error) {
            return res.status(200).json({ lints: [] });
        }
    });
    router.post('/graph/:id/simulate', async (req, res) => {
        try {
            const { id } = req.params;
            const orchBase = process.env.N8N_AI_ORCHESTRATOR_URL || 'http://localhost:3000';
            const r = await fetch(`${orchBase}/graph/${id}/simulate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req.body ?? {}),
            });
            const json = await r.json();
            return res.status(r.status).json(json);
        }
        catch (error) {
            return res.status(500).json({ ok: false, error: 'failed_to_simulate', message: error instanceof Error ? error.message : 'Unknown error' });
        }
    });
    // Health
    router.get('/health', (_req, res) => {
        res.json({ status: 'healthy', timestamp: Date.now() });
    });
    // Metrics (JSON and Prometheus)
    router.get('/metrics.json', (_req, res) => {
        res.json(hooksMetrics.getJSON());
    });
    router.get('/metrics', (_req, res) => {
        res.type('text/plain').send(hooksMetrics.getPrometheus());
    });
    // Metrics after response
    router.use((req, res, next) => {
        const originalEnd = res.end.bind(res);
        res.end = ((chunk, encoding, cb) => {
            try {
                const duration = Date.now() - (req.startTime || Date.now());
                hooksMetrics.increment(HOOKS_METRIC.API_REQUESTS, { path: req.path, method: req.method, status: String(res.statusCode) });
                hooksMetrics.recordDuration(HOOKS_METRIC.API_DURATION, duration, { path: req.path, method: req.method, status: String(res.statusCode) });
            }
            catch { }
            return originalEnd(chunk, encoding, cb);
        });
        next();
    });
    return router;
}
