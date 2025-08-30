/**
 * AI-specific routes для n8n
 */

import { Router } from 'express';
import { introspectAPI } from './introspect-api';
import { loadBuiltinNodes } from './load-builtin-nodes';
import type { Request, Response, NextFunction } from 'express';

// Инициализируем introspect API с встроенными нодами
const builtinNodes = loadBuiltinNodes();
introspectAPI.registerNodeTypes(builtinNodes);

// Простейший in-memory стек для Undo по workflowId
const undoStacks: Map<string, Array<{ undoId: string; batch: unknown }>> = new Map();

export function createAIRoutes(): Router {
  const router = Router();

  // --- Security: simple token auth and basic rate limit ---
  const API_TOKEN = process.env.N8N_AI_API_TOKEN;
  const rateWindowMs = Number(process.env.N8N_AI_RATELIMIT_WINDOW_MS ?? 15000);
  const rateMax = Number(process.env.N8N_AI_RATELIMIT_MAX ?? 60);
  const rateBuckets = new Map<string, { count: number; resetAt: number }>();

  const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    if (!API_TOKEN) return next();
    const header = req.header('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (token === API_TOKEN) return next();
    res.status(401).json({ error: 'unauthorized' });
  };

  const rateLimitMiddleware = (req: Request, res: Response, next: NextFunction): void => {
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

  router.use(authMiddleware);
  router.use(rateLimitMiddleware);

  // Introspect API endpoints
  router.get('/api/v1/ai/introspect/nodes', (req, res) => {
    try {
      const nodes = introspectAPI.getAllNodes();
      res.json({ nodes });
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to get nodes',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  router.get('/api/v1/ai/introspect/node/:type', (req, res) => {
    try {
      const { type } = req.params;
      const version = req.query.version ? parseInt(req.query.version as string) : undefined;
      
      const node = introspectAPI.getNode(type, version);
      
      if (!node) {
        return res.status(404).json({ 
          error: 'Node not found',
          type,
          version 
        });
      }
      
      res.json({ node });
    } catch (error) {
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

      const ifNoneMatch = req.headers['if-none-match'] as string | undefined;
      const result = await introspectAPI.resolveLoadOptionsCached(
        nodeType,
        propertyName,
        currentNodeParameters || {},
        ifNoneMatch
      );

      res.setHeader('ETag', result.etag);
      res.setHeader('Cache-Control', `public, max-age=${Math.floor(result.cacheTtlMs / 1000)}`);
      res.setHeader('Expires', new Date(result.expiresAt).toUTCString());

      if (result.notModified) {
        return res.status(304).end();
      }

      res.json({ options: result.options, etag: result.etag, fromCache: result.fromCache });
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to resolve options',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Внешняя интеграция: endpoint для установки внешнего резолвера (dev-only)
  // Примечание: В реальном n8n это делается через прямой вызов API из Server.ts, а не HTTP.
  if (process.env.NODE_ENV !== 'production') {
    router.post('/api/v1/ai/__dev/setLoadOptionsResolver', async (req, res) => {
      // Ожидаем, что в dev окружении сюда можно прокинуть функцию через require hook, но по HTTP
      // Здесь заглушка: endpoint оставлен как напоминание, реально использовать прямой вызов setExternalLoadOptionsResolver.
      res.json({ ok: true, note: 'Use introspectAPI.setExternalLoadOptionsResolver from n8n core' });
    });
  }

  // Graph Mutation API endpoints (заглушки)
  router.post('/api/v1/ai/graph/:id/batch', async (req, res) => {
    try {
      const { id } = req.params;
      // Ленивая валидация через @n8n-ai/schemas, если пакет доступен
      let parsed: { success: boolean; data: unknown; error?: { format: () => unknown } } = { success: true, data: req.body };
      try {
        const mod = await import('@n8n-ai/schemas');
        parsed = (mod as unknown as { OperationBatchSchema: { safeParse: (v: unknown) => typeof parsed } }).OperationBatchSchema.safeParse(req.body);
      } catch {
        // fallback: пропускаем строгую валидацию в окружениях без пакета схем
      }
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: 'invalid_operation_batch', issues: parsed.error.format() });
      }
      const batch = parsed.data;

      // Попытка прокси в оркестратор, если он доступен (временная интеграция до нативной н8н)
      try {
        const orchBase = process.env.N8N_AI_ORCHESTRATOR_URL || 'http://localhost:3000';
        const r = await fetch(`${orchBase}/graph/${id}/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batch)
        });
        const json = await r.json();
        return res.status(r.status).json(json);
      } catch (e) {
        // fallback: in-memory undo стек как раньше
        const undoId = `undo_${Date.now()}`;
        const stack = undoStacks.get(id) ?? [];
        stack.push({ undoId, batch });
        undoStacks.set(id, stack);
        return res.json({ ok: true, workflowId: id, appliedOperations: batch.ops.length, undoId, note: 'fallback_in_memory' });
      }
    } catch (error) {
      return res.status(500).json({ ok: false, error: 'failed_to_apply_batch', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Undo последнего применённого батча
  router.post('/api/v1/ai/graph/:id/undo', async (req, res) => {
    try {
      const { id } = req.params;
      const { undoId } = (req.body ?? {}) as { undoId?: string };
      const stack = undoStacks.get(id) ?? [];
      if (stack.length === 0) {
        return res.status(404).json({ ok: false, error: 'nothing_to_undo' });
      }
      let entry: { undoId: string; batch: any } | undefined;
      if (undoId) {
        const idx = stack.findIndex((e) => e.undoId === undoId);
        if (idx === -1) return res.status(404).json({ ok: false, error: 'undo_id_not_found' });
        entry = stack.splice(idx, 1)[0];
      } else {
        entry = stack.pop();
      }
      undoStacks.set(id, stack);
      const undoneOps = entry?.batch?.ops?.length ?? 0;
      return res.json({ ok: true, workflowId: id, undoneOperations: undoneOps });
    } catch (error) {
      return res.status(500).json({ ok: false, error: 'failed_to_undo', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  router.post('/api/v1/ai/graph/:id/validate', async (req, res) => {
    try {
      const { id } = req.params;
      const orchBase = process.env.N8N_AI_ORCHESTRATOR_URL || 'http://localhost:3000';
      const r = await fetch(`${orchBase}/graph/${id}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body ?? {})
      });
      const json = await r.json();
      return res.status(r.status).json(json);
    } catch (error) {
      return res.status(500).json({ ok: false, error: 'failed_to_validate', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  router.post('/api/v1/ai/graph/:id/simulate', async (req, res) => {
    try {
      const { id } = req.params;
      const orchBase = process.env.N8N_AI_ORCHESTRATOR_URL || 'http://localhost:3000';
      const r = await fetch(`${orchBase}/graph/${id}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body ?? {})
      });
      const json = await r.json();
      return res.status(r.status).json(json);
    } catch (error) {
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