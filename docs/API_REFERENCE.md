# API Reference

## Base URL

```
http://localhost:3000
```

## Authentication

API supports token-based authentication via `X-API-Token` header:

```bash
curl -H "X-API-Token: your-token" http://localhost:3000/api/v1/ai/health
```

## Core Endpoints

### Health Check

Check if the service is running.

```http
GET /api/v1/ai/health
```

**Response:**
```json
{
  "status": "ok",
  "ts": 1234567890
}
```

### Plan Workflow

Generate a workflow plan from natural language prompt.

```http
POST /plan
Content-Type: application/json

{
  "prompt": "Create a webhook that sends data to Slack",
  "context": {
    "workflowId": "optional-id",
    "existingNodes": []
  }
}
```

**Response:**
```json
{
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
        "parameters": {}
      }
    },
    {
      "op": "connect",
      "from": "Webhook",
      "to": "Slack"
    }
  ]
}
```

### Apply Operations

Apply a batch of operations to a workflow.

```http
POST /graph/{workflowId}/batch
Content-Type: application/json

{
  "version": "v1",
  "ops": [...]
}
```

**Response:**
```json
{
  "ok": true,
  "undoId": "undo_1234567890_abc",
  "appliedOperations": 3
}
```

### Get Workflow

Retrieve the current state of a workflow.

```http
GET /graph/{workflowId}
```

**Response:**
```json
{
  "ok": true,
  "workflow": {
    "id": "workflow-id",
    "name": "My Workflow",
    "nodes": [...],
    "connections": [...],
    "version": 2,
    "lastModified": "2025-09-02T13:42:28.814Z"
  }
}
```

### Undo Operations

Revert previously applied operations.

```http
POST /graph/{workflowId}/undo
Content-Type: application/json

{
  "undoId": "undo_1234567890_abc"
}
```

**Response:**
```json
{
  "ok": true,
  "undoId": "undo_1234567890_abc",
  "undoneOperations": 3
}
```

### Validate Workflow

Check if a workflow is valid according to n8n rules.

```http
POST /graph/{workflowId}/validate
```

**Response:**
```json
{
  "ok": true,
  "valid": true,
  "errors": [],
  "warnings": []
}
```

### Simulate Workflow

Test workflow execution with sample data.

```http
POST /graph/{workflowId}/simulate
Content-Type: application/json

{
  "inputData": {
    "json": {"test": "data"}
  }
}
```

**Response:**
```json
{
  "ok": true,
  "output": {...},
  "executionTime": 123
}
```

## Introspection API

### List Available Nodes

Get all available n8n node types.

```http
GET /introspect/nodes
```

**Response:**
```json
[
  {
    "name": "n8n-nodes-base.webhook",
    "displayName": "Webhook",
    "description": "Starts workflow on webhook call",
    "version": 1,
    "inputs": ["main"],
    "outputs": ["main"]
  },
  ...
]
```

### Search Nodes

Search for nodes by keyword.

```http
GET /introspect/search?q=http
```

**Response:**
```json
{
  "results": [
    {
      "type": "n8n-nodes-base.httpRequest",
      "name": "HTTP Request",
      "score": 0.95,
      "matchedKeywords": ["http", "request"],
      "preview": "Make HTTP requests to any URL"
    }
  ]
}
```

### Get Node Details

Get detailed information about a specific node type.

```http
GET /introspect/node/{nodeType}
```

**Response:**
```json
{
  "name": "n8n-nodes-base.httpRequest",
  "displayName": "HTTP Request",
  "description": "Make HTTP requests",
  "version": 4,
  "properties": [...],
  "credentials": [...]
}
```

## Workflow Map

### Get Workflow Dependencies

Get a map of workflow dependencies.

```http
GET /workflow-map
```

**Response:**
```json
{
  "nodes": [...],
  "edges": [...],
  "stats": {
    "totalWorkflows": 10,
    "totalConnections": 15,
    "executeWorkflowCoverage": 0.8,
    "httpWebhookCoverage": 0.6
  },
  "generatedAt": "2025-09-02T13:42:28.814Z"
}
```

### Live Workflow Status (SSE)

Stream real-time workflow execution status.

```http
GET /workflow-map/live
Accept: text/event-stream
```

**Response (Server-Sent Events):**
```
event: hello
data: {"ts": 1234567890, "kind": "workflow-map"}

event: live
data: {"workflows": [...], "edges": 5}
```

## Metrics

### Get Metrics (Prometheus Format)

```http
GET /metrics
```

### Get Metrics (JSON Format)

```http
GET /metrics/json
```

### Record Custom Metric

```http
POST /metrics/custom
Content-Type: application/json

{
  "name": "custom_event",
  "type": "counter",
  "value": 1,
  "labels": {"event": "test"}
}
```

## Git Integration

### Export Workflow to Git

```http
POST /git/export
Content-Type: application/json

{
  "workflowId": "my-workflow",
  "message": "Updated via AI",
  "branch": "feature/ai-update"
}
```

## Error Responses

All endpoints may return error responses:

```json
{
  "error": "ValidationError",
  "message": "Invalid operation batch",
  "details": {
    "field": "ops[0].node.type",
    "issue": "Unknown node type"
  }
}
```

Common error codes:
- `400` - Bad Request (validation error)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## Rate Limiting

Default rate limits:
- `/plan`: 10 requests per minute
- `/graph/*/batch`: 30 requests per minute
- Other endpoints: 60 requests per minute

## WebSocket API

For real-time updates, connect to:

```
ws://localhost:3000/ws
```

Send:
```json
{
  "type": "subscribe",
  "workflowId": "my-workflow"
}
```

Receive:
```json
{
  "type": "update",
  "workflowId": "my-workflow",
  "event": "nodeAdded",
  "data": {...}
}
```