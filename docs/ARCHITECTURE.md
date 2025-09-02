# Architecture Overview

## System Design

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│   n8n + Hooks   │────▶│   Orchestrator   │────▶│   AI Provider   │
│                 │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                         
        │                        │                         
        ▼                        ▼                         
┌─────────────────┐     ┌──────────────────┐              
│                 │     │                  │              
│    UI Panel     │     │  Vector DB/RAG   │              
│                 │     │                  │              
└─────────────────┘     └──────────────────┘              
```

## Core Components

### 1. n8n-ai-schemas
**Purpose**: Type definitions and validation

- Zod schemas for all data structures
- Strict validation of AI outputs
- TypeScript types generation
- Operation batch validation

**Key Files**:
- `src/index.ts` - Main schema exports
- `NodeSchema` - Node structure validation
- `GraphSchema` - Workflow graph validation
- `OperationBatchSchema` - Operation validation

### 2. n8n-ai-hooks
**Purpose**: n8n integration layer

- Express middleware for n8n
- API routes injection
- Node introspection
- Proxy to orchestrator

**Key Files**:
- `src/ai-routes.ts` - Main route definitions
- `src/introspect.ts` - Node discovery
- `src/security-middleware.ts` - Auth & rate limiting

### 3. n8n-ai-orchestrator
**Purpose**: Core AI logic and API server

**Architecture**:
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
├─────────────────────────────────────────┤
│  Storage Layer                          │
│  - In-Memory Graph Store               │
│  - Redis Cache (optional)              │
│  - Vector DB (optional)                │
└─────────────────────────────────────────┘
```

**Key Components**:
- `server.ts` - Main Fastify application
- `planner.ts` - AI prompt processing
- `graph-manager.ts` - Workflow state management
- `pattern-matcher.ts` - Template matching
- `rag/` - Retrieval Augmented Generation

### 4. n8n-ai-panel
**Purpose**: Vue UI components

- Vue 3 + TypeScript
- n8n design system integration
- Real-time updates via WebSocket
- Visual workflow editing

**Key Components**:
- `AIFirstTool.vue` - Main AI interface
- `ExplainNode.vue` - Node documentation
- `WorkflowMap.vue` - Dependency visualization
- `SecretsWizard.vue` - Credential setup

### 5. n8n-ai-unified
**Purpose**: Single integrated application

- Embeds orchestrator in n8n
- Bundles UI components
- Single deployment unit
- Native n8n plugin

## Data Flow

### 1. Workflow Generation Flow
```
User Prompt → AI Planner → Schema Validation → Operation Batch → Graph Manager → n8n Workflow
```

### 2. Operation Processing
```
Operation Batch
    ├─ add_node: Create new node
    ├─ set_params: Update parameters
    ├─ connect: Create connection
    ├─ delete: Remove node/connection
    └─ annotate: Add comments
```

### 3. State Management
- Event sourcing for undo/redo
- Immutable state updates
- Version tracking
- Audit logging

## API Design

### RESTful Endpoints
- `POST /plan` - Generate workflow plan
- `POST /graph/{id}/batch` - Apply operations
- `GET /graph/{id}` - Get workflow state
- `POST /graph/{id}/undo` - Revert operations
- `POST /graph/{id}/validate` - Check validity

### Real-time Updates
- WebSocket at `/ws`
- Server-Sent Events at `/events`
- Live workflow map at `/workflow-map/live`

## Security Architecture

### Defense in Depth
1. **API Gateway** - Rate limiting, CORS
2. **Authentication** - Token-based auth
3. **Authorization** - Per-endpoint permissions
4. **Validation** - Input sanitization
5. **Audit** - All operations logged

### Threat Model
- Command injection → execFile + validation
- Path traversal → Strict ID validation
- DoS attacks → Rate limiting
- Data exposure → Credential filtering

## Scalability Considerations

### Horizontal Scaling
- Stateless orchestrator
- Redis for shared state
- Load balancer ready

### Performance Optimizations
- LRU cache for node descriptions
- Batch operation processing
- Lazy loading of node types
- Connection pooling

## Technology Stack

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Fastify (orchestrator), Express (hooks)
- **Language**: TypeScript (strict mode)
- **Validation**: Zod
- **Testing**: Vitest

### Frontend
- **Framework**: Vue 3
- **Build**: Vite
- **Styling**: SCSS
- **Testing**: Vitest + Vue Test Utils

### Infrastructure
- **Container**: Docker
- **Vector DB**: Qdrant
- **Cache**: Redis
- **Monitoring**: Prometheus

## Design Decisions

### Why Monorepo?
- Shared types and schemas
- Atomic changes across packages
- Simplified dependency management
- Better developer experience

### Why Zod?
- Runtime validation
- TypeScript inference
- Composable schemas
- Clear error messages

### Why Fastify?
- High performance
- Schema validation
- Plugin architecture
- TypeScript support

### Why Event Sourcing?
- Complete audit trail
- Easy undo/redo
- Time travel debugging
- State reconstruction