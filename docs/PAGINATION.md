# Pagination Guide

## Overview

n8n-ai includes a comprehensive pagination system for handling large workflows and datasets efficiently:
- Offset-based pagination for simple use cases
- Cursor-based pagination for real-time data
- Streaming for very large datasets
- Batch processing for bulk operations

## API Usage

### Basic Pagination

```bash
# Page-based pagination
GET /workflows/{workflowId}/nodes?page=2&limit=50

# Response includes metadata
{
  "data": [...],
  "meta": {
    "page": 2,
    "limit": 50,
    "total": 1234,
    "totalPages": 25,
    "hasNext": true,
    "hasPrev": true
  },
  "links": {
    "self": "/workflows/123/nodes?page=2&limit=50",
    "first": "/workflows/123/nodes?page=1&limit=50",
    "last": "/workflows/123/nodes?page=25&limit=50",
    "next": "/workflows/123/nodes?page=3&limit=50",
    "prev": "/workflows/123/nodes?page=1&limit=50"
  }
}
```

### Cursor-Based Pagination

```bash
# Initial request
GET /workflows/{workflowId}/nodes?limit=20

# Next page using cursor
GET /workflows/{workflowId}/nodes?cursor=eyJpZCI6Im5vZGUtMjAiLCJ0aW1lc3RhbXAiOjE2MzkyNDE2MDB9
```

### Sorting

```bash
# Sort by execution time (descending)
GET /workflows/{workflowId}/nodes?sortBy=executionTime&sortOrder=desc

# Sort by creation date (ascending)
GET /workflows/{workflowId}/nodes?sortBy=createdAt&sortOrder=asc
```

### Filtering

```bash
# Simple filter
GET /workflows/{workflowId}/nodes?filter={"type":"n8n-nodes-base.httpRequest"}

# Complex filters
GET /workflows/{workflowId}/nodes?filter={"executionTime":{"$gt":500}}
GET /workflows/{workflowId}/nodes?filter={"errorCount":{"$gt":0},"type":{"$in":["n8n-nodes-base.httpRequest","n8n-nodes-base.webhook"]}}
```

### Filter Operators

- `$eq` - Equal (default)
- `$ne` - Not equal
- `$gt` - Greater than
- `$gte` - Greater than or equal
- `$lt` - Less than
- `$lte` - Less than or equal
- `$in` - In array
- `$regex` - Regular expression match

## Response Headers

Pagination information is also included in response headers:

```
X-Total-Count: 1234
X-Page: 2
X-Limit: 50
X-Total-Pages: 25
X-Next-Page: /workflows/123/nodes?page=3&limit=50
X-Prev-Page: /workflows/123/nodes?page=1&limit=50
```

## Specialized Endpoints

### Nodes with Errors
```bash
GET /workflows/{workflowId}/nodes/errors?page=1&limit=20
```

### Slow Nodes
```bash
# Get nodes with execution time > 1000ms
GET /workflows/{workflowId}/nodes/slow?threshold=1000&sortBy=executionTime&sortOrder=desc
```

### Nodes by Type
```bash
GET /workflows/{workflowId}/nodes/by-type/n8n-nodes-base.httpRequest?page=1
```

## Streaming Large Datasets

For very large workflows, use streaming endpoints:

### NDJSON Format
```bash
GET /workflows/{workflowId}/stream?format=ndjson

# Response (newline-delimited JSON)
{"id":"node-1","name":"HTTP Request","type":"n8n-nodes-base.httpRequest",...}
{"id":"node-2","name":"Set","type":"n8n-nodes-base.set",...}
...
```

### CSV Format
```bash
GET /workflows/{workflowId}/stream?format=csv

# Response
node-1,HTTP Request,n8n-nodes-base.httpRequest,100,200
node-2,Set,n8n-nodes-base.set,250,200
...
```

## Batch Operations

For applying operations to large workflows:

```bash
POST /workflows/{workflowId}/batch-apply
{
  "version": "v1",
  "ops": [
    { "op": "set_params", "name": "node-1", "parameters": {...} },
    { "op": "set_params", "name": "node-2", "parameters": {...} },
    // ... hundreds more operations
  ]
}

# Response
{
  "successful": 450,
  "failed": 50,
  "errors": [
    { "operation": {...}, "error": "Node not found" }
  ],
  "progressKey": "batch-1234567890"
}
```

### Check Progress
```bash
GET /batch-progress/batch-1234567890

{
  "progress": 75,
  "completed": false
}
```

## Workflow Analysis

Analyze large workflows efficiently:

```bash
POST /workflows/{workflowId}/analyze

# Response
{
  "nodeTypes": {
    "n8n-nodes-base.httpRequest": 234,
    "n8n-nodes-base.set": 156,
    "n8n-nodes-base.if": 89
  },
  "performance": {
    "avg": 234.5,
    "max": 5000,
    "min": 10
  }
}
```

## Performance Considerations

### Limits
- Default limit: 20 items per page
- Maximum limit: 100 items per page
- Streaming: No limit (memory efficient)

### Best Practices

1. **Use appropriate page size**
   - Small (10-20) for detailed views
   - Medium (50) for lists
   - Large (100) for bulk operations

2. **Use cursor pagination for real-time data**
   - More stable when data is changing
   - Better performance for deep pagination

3. **Use streaming for exports**
   - Memory efficient
   - No size limits
   - Progressive loading

4. **Filter at the source**
   - Use filters to reduce dataset size
   - More efficient than client-side filtering

5. **Cache cursor positions**
   - Store cursor for resume capability
   - Include timestamp for expiration

## Implementation Examples

### Frontend Integration

```javascript
// Fetch with pagination
async function fetchNodes(workflowId, page = 1, limit = 20) {
  const response = await fetch(
    `/workflows/${workflowId}/nodes?page=${page}&limit=${limit}`
  );
  
  const data = await response.json();
  
  return {
    nodes: data.data,
    hasMore: data.meta.hasNext,
    total: data.meta.total,
    loadMore: () => fetchNodes(workflowId, page + 1, limit)
  };
}

// Infinite scroll with cursor
async function fetchNodesInfinite(workflowId, cursor) {
  const url = cursor 
    ? `/workflows/${workflowId}/nodes?cursor=${cursor}`
    : `/workflows/${workflowId}/nodes?limit=20`;
    
  const response = await fetch(url);
  const data = await response.json();
  
  return {
    nodes: data.data,
    nextCursor: data.meta.nextCursor,
    hasMore: data.meta.hasNext
  };
}
```

### Streaming Consumer

```javascript
// Consume streaming endpoint
async function* streamNodes(workflowId) {
  const response = await fetch(`/workflows/${workflowId}/stream`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  let buffer = '';
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.trim()) {
        yield JSON.parse(line);
      }
    }
  }
}

// Usage
for await (const node of streamNodes('workflow-123')) {
  console.log('Processing node:', node.id);
}
```

## Error Handling

### Invalid Parameters
```json
{
  "error": "Invalid pagination parameters",
  "details": [
    "Page must be a positive integer",
    "Limit cannot exceed 100"
  ]
}
```

### Cursor Expired
```json
{
  "error": "Cursor expired or invalid",
  "code": "INVALID_CURSOR",
  "suggestion": "Start from the beginning or use page-based pagination"
}
```