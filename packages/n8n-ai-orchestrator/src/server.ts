import Fastify from 'fastify';
import cors from '@fastify/cors';
import { OperationBatchSchema } from '@n8n-ai/schemas';
import { SimplePlanner } from './planner.js';
import { patternMatcher } from './pattern-matcher.js';
import { graphManager } from './graph-manager.js';
import { metrics, METRICS } from './metrics.js';
import { buildWorkflowMap, type WorkflowMapIndex } from './workflow-map.js';
import { handleError, errorToResponse, ValidationError, ValidationFailedError, NotFoundError, AmbiguousPromptError } from './error-handler.js';
import { randomUUID } from 'node:crypto';

const server = Fastify({ logger: true });

// --- SSE clients registry ---
const sseClients = new Set<import('node:http').ServerResponse>();
function sendSse(event: string, data: unknown): void {
  for (const res of sseClients) {
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch {
      // drop broken client
      try { sseClients.delete(res); } catch {}
    }
  }
}

// Simple fetch with timeout and retries for proxying to n8n hooks
async function fetchWithRetry(url: string, init: any = {}): Promise<any> {
  const retries = Math.max(0, Number(process.env.HOOKS_FETCH_RETRIES ?? 2));
  const timeoutMs = Math.max(1, Number(init.timeoutMs ?? process.env.HOOKS_FETCH_TIMEOUT_MS ?? 3000));

  const attempt = async (): Promise<any> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { ...init, signal: controller.signal });
      return resp;
    } finally {
      clearTimeout(timer);
    }
  };

  let lastError: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      const resp = await attempt();
      if (resp.ok) return resp;
      lastError = new Error(`HTTP ${resp.status}`);
    } catch (e) {
      lastError = e;
    }
    // exponential backoff: 200ms, 400ms, 800ms ...
    const backoff = 200 * Math.pow(2, i);
    await new Promise((r) => setTimeout(r, backoff));
  }
  throw lastError instanceof Error ? lastError : new Error('Unknown fetch error');
}

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

await server.register(cors, { origin: true, credentials: true });

// Global error handler
server.setErrorHandler((error, request, reply) => {
  const appError = handleError(error);
  metrics.increment(METRICS.API_REQUESTS, { endpoint: request.url, status: 'error' });
  server.log.error({ code: appError.code, details: appError.details }, 'API error');
  try { sendSse('api_error', { code: appError.code, url: request.url, details: appError.details }); } catch {}
  reply.status(appError.statusCode).send(errorToResponse(appError));
});

// Health endpoint
server.get('/api/v1/ai/health', async () => ({ status: 'ok', ts: Date.now() }));

// Metrics endpoint
server.get('/api/v1/ai/metrics', async () => {
  return metrics.getMetrics();
});

// Простой прокси для n8n-ai-hooks Introspect API (с пробросом auth заголовков)
function pickForwardHeaders(h: import('fastify').FastifyRequest['headers']): Record<string, string> {
  const out: Record<string, string> = { Accept: 'application/json' };
  const allow = ['authorization', 'cookie', 'x-session-token', 'x-xsrf-token'];
  for (const key of allow) {
    const val = h[key as keyof typeof h];
    if (!val) continue;
    out[key] = Array.isArray(val) ? val.join('; ') : String(val);
  }
  return out;
}

server.get('/introspect/nodes', async (req) => {
  // Пытаемся проксировать в n8n-ai-hooks, если доступен
  const hooksBase = process.env.N8N_URL ?? 'http://localhost:5678';
  try {
    const headers = pickForwardHeaders(req.headers);
    const resp = await fetchWithRetry(`${hooksBase}/api/v1/ai/introspect/nodes`, { timeoutMs: 2500, headers });
    const data = (await resp.json()) as unknown;
    const nodes = Array.isArray(data) ? data : ((data as { nodes?: unknown }).nodes ?? []);
    if (Array.isArray(nodes) && nodes.length > 0) return nodes;
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
    if (!prompt || prompt.trim().length < 3) {
      throw new AmbiguousPromptError('Prompt is empty or too vague', {
        suggestion: 'Уточните задачу: например, "Сделай HTTP GET на https://api.example.com и выведи JSON"',
        nextActions: ['ask_clarifying_question']
      });
    }
    
    try {
      const batch = await planner.plan({ prompt });
      const parsed = OperationBatchSchema.safeParse(batch);
      if (!parsed.success) {
        server.log.error({ prompt, issues: parsed.error.format() }, 'Generated plan failed schema validation');
        metrics.increment(METRICS.VALIDATION_ERRORS, { type: 'plan' });
        const payload = {
          lints: parsed.error.format(),
          suggestion: 'Попробую авто‑исправить через Critic',
          nextActions: ['critic_autofix']
        } as const;
        try { sendSse('plan_validation_failed', payload); } catch {}
        throw new ValidationFailedError('invalid_generated_operation_batch', payload);
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
    try {
      // rebuild workflow map on changes
      workflowMapIndex = buildWorkflowMap(graphManager.listWorkflows(), process.env.N8N_WEBHOOK_BASE);
      sendSse('workflow_map_updated', { updatedAt: workflowMapIndex.updatedAt, edges: workflowMapIndex.edges.length });
    } catch {}
    
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

  // Optional proxy to hooks if enabled
  const useHooks = (process.env.USE_HOOKS_VALIDATE === '1' || process.env.USE_HOOKS === '1');
  const incomingOrigin = req.headers['x-ai-origin'];
  if (useHooks && incomingOrigin !== 'hooks') {
    try {
      const hooksBase = process.env.N8N_URL ?? 'http://localhost:5678';
      const headers = { ...pickForwardHeaders(req.headers), 'x-ai-origin': 'orchestrator' };
      const resp = await fetchWithRetry(`${hooksBase}/api/v1/ai/graph/${encodeURIComponent(workflowId)}/validate${autofix ? '?autofix=1' : ''}`, {
        method: 'POST',
        headers,
        timeoutMs: 3000,
        body: JSON.stringify(req.body ?? {})
      });
      const json = await resp.json();
      if (resp.ok) return json;
      server.log.warn({ status: resp.status, body: json }, 'Hooks validate returned non-200, falling back to local');
    } catch (e) {
      server.log.warn({ error: e }, 'Hooks validate failed, falling back to local');
    }
  }

  const validationResult = graphManager.validate(workflowId, { autofix });
  return {
    ok: validationResult.valid,
    lints: validationResult.lints
  };
});

server.post<{ Params: { id: string } }>('/graph/:id/simulate', async (req) => {
  const { id: workflowId } = req.params;

  // Optional proxy to hooks if enabled
  const useHooks = (process.env.USE_HOOKS_SIMULATE === '1' || process.env.USE_HOOKS === '1');
  const incomingOrigin = req.headers['x-ai-origin'];
  if (useHooks && incomingOrigin !== 'hooks') {
    try {
      const hooksBase = process.env.N8N_URL ?? 'http://localhost:5678';
      const headers = { ...pickForwardHeaders(req.headers), 'x-ai-origin': 'orchestrator' };
      const resp = await fetchWithRetry(`${hooksBase}/api/v1/ai/graph/${encodeURIComponent(workflowId)}/simulate`, {
        method: 'POST',
        headers,
        timeoutMs: 3000,
        body: JSON.stringify(req.body ?? {})
      });
      const json = await resp.json();
      if (resp.ok) return json;
      server.log.warn({ status: resp.status, body: json }, 'Hooks simulate returned non-200, falling back to local');
    } catch (e) {
      server.log.warn({ error: e }, 'Hooks simulate failed, falling back to local');
    }
  }

  const simulationResult = graphManager.simulate(workflowId);
  return simulationResult;
});

// Critic: попытка авто‑исправления на основе текущего состояния (и опционально переданного батча)
server.post<{
  Params: { id: string };
  Body: { batch?: unknown; lints?: unknown };
}>('/graph/:id/critic', async (req) => {
  const { id: workflowId } = req.params;
  const { batch } = req.body || {};

  // Опционально применяем переданный батч, если он есть
  let appliedUndoId: string | undefined;
  if (batch) {
    const parsed = OperationBatchSchema.safeParse(batch);
    if (!parsed.success) {
      return { ok: false, error: 'invalid_operation_batch', issues: parsed.error.format() };
    }
    const applied = graphManager.applyBatch(workflowId, parsed.data);
    if (!applied.success) {
      return { ok: false, error: applied.error };
    }
    appliedUndoId = applied.undoId;
  }

  // Запускаем цикл авто‑исправления
  const maxTries = Math.max(1, Number(process.env.CRITIC_MAX_TRIES ?? 2));
  const before = graphManager.validate(workflowId);
  let current = before;
  let tries = 0;
  while (!current.valid && tries < maxTries) {
    tries++;
    current = graphManager.validate(workflowId, { autofix: true });
    if (current.valid) break;
  }

  if (current.valid) {
    return { ok: true, tried: tries, before, after: current, undoIdApplied: appliedUndoId };
  }

  // Если не удалось исправить: при наличии применённого батча попробуем откатить
  if (appliedUndoId) {
    graphManager.undo(workflowId, appliedUndoId);
  }
  return { ok: false, tried: tries, before, after: current, error: 'critic_unable_to_fix' };
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
    try {
      workflowMapIndex = buildWorkflowMap(graphManager.listWorkflows(), process.env.N8N_WEBHOOK_BASE);
      sendSse('workflow_map_updated', { updatedAt: workflowMapIndex.updatedAt, edges: workflowMapIndex.edges.length });
    } catch {}
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
    try {
      workflowMapIndex = buildWorkflowMap(graphManager.listWorkflows(), process.env.N8N_WEBHOOK_BASE);
      sendSse('workflow_map_updated', { updatedAt: workflowMapIndex.updatedAt, edges: workflowMapIndex.edges.length });
    } catch {}
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

// List workflows overview
server.get('/workflows', async () => {
  const list = graphManager.listWorkflows().map(w => ({
    id: w.id,
    name: w.name,
    nodes: w.nodes.length,
    connections: w.connections.length,
    version: w.version,
    lastModified: w.lastModified
  }));
  return { ok: true, total: list.length, items: list };
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

// --- Workflow Map: in-memory index, refreshed on changes ---
let workflowMapIndex: WorkflowMapIndex = { edges: [], updatedAt: Date.now() };

server.get('/workflow-map', async () => {
  return { ok: true, edges: workflowMapIndex.edges, updatedAt: workflowMapIndex.updatedAt };
});

server.get('/workflow-map/live', async (_req, reply) => {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  const send = (event: string, data: unknown) => {
    try {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch {}
  };
  const summarize = () => {
    // простая синтетика статусов и стоимости
    const items = graphManager.listWorkflows().map(w => ({
      id: w.id,
      name: w.name,
      status: 'idle' as const,
      estimatedCostCents: Math.max(1, Math.min(50, w.nodes.length * 5))
    }));
    return { ts: Date.now(), edges: workflowMapIndex.edges.length, workflows: items };
  };
  send('hello', { ts: Date.now(), kind: 'workflow-map' });
  const interval = setInterval(() => send('live', summarize()), 20000);
  _req.raw.on('close', () => clearInterval(interval));
  return reply;
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
  sseClients.add(reply.raw);
  const send = (event: string, data: unknown) => {
    try {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch {}
  };
  send('hello', { sequenceId: 1, ts: Date.now() });
  let progress = 0;
  const interval = setInterval(() => {
    send('heartbeat', { ts: Date.now() });
    progress = (progress + 10) % 100;
    send('build_progress', { ts: Date.now(), progress });
  }, 15000);
  req.raw.on('close', () => { clearInterval(interval); try { sseClients.delete(reply.raw); } catch {} });
  return reply;
});

// Prometheus metrics endpoint
server.get('/metrics', async () => {
  const snapshot = metrics.getMetrics();
  const lines: string[] = [];
  for (const [k, v] of Object.entries(snapshot.counters)) {
    lines.push(`# TYPE ${k.replace(/\{.*\}$/,'')} counter`);
    lines.push(`${k} ${v}`);
  }
  for (const [k, h] of Object.entries(snapshot.histograms)) {
    const base = k.replace(/\{.*\}$/,'');
    lines.push(`# TYPE ${base}_count gauge`);
    lines.push(`${k}_count ${h.count}`);
    lines.push(`# TYPE ${base}_p50 gauge`);
    lines.push(`${k}_p50 ${h.p50}`);
    lines.push(`# TYPE ${base}_p95 gauge`);
    lines.push(`${k}_p95 ${h.p95}`);
    lines.push(`# TYPE ${base}_p99 gauge`);
    lines.push(`${k}_p99 ${h.p99}`);
  }
  return lines.join('\n') + '\n';
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

// --- n8n-style REST aliases for upstream compatibility ---
// Helper to alias non-streaming endpoints via internal inject
async function proxyTo(targetUrl: string, method: 'GET' | 'POST', req: any, reply: any) {
  const params = (req.params || {}) as Record<string, string>;
  let url = targetUrl;
  // replace :id and other simple params
  for (const [k, v] of Object.entries(params)) {
    url = url.replace(`:${k}`, encodeURIComponent(String(v)));
  }
  const injected = await server.inject({
    method,
    url,
    payload: method === 'POST' ? (req.body ?? undefined) : undefined,
    headers: req.headers as Record<string, string>
  });
  reply.code(injected.statusCode);
  // Copy minimal headers
  for (const [h, v] of Object.entries(injected.headers)) {
    if (typeof v === 'string') reply.header(h, v);
  }
  try {
    return reply.send(injected.body);
  } catch {
    return reply.send(injected.payload);
  }
}

// Health / Metrics
server.get('/rest/ai/health', async (req, reply) => proxyTo('/api/v1/ai/health', 'GET', req, reply));
server.get('/rest/ai/metrics', async (req, reply) => proxyTo('/api/v1/ai/metrics', 'GET', req, reply));

// Introspect
server.get('/rest/ai/introspect/nodes', async (req, reply) => proxyTo('/introspect/nodes', 'GET', req, reply));

// Planner
server.post('/rest/ai/plan', async (req, reply) => proxyTo('/plan', 'POST', req, reply));

// Graph operations
server.post('/rest/ai/graph/:id/batch', async (req, reply) => {
  // Pre-validate OperationBatch and enforce 400
  const parsed = OperationBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    reply.code(400);
    return reply.send({ ok: false, error: 'invalid_operation_batch', issues: parsed.error.format() });
  }
  return proxyTo('/graph/:id/batch', 'POST', req, reply);
});
server.post('/rest/ai/graph/:id/validate', async (req, reply) => proxyTo('/graph/:id/validate', 'POST', req, reply));
server.post('/rest/ai/graph/:id/simulate', async (req, reply) => proxyTo('/graph/:id/simulate', 'POST', req, reply));
server.post('/rest/ai/graph/:id/critic', async (req, reply) => proxyTo('/graph/:id/critic', 'POST', req, reply));
server.post('/rest/ai/graph/:id/undo', async (req, reply) => proxyTo('/graph/:id/undo', 'POST', req, reply));
server.post('/rest/ai/graph/:id/redo', async (req, reply) => proxyTo('/graph/:id/redo', 'POST', req, reply));
server.get('/rest/ai/graph/:id', async (req, reply) => proxyTo('/graph/:id', 'GET', req, reply));

// Workflows overview
server.get('/rest/ai/workflows', async (req, reply) => proxyTo('/workflows', 'GET', req, reply));

// Workflow Map (REST)
server.get('/rest/ai/workflow-map', async (req, reply) => proxyTo('/workflow-map', 'GET', req, reply));

// Streaming endpoints: use redirect to original SSE routes
server.get('/rest/ai/workflow-map/live', async (_req, reply) => reply.redirect(307, '/workflow-map/live'));
server.get('/rest/ai/events', async (_req, reply) => reply.redirect(307, '/events'));
