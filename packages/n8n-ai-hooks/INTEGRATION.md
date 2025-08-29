# n8n-ai-hooks Integration Guide

## Как интегрировать AI API в n8n

### 1. Добавьте зависимости в n8n

```json
{
  "dependencies": {
    "@n8n-ai/schemas": "workspace:*",
    "express": "^4.18.2"
  }
}
```

### 2. Импортируйте и зарегистрируйте роуты

В файле `packages/cli/src/Server.ts` добавьте:

```typescript
import { createAIRoutes } from '@n8n-ai/hooks/ai-routes';
import { introspectAPI } from '@n8n-ai/hooks/introspect-api';

// После инициализации всех нод
const nodeTypes = this.nodeTypes.getAll();
introspectAPI.registerNodeTypes(nodeTypes);

// Регистрация роутов
const aiRoutes = createAIRoutes();
this.app.use(aiRoutes);
```

### 3. Обновите CORS политику

Добавьте разрешение для AI Panel origin:

```typescript
this.app.use(cors({
  origin: [
    'http://localhost:3001', // AI Panel
    // ... другие origins
  ],
  credentials: true
}));
```

### 4. Добавьте middleware для SSE

Для execution events добавьте:

```typescript
this.app.get('/api/v1/ai/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  // Подписка на события выполнения
  const listener = (event: ExecutionEvent) => {
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event.data)}\n\n`);
  };
  
  eventBus.on('execution', listener);
  
  req.on('close', () => {
    eventBus.off('execution', listener);
  });
});
```

## Примеры использования

### Получить все ноды
```bash
curl http://localhost:5678/api/v1/ai/introspect/nodes
```

### Получить схему конкретной ноды
```bash
curl http://localhost:5678/api/v1/ai/introspect/node/n8n-nodes-base.httpRequest
```

### Применить операции к воркфлоу
```bash
curl -X POST http://localhost:5678/api/v1/ai/graph/workflow-1/batch \
  -H "Content-Type: application/json" \
  -d '{
    "version": "v1",
    "ops": [
      {
        "op": "add_node",
        "node": {
          "id": "http-1",
          "name": "HTTP Request",
          "type": "n8n-nodes-base.httpRequest",
          "typeVersion": 4,
          "position": [600, 300],
          "parameters": { "method": "GET" }
        }
      }
    ]
  }'
```