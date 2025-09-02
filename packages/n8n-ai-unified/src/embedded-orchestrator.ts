/**
 * Встроенный orchestrator для единого приложения
 */

import type { FastifyInstance } from 'fastify';

let server: FastifyInstance | null = null;

export interface OrchestratorOptions {
  port?: number;
  embedded?: boolean;
}

export async function startOrchestrator(options: OrchestratorOptions = {}) {
  if (server) {
    console.log('Orchestrator already running');
    return { port: (server.server.address() as any).port };
  }

  const port = options.port || 0; // 0 = random port
  
  // Создаем сервер из кода orchestrator
  server = await createServer({
    logger: !options.embedded,
    trustProxy: true,
  });

  // Запускаем на указанном порту
  await server.listen({ port, host: '127.0.0.1' });
  
  const actualPort = (server.server.address() as any).port;
  console.log(`🚀 Embedded orchestrator started on port ${actualPort}`);
  
  return {
    port: actualPort,
    stop: async () => {
      if (server) {
        await server.close();
        server = null;
      }
    }
  };
}

/**
 * Создаем сервер orchestrator
 * Копируем основную логику из packages/n8n-ai-orchestrator/src/server.ts
 */
async function createServer(opts: any) {
  const Fastify = (await import('fastify')).default;
  const cors = (await import('@fastify/cors')).default;
  const { graphManager } = await import('@n8n-ai/orchestrator/src/graph-manager');
  const { SimplePlanner } = await import('@n8n-ai/orchestrator/src/planner');
  const { patternMatcher } = await import('@n8n-ai/orchestrator/src/pattern-matcher');
  
  const server = Fastify(opts);
  
  // CORS
  await server.register(cors, {
    origin: true,
    credentials: true,
  });
  
  // Health check
  server.get('/api/v1/ai/health', async () => {
    return { status: 'ok', mode: 'embedded' };
  });
  
  // Plan endpoint
  server.post('/api/v1/ai/plan', async (request) => {
    const { prompt } = request.body as any;
    
    // Используем pattern matcher для быстрого ответа
    const pattern = patternMatcher.findPattern(prompt);
    if (pattern) {
      return {
        operations: pattern.operations,
        explanation: `Using pattern: ${pattern.name}`,
      };
    }
    
    // Используем simple planner
    const planner = new SimplePlanner();
    const result = await planner.plan(prompt);
    
    return result;
  });
  
  // Graph endpoints
  server.post('/graph/:id/batch', async (request) => {
    const { id } = request.params as any;
    const batch = request.body;
    
    const result = await graphManager.applyBatch(id, batch);
    return result;
  });
  
  server.post('/graph/:id/validate', async (request) => {
    const { id } = request.params as any;
    
    const validation = await graphManager.validate(id);
    return validation;
  });
  
  server.get('/graph/:id', async (request) => {
    const { id } = request.params as any;
    
    const workflow = graphManager.getWorkflow(id);
    if (!workflow) {
      throw new Error('Workflow not found');
    }
    
    return workflow;
  });
  
  return server;
}