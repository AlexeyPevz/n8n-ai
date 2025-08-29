# n8n-ai-hooks

Thin fork of n8n v1.71.1 with AI-specific extensions:
- Introspect API - runtime node descriptions and loadOptions
- Graph Mutation API - typed batch operations with validation
- Validate/Simulate API - static and contextual workflow validation
- Execution Events (SSE/WS) - real-time workflow execution monitoring

## Setup

This package contains a minimal extension layer on top of n8n.
The full n8n source is in `packages/n8n-ai-hooks-src/`.

## API Endpoints

### Introspect API
- `GET /api/v1/ai/introspect/nodes` - Get all available nodes with schemas
- `GET /api/v1/ai/introspect/node/:type` - Get specific node schema
- `POST /api/v1/ai/introspect/loadOptions` - Resolve dynamic options

### Graph Mutation API  
- `POST /api/v1/ai/graph/:id/batch` - Apply batch operations
- `POST /api/v1/ai/graph/:id/undo` - Undo last operation

### Validation API
- `POST /api/v1/ai/graph/:id/validate` - Validate workflow
- `POST /api/v1/ai/graph/:id/simulate` - Dry-run simulation