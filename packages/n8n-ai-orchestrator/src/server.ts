import Fastify from 'fastify';
import cors from '@fastify/cors';
import { OperationBatchSchema } from '@n8n-ai/schemas';
import { SimplePlanner } from './planner.js';
import { patternMatcher } from './pattern-matcher.js';
import { graphManager } from './graph-manager.js';
import { metrics, METRICS } from './metrics.js';
import { handleError, errorToResponse, ValidationError, NotFoundError } from './error-handler.js';
import { randomUUID } from 'node:crypto';

const server = Fastify({ logger: true });

// Корреляция запросов: request-id
server.addHook('onRequest', (req, reply, done) => {
  const headerId = req.headers['x-request-id'];
  const reqId = (Array.isArray(headerId) ? headerId[0] : headerId) || randomUUID();
  (req as unknown as { requestId?: string }).requestId = reqId;
  reply.header('x-request-id', reqId);
  done();
});

// Метрики по каждому запросу
server.addHook('onResponse', (req, reply, done) => {
  try {
    metrics.increment(METRICS.API_REQUESTS, { endpoint: req.url, method: req.method, status: String(reply.statusCode) });
    // измерение длительности на уровне сервера (Fastify имеет req.startTime, но безопасно возьмём diff по timings)
    const start = (req as unknown as { startTime?: number }).startTime;
    if (typeof start === 'number') {
      metrics.recordDuration(METRICS.API_DURATION, Date.now() - start, { endpoint: req.url, method: req.method, status: String(reply.statusCode) });
    }
  } finally {
    done();
  }
});

server.addHook('onRequest', (req, _reply, done) => {
  (req as unknown as { startTime?: number }).startTime = Date.now();
  done();
});

// Тolerant JSON parser: treat empty body as {}
server.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  try {
    if (!body || (typeof body === 'string' && body.trim() === '')) {
      done(null, {});
      return;
    }
    const parsed = typeof body === 'string' ? JSON.parse(body) : body;
    done(null, parsed);
  } catch (err) {
    done(err as Error);
  }
});

await server.register(cors, { origin: true });

// Global error handler
server.setErrorHandler((error, request, reply) => {
  const appError = handleError(error);
  metrics.increment(METRICS.API_REQUESTS, { endpoint: request.url, status: 'error' });
  
  reply.status(appError.statusCode).send(errorToResponse(appError));
});

// Health endpoint
server.get('/api/v1/ai/health', async () => ({ status: 'ok', ts: Date.now() }));

// Metrics endpoint
server.get('/api/v1/ai/metrics', async () => {
  return metrics.getMetrics();
});

// Простой прокси для n8n-ai-hooks Introspect API
server.get('/introspect/nodes', async () => {
  // Пытаемся проксировать в n8n-ai-hooks, если доступен
  const hooksBase = process.env.N8N_URL ?? 'http://localhost:5678';
  try {
    const resp = await fetch(`${hooksBase}/api/v1/ai/introspect/nodes`);
    if (resp.ok) {
      const data = (await resp.json()) as unknown;
      const nodes = Array.isArray(data) ? data : ((data as { nodes?: unknown }).nodes ?? []);
      if (Array.isArray(nodes) && nodes.length > 0) return nodes;
    }
  } catch (e) {
    server.log.warn({ error: e }, 'Hooks introspect not available, falling back to static list');
  }

  // Фолбэк: статический список основных нод для MVP
  return [
    {
      name: 'HTTP Request',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4,
      parameters: {
        method: { enum: ['GET', 'POST', 'PUT', 'DELETE'] },
        url: { type: 'string', required: true },
        authentication: { enum: ['none', 'basicAuth', 'headerAuth', 'oAuth2'] },
        responseFormat: { enum: ['json', 'text', 'binary'] }
      }
    },
    {
      name: 'Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 1,
      parameters: {
        httpMethod: { enum: ['GET', 'POST', 'PUT', 'DELETE'] },
        path: { type: 'string', required: true }
      }
    },
    {
      name: 'Schedule Trigger',
      type: 'n8n-nodes-base.scheduleTrigger',
      typeVersion: 1,
      parameters: {
        rule: { type: 'object' }
      }
    },
    {
      name: 'Manual Trigger',
      type: 'n8n-nodes-base.manualTrigger',
      typeVersion: 1,
      parameters: {}
    },
    {
      name: 'Code',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      parameters: {
        language: { enum: ['javaScript', 'python'] },
        jsCode: { type: 'string' }
      }
    },
    {
      name: 'Set',
      type: 'n8n-nodes-base.set',
      typeVersion: 1,
      parameters: {
        keepOnlySet: { type: 'boolean' },
        values: { type: 'collection' }
      }
    }
  ];
});

const planner = new SimplePlanner();

server.post<{ Body: { prompt?: string } }>('/plan', async (req) => {
  return metrics.measureAsync(METRICS.API_DURATION, async () => {
    metrics.increment(METRICS.API_REQUESTS, { endpoint: 'plan' });
    
    const prompt = req.body?.prompt ?? '';
    
    if (!prompt) {
      throw new ValidationError('prompt is required');
    }
    
    try {
      const batch = await planner.plan({ prompt });
      const parsed = OperationBatchSchema.safeParse(batch);
      if (!parsed.success) {
        server.log.error({ prompt, issues: parsed.error.format() }, 'Generated plan failed schema validation');
        metrics.increment(METRICS.VALIDATION_ERRORS, { type: 'plan' });
        throw new ValidationError('invalid_generated_operation_batch', parsed.error.format());
      }
      
      metrics.increment(METRICS.PLAN_OPERATIONS, { count: String(parsed.data.ops.length) });
      server.log.info({ prompt, operationsCount: parsed.data.ops.length }, 'Plan created');
      return parsed.data;
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      
      server.log.error({ error, prompt }, 'Planning failed');
      throw error;
    }
  }, { endpoint: 'plan' });
});

// Тестовый endpoint: сбросить всё состояние
server.post('/__test/reset', async () => {
  graphManager.resetAll();
  return { ok: true };
});

server.post<{
  Params: { id: string };
  Body: unknown;
}>('/graph/:id/batch', async (req) => {
  const { id: workflowId } = req.params;
  
  // Авто-создание воркфлоу, если он отсутствует
  if (!graphManager.getWorkflow(workflowId)) {
    graphManager.createWorkflow(workflowId, `Workflow ${workflowId}`);
  }

  const parsed = OperationBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return { ok: false, error: 'invalid_operation_batch', issues: parsed.error.format() };
  }
  
  // Применяем операции через GraphManager
  const result = graphManager.applyBatch(workflowId, parsed.data);
  
  if (result.success) {
    // После применения проверяем валидацию; при ошибках откатываем
    const validation = graphManager.validate(workflowId);
    const hasErrors = validation.lints.some(l => l.level === 'error');
    if (hasErrors) {
      const undone = graphManager.undo(workflowId, result.undoId);
      server.log.warn({ workflowId, lints: validation.lints, undone }, 'Validation failed; operations rolled back');
      return {
        ok: false,
        error: 'validation_failed',
        lints: validation.lints
      };
    }

    server.log.info({ 
      workflowId, 
      appliedOperations: result.appliedOperations,
      undoId: result.undoId 
    }, 'Operations applied successfully');
    
    return { 
      ok: true, 
      undoId: result.undoId,
      appliedOperations: result.appliedOperations
    };
  } else {
    server.log.error({ workflowId, error: result.error }, 'Failed to apply operations');
    return { 
      ok: false, 
      error: result.error 
    };
  }
});

server.post<{ Params: { id: string } }>('/graph/:id/validate', async (req) => {
  const { id: workflowId } = req.params;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const autofix = url.searchParams.get('autofix') === '1';
  const validationResult = graphManager.validate(workflowId, { autofix });
  
  return {
    ok: validationResult.valid,
    lints: validationResult.lints
  };
});

server.post<{ Params: { id: string } }>('/graph/:id/simulate', async (req) => {
  const { id: workflowId } = req.params;
  
  const simulationResult = graphManager.simulate(workflowId);
  
  return simulationResult;
});

// Critic v1: запускает валидацию с автофиксами и возвращает отчёт
server.post<{ Params: { id: string } }>('/graph/:id/critic', async (req) => {
  const { id: workflowId } = req.params;
  const validationBefore = graphManager.validate(workflowId);
  const autofixed = graphManager.validate(workflowId, { autofix: true });
  return {
    ok: autofixed.valid,
    before: validationBefore,
    after: autofixed
  };
});

server.post<{ 
  Params: { id: string };
  Body: { undoId?: string };
}>('/graph/:id/undo', async (req) => {
  const { id: workflowId } = req.params;
  const { undoId } = req.body || {};
  
  const result = graphManager.undo(workflowId, undoId);
  
  if (result.success) {
    server.log.info({ workflowId, undoId: result.undoId }, 'Undo successful');
    return { 
      ok: true, 
      undoId: result.undoId,
      undoneOperations: result.appliedOperations
    };
  } else {
    return { ok: false, error: result.error };
  }
});

server.post<{ Params: { id: string } }>('/graph/:id/redo', async (req) => {
  const { id: workflowId } = req.params;
  
  const result = graphManager.redo(workflowId);
  
  if (result.success) {
    server.log.info({ workflowId }, 'Redo successful');
    return { 
      ok: true,
      redoneOperations: result.appliedOperations
    };
  } else {
    return { ok: false, error: result.error };
  }
});

// Endpoint для получения текущего состояния воркфлоу
server.get<{ Params: { id: string } }>('/graph/:id', async (req) => {
  const { id: workflowId } = req.params;
  
  const workflow = graphManager.getWorkflow(workflowId);
  
  if (workflow) {
    return { ok: true, workflow };
  } else {
    return { ok: false, error: 'Workflow not found' };
  }
});

server.get('/patterns', async () => {
  const categories = patternMatcher.getCategories();
  return {
    categories,
    totalPatterns: patternMatcher['patterns'].length,
    examples: categories.slice(0, 5).map(cat => ({
      category: cat,
      patterns: patternMatcher.suggestByCategory(cat).slice(0, 3).map(p => ({
        name: p.name,
        keywords: p.keywords,
        nodeCount: p.nodes.length
      }))
    }))
  };
});

server.post<{ Body: { prompt: string, category?: string } }>('/suggest', async (req) => {
  const { prompt, category } = req.body;
  
  if (category) {
    const patterns = patternMatcher.suggestByCategory(category);
    return {
      category,
      patterns: patterns.map(p => ({
        name: p.name,
        description: `Workflow with ${p.nodes.length} nodes: ${p.nodes.map(n => n.name).join(' → ')}`
      }))
    };
  }
  
  const matches = patternMatcher.findMatchingPatterns(prompt);
  return {
    prompt,
    suggestions: matches.slice(0, 5).map(m => ({
      pattern: m.pattern.name,
      score: m.score,
      matchedKeywords: m.matchedKeywords,
      preview: m.pattern.nodes.map(n => n.name).join(' → ')
    }))
  };
});

server.get('/events', async (req, reply) => {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  const send = (event: string, data: unknown) => {
    reply.raw.write(`event: ${event}\n`);
    reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  send('hello', { sequenceId: 1, ts: Date.now() });
  let progress = 0;
  const interval = setInterval(() => {
    send('heartbeat', { ts: Date.now() });
    progress = (progress + 10) % 100;
    send('build_progress', { ts: Date.now(), progress });
  }, 15000);
  req.raw.on('close', () => clearInterval(interval));
  return reply;
});

async function start() {
  let port = Number(process.env.PORT ?? 3000);
  try {
    await server.listen({ port, host: '0.0.0.0' });
  } catch (err: unknown) {
    const e = err as { code?: string } | undefined;
    if (e?.code === 'EADDRINUSE') {
      server.log.warn({ port }, 'Port in use, retrying on 0');
      port = 0;
      await server.listen({ port, host: '0.0.0.0' });
    } else {
      server.log.error(err as Error);
      process.exit(1);
    }
  }
}

// Export for testing
export { server };

// Start only if not imported
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
