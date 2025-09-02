# Quick Start Guide

## Prerequisites

- Node.js >= 20.0.0
- pnpm >= 8.15.0
- Git

## Installation

```bash
# Clone the repository
git clone https://github.com/your-org/n8n-ai.git
cd n8n-ai

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

## Running the Orchestrator

### Option 1: Development Mode

```bash
cd packages/n8n-ai-orchestrator
pnpm dev
```

### Option 2: Test Server (Recommended)

```bash
cd packages/n8n-ai-orchestrator
npx tsx src/test-server.ts
```

The server will start on `http://localhost:3000`

## Testing the API

### 1. Health Check

```bash
curl http://localhost:3000/api/v1/ai/health
```

Expected response:
```json
{"status":"ok","ts":1234567890}
```

### 2. Create Your First Workflow

```bash
# Generate a plan
curl -X POST http://localhost:3000/plan \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Create a webhook that responds with Hello World"}'

# Create workflow from operations
curl -X POST http://localhost:3000/graph/my-first-workflow/batch \
  -H "Content-Type: application/json" \
  -d '{
    "version": "v1",
    "ops": [
      {
        "op": "add_node",
        "node": {
          "id": "webhook-1",
          "name": "Webhook",
          "type": "n8n-nodes-base.webhook",
          "typeVersion": 1,
          "position": [250, 300],
          "parameters": {
            "httpMethod": "GET",
            "path": "hello"
          }
        }
      }
    ]
  }'

# Get the workflow
curl http://localhost:3000/graph/my-first-workflow
```

## Running with Docker

```bash
# Build and run all services
docker-compose up -d

# Check logs
docker-compose logs -f orchestrator
```

## Environment Variables

Create a `.env` file:

```bash
# Minimal configuration
N8N_WEBHOOK_URL=http://localhost:5678
ORCH_PORT=3000

# For AI features (optional)
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=your-key-here
```

## Running the Unified App

```bash
# Build unified package
make unified-build

# Start unified n8n
make unified-start
```

## Running Tests

```bash
# All tests
pnpm test

# Specific package
pnpm -C packages/n8n-ai-orchestrator test

# E2E tests
pnpm -C packages/n8n-ai-orchestrator test:e2e
```

## Common Issues

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### TypeScript Errors

```bash
# Rebuild all packages
pnpm build

# Check for errors
npx tsc --noEmit
```

### Module Not Found

```bash
# Clean and reinstall
rm -rf node_modules packages/*/node_modules
pnpm install
pnpm build
```

## Next Steps

1. [Read the API Reference](./API_REFERENCE.md)
2. [Configure Environment Variables](./ENV_REFERENCE.md)
3. [Explore Example Workflows](../examples/)
4. [Join our Community](https://github.com/your-org/n8n-ai/discussions)