# Environment Variables Reference

## Core Configuration

### Required

- `N8N_WEBHOOK_URL` - Base URL for n8n webhooks (e.g., `http://localhost:5678`)

### Server Configuration

- `ORCH_PORT` - Orchestrator API port (default: `3000`)
- `NODE_ENV` - Environment: `development` | `production` (default: `development`)
- `LOG_LEVEL` - Logging level: `debug` | `info` | `warn` | `error` (default: `info`)

## AI Configuration

### Provider Settings

- `AI_PROVIDER` - LLM provider: `openai` | `anthropic` | `openrouter` (default: `openrouter`)
- `AI_API_KEY` - API key for AI provider **(required for AI features)**
- `AI_MODEL` - Model to use (default: `anthropic/claude-3-haiku`)
- `AI_TEMPERATURE` - Model temperature 0-1 (default: `0.3`)
- `AI_MAX_TOKENS` - Max tokens per request (default: `4096`)

### OpenRouter Specific

- `OPENROUTER_API_KEY` - OpenRouter API key
- `OPENROUTER_MODEL` - Model selection (default: `anthropic/claude-3-haiku`)
- `OPENROUTER_SITE_URL` - Your site URL for OpenRouter
- `OPENROUTER_APP_NAME` - Your app name for OpenRouter

## Security

### Authentication

- `API_TOKEN` - API authentication token for secured endpoints
- `API_TOKENS` - Comma-separated list of valid tokens (for multiple clients)
- `ENABLE_AUTH` - Enable API authentication: `true` | `false` (default: `false`)

### Rate Limiting

- `RATE_LIMIT_ENABLED` - Enable rate limiting: `true` | `false` (default: `true`)
- `RATE_LIMIT_WINDOW_MS` - Rate limit window in ms (default: `60000`)
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window (default: `60`)

### CORS

- `CORS_ENABLED` - Enable CORS: `true` | `false` (default: `true`)
- `CORS_ORIGIN` - Allowed origins (default: `*`)

## Storage

### Redis (Optional)

- `REDIS_URL` - Redis connection URL (default: `redis://localhost:6379`)
- `REDIS_ENABLED` - Enable Redis caching: `true` | `false` (default: `false`)

### Vector Database (RAG)

- `QDRANT_URL` - Qdrant vector DB URL (default: `http://localhost:6333`)
- `QDRANT_ENABLED` - Enable RAG system: `true` | `false` (default: `false`)
- `QDRANT_COLLECTION` - Collection name (default: `n8n_nodes`)

## Git Integration

- `GIT_INTEGRATION_ENABLED` - Enable git features: `true` | `false` (default: `false`)
- `GIT_REPO_PATH` - Local git repository path
- `GIT_BRANCH` - Default branch (default: `main`)
- `GIT_AUTHOR_NAME` - Commit author name
- `GIT_AUTHOR_EMAIL` - Commit author email
- `GITHUB_TOKEN` - GitHub token for PR creation

## Monitoring

### Metrics

- `METRICS_ENABLED` - Enable metrics: `true` | `false` (default: `true`)
- `METRICS_PORT` - Metrics server port (default: `9090`)

### Tracing

- `TRACING_ENABLED` - Enable OpenTelemetry: `true` | `false` (default: `false`)
- `OTEL_EXPORTER_OTLP_ENDPOINT` - OpenTelemetry endpoint

## Development

- `DEV_MODE` - Enable development features: `true` | `false`
- `DEBUG` - Debug namespaces (e.g., `n8n-ai:*`)
- `DISABLE_TYPE_CHECK` - Skip TypeScript checks: `true` | `false`

## Example .env File

```bash
# Core
N8N_WEBHOOK_URL=http://localhost:5678
ORCH_PORT=3000
NODE_ENV=production

# AI
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=your-key-here
OPENROUTER_MODEL=anthropic/claude-3-haiku

# Security
API_TOKEN=your-secret-token
ENABLE_AUTH=true

# Storage
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379

# Git
GIT_INTEGRATION_ENABLED=true
GIT_REPO_PATH=/var/n8n-workflows
GIT_AUTHOR_NAME=AI Assistant
GIT_AUTHOR_EMAIL=ai@n8n.local
```