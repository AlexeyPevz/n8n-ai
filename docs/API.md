# API Documentation

**Note**: This document provides a quick overview. For complete API documentation with examples, see [API Reference](./API_REFERENCE.md).

## Quick Reference

### Base URL
```
http://localhost:3000
```

### Authentication
```bash
curl -H "X-API-Token: your-token" http://localhost:3000/api/v1/ai/health
```

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/ai/health` | Health check |
| POST | `/plan` | Generate workflow plan |
| POST | `/graph/:id/batch` | Apply operations |
| GET | `/graph/:id` | Get workflow |
| POST | `/graph/:id/undo` | Undo operations |
| POST | `/graph/:id/validate` | Validate workflow |
| GET | `/introspect/nodes` | List nodes |
| GET | `/introspect/search` | Search nodes |
| GET | `/workflow-map` | Get dependencies |

### Quick Examples

#### Create a Workflow
```bash
# 1. Generate plan
curl -X POST http://localhost:3000/plan \
  -H "Content-Type: application/json" \
  -d '{"prompt": "webhook that posts to slack"}'

# 2. Apply operations
curl -X POST http://localhost:3000/graph/my-workflow/batch \
  -H "Content-Type: application/json" \
  -d '{"version": "v1", "ops": [...]}'
```

For detailed documentation including request/response schemas, error codes, and advanced features, see [API Reference](./API_REFERENCE.md).