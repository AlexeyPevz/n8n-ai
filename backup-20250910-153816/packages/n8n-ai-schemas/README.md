# n8n-ai-schemas

Type definitions and validation schemas for n8n-ai.

## Overview

This package provides Zod-based schemas for validating all data structures used in n8n-ai. It ensures type safety and runtime validation for AI-generated outputs.

## Installation

```bash
pnpm add @n8n-ai/schemas
```

## Usage

```typescript
import { NodeSchema, GraphSchema, OperationBatchSchema } from '@n8n-ai/schemas';

// Validate a node
const node = NodeSchema.parse({
  id: 'webhook-1',
  name: 'Webhook',
  type: 'n8n-nodes-base.webhook',
  typeVersion: 1,
  position: [250, 300],
  parameters: {
    httpMethod: 'GET',
    path: 'hello'
  }
});

// Validate operations
const batch = OperationBatchSchema.parse({
  version: 'v1',
  ops: [
    {
      op: 'add_node',
      node: { ... }
    }
  ]
});
```

## Schemas

### Node Schema
Validates n8n node structure including:
- ID and name
- Type and version
- Position coordinates
- Parameters
- Credentials

### Connection Schema
Validates connections between nodes:
- From/to node references
- Connection type
- Index for multiple outputs

### Graph Schema
Validates complete workflow structure:
- Workflow metadata
- Nodes array
- Connections array
- Version tracking

### Operation Batch Schema
Validates operation batches for workflow modifications:
- `add_node` - Add new node
- `set_params` - Update node parameters
- `connect` - Create connection
- `delete` - Remove node/connection
- `annotate` - Add comments

## Type Exports

All schemas automatically generate TypeScript types:

```typescript
import type { Node, Connection, Graph, OperationBatch } from '@n8n-ai/schemas';
```

## Development

```bash
# Build
pnpm build

# Test
pnpm test

# Type check
pnpm type-check
```