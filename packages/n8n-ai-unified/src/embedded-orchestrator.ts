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
  }) as any;

  // Запускаем на указанном порту
  await server!.listen({ port, host: '127.0.0.1' });
  
  const actualPort = (server!.server.address() as any).port;
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
async function createServer(opts: any): Promise<FastifyInstance> {
  const Fastify = (await import('fastify')).default;
  const cors = (await import('@fastify/cors')).default;
  
  const server = Fastify(opts);
  
  // CORS
  await server.register(cors, {
    origin: true,
    credentials: true,
  });
  
  // Health check
  server.get('/api/v1/ai/health', async () => {
    return { status: 'ok', mode: 'embedded', ts: Date.now() };
  });
  
  // Plan endpoint
  server.post('/api/v1/ai/plan', async (request) => {
    const { prompt } = request.body as any;
    
    if (!prompt) {
      return { error: 'Prompt is required' };
    }
    
    // Простой планировщик для embedded режима
    const operations = [
      {
        op: 'add_node',
        node: {
          id: 'node-1',
          name: 'Manual Trigger',
          type: 'n8n-nodes-base.manualTrigger',
          typeVersion: 1,
          position: [400, 300],
          parameters: {}
        }
      },
      {
        op: 'add_node',
        node: {
          id: 'node-2',
          name: 'HTTP Request',
          type: 'n8n-nodes-base.httpRequest',
          typeVersion: 4,
          position: [600, 300],
          parameters: {
            method: 'GET',
            url: 'https://api.example.com/data',
            responseFormat: 'json'
          }
        }
      },
      {
        op: 'connect',
        from: 'Manual Trigger',
        to: 'HTTP Request'
      }
    ];
    
    return {
      ops: operations,
      version: 'v1',
      prompt,
      mode: 'embedded'
    };
  });
  
  // Graph endpoints
  server.post('/graph/:id/batch', async (request) => {
    const { id } = request.params as any;
    const batch = request.body as any;
    
    // Простая реализация для embedded режима
    return {
      ok: true,
      undoId: `undo-${Date.now()}`,
      appliedOperations: batch.ops?.length || 0
    };
  });
  
  server.post('/graph/:id/validate', async (request) => {
    const { id } = request.params as any;
    
    // Простая валидация для embedded режима
    return {
      ok: true,
      lints: []
    };
  });
  
  server.get('/graph/:id', async (request) => {
    const { id } = request.params as any;
    
    // Простой workflow для embedded режима
    return {
      ok: true,
      workflow: {
        id,
        name: `Workflow ${id}`,
        nodes: [],
        connections: [],
        version: 1,
        lastModified: Date.now()
      }
    };
  });
  
  return server as any;
}