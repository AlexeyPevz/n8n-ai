# n8n-ai-hooks

n8n integration layer for AI features.

## Overview

This package provides the integration point between n8n and the AI orchestrator. It adds AI-specific routes to n8n without modifying the core codebase.

## Features

- Express middleware for n8n
- API route injection
- Node introspection
- Security middleware
- Request proxying to orchestrator

## Integration

### In n8n

The package exports Express middleware that can be added to n8n:

```typescript
import { createAIRoutes } from '@n8n-ai/hooks';

// In n8n server setup
const aiRoutes = createAIRoutes({
  orchestratorUrl: 'http://localhost:3000',
  apiToken: process.env.API_TOKEN
});

app.use('/api/v1/ai', aiRoutes);
```

### Routes Added

All routes are prefixed with `/api/v1/ai`:

- `GET /health` - Health check
- `POST /plan` - Generate workflow plan
- `GET /introspect/nodes` - List available nodes
- `GET /introspect/search` - Search nodes
- `POST /graph/:id/batch` - Apply operations
- `GET /graph/:id` - Get workflow

## Security

### Authentication
Supports token-based auth via `X-API-Token` header:

```typescript
const security = createSecurityMiddleware({
  apiToken: process.env.API_TOKEN,
  enableAuth: true
});
```

### Rate Limiting
Built-in rate limiting per endpoint:

```typescript
const rateLimiter = createRateLimiter({
  windowMs: 60000,
  max: 60
});
```

## Node Introspection

The package can discover and index n8n nodes:

```typescript
import { loadBuiltinNodes } from '@n8n-ai/hooks';

const nodes = await loadBuiltinNodes();
// Returns array of node descriptions
```

## Proxy Configuration

Requests are proxied to the orchestrator:

```typescript
const proxy = createProxy({
  target: 'http://orchestrator:3000',
  changeOrigin: true,
  timeout: 30000
});
```

## Development

### Setup
```bash
# Install
pnpm install

# Build
pnpm build

# Test
pnpm test
```

### Testing with n8n

1. Build the package
2. Link to local n8n:
```bash
cd packages/n8n-ai-hooks
pnpm link
cd /path/to/n8n
pnpm link @n8n-ai/hooks
```

## Configuration

### Environment Variables

- `ORCHESTRATOR_URL` - Orchestrator service URL
- `API_TOKEN` - Authentication token
- `ENABLE_AUTH` - Enable authentication
- `LOG_LEVEL` - Logging level

### Options

```typescript
interface HooksConfig {
  orchestratorUrl: string;
  apiToken?: string;
  enableAuth?: boolean;
  enableMetrics?: boolean;
  customMiddleware?: Express.RequestHandler[];
}
```

## Error Handling

All errors are standardized:

```json
{
  "error": "ValidationError",
  "message": "Invalid request",
  "statusCode": 400,
  "details": {}
}
```

## Monitoring

### Metrics
Exports metrics in Prometheus format:

```typescript
router.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(getMetrics());
});
```

### Health Check
```typescript
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: packageJson.version,
    uptime: process.uptime()
  });
});
```

## License

MIT