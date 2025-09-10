# n8n-ai-orchestrator

Core AI orchestration service for n8n-ai.

## Overview

The orchestrator is the brain of n8n-ai, handling:
- AI-powered workflow generation
- Operation validation and execution
- State management with undo/redo
- Pattern matching
- RAG (Retrieval Augmented Generation)
- Metrics and monitoring

## Quick Start

```bash
# Development mode
pnpm dev

# Production mode
pnpm build && pnpm start

# Run tests
pnpm test
pnpm test:e2e
```

## Architecture

```
┌─────────────────────────────────────────┐
│           Fastify Server                │
├─────────────────────────────────────────┤
│  Middleware Layer                       │
│  - Security (CORS, Rate Limit, Auth)   │
│  - Metrics & Monitoring                 │
│  - Request Context                      │
├─────────────────────────────────────────┤
│  Business Logic                         │
│  - Planner (AI integration)            │
│  - Graph Manager (State)               │
│  - Pattern Matcher                     │
│  - RAG System                          │
└─────────────────────────────────────────┘
```

## API Endpoints

### Core Operations
- `POST /plan` - Generate workflow from prompt
- `POST /graph/{id}/batch` - Apply operations
- `GET /graph/{id}` - Get workflow state
- `POST /graph/{id}/undo` - Undo operations

### Introspection
- `GET /introspect/nodes` - List available nodes
- `GET /introspect/search` - Search nodes
- `GET /introspect/node/{type}` - Node details

### Monitoring
- `GET /health` - Health check
- `GET /metrics` - Prometheus metrics
- `GET /workflow-map` - Dependency map

## Configuration

See [Environment Variables](../../docs/ENV_REFERENCE.md) for configuration options.

Key variables:
- `ORCH_PORT` - Server port (default: 3000)
- `AI_PROVIDER` - LLM provider
- `AI_API_KEY` - API key for AI

## Features

### AI Planning
Uses LLMs to convert natural language into workflow operations:
```typescript
const plan = await planner.generatePlan("Create a webhook that posts to Slack");
```

### Graph Management
Manages workflow state with full history:
```typescript
const manager = new GraphManager();
const result = await manager.applyBatch(workflowId, operations);
await manager.undo(workflowId, result.undoId);
```

### Pattern Matching
Recognizes common workflow patterns:
```typescript
const matches = patternMatcher.match("fetch data from API and save to database");
```

### RAG System
Provides contextual assistance using vector search:
```typescript
const context = await ragSystem.getContext({
  query: "How to use HTTP Request node?",
  workflowContext: currentWorkflow
});
```

## Development

### Project Structure
```
src/
├── server.ts           # Main application
├── planner.ts          # AI integration
├── graph-manager.ts    # State management
├── pattern-matcher.ts  # Pattern recognition
├── ai/                 # AI components
│   ├── prompts/       # Prompt templates
│   └── rag/           # RAG system
├── monitoring/         # Metrics & logging
├── security/          # Auth & rate limiting
└── routes/            # API routes
```

### Testing

```bash
# Unit tests
pnpm test

# E2E tests (requires server)
pnpm test:e2e

# With coverage
pnpm test:coverage
```

### Adding New Features

1. **New Operation Type**
   - Add to `OperationBatchSchema` in schemas
   - Implement handler in `graph-manager.ts`
   - Add tests

2. **New AI Provider**
   - Implement `AIProvider` interface
   - Add to `planner.ts`
   - Update environment config

3. **New Pattern**
   - Add to `extended-patterns.ts`
   - Include examples
   - Test pattern matching

## Deployment

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build
CMD ["node", "dist/n8n-ai-orchestrator/src/server.js"]
```

### Environment
```bash
NODE_ENV=production
ORCH_PORT=3000
AI_PROVIDER=openrouter
AI_API_KEY=your-key
```

## Troubleshooting

### Server won't start
- Check port availability: `lsof -i :3000`
- Verify environment variables
- Check logs for errors

### AI not working
- Verify API key is set
- Check provider is configured
- Monitor rate limits

### Memory issues
- Enable Redis caching
- Implement pagination
- Increase Node heap size

## License

MIT