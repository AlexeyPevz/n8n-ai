# Upstream PR Proposals for n8n

This document outlines proposed Pull Requests to the main n8n repository to enable better extensibility for AI and other advanced features.

## PR 1: Workflow Introspection API

### Title
feat(api): Add workflow introspection endpoints for node metadata and capabilities

### Description
This PR adds new API endpoints that allow external tools to query available nodes, their parameters, and capabilities at runtime. This is essential for AI-powered workflow generation and other advanced tooling.

### Changes
```typescript
// packages/cli/src/api/workflows.api.ts

// New endpoints:
// GET /api/v1/node-types
// GET /api/v1/node-types/:nodeType
// GET /api/v1/node-types/:nodeType/description

@Get('/node-types')
async getNodeTypes() {
  const nodeTypes = NodeTypes();
  return nodeTypes.getAll().map(node => ({
    name: node.description.name,
    displayName: node.description.displayName,
    group: node.description.group,
    version: node.description.version,
    description: node.description.description,
  }));
}

@Get('/node-types/:nodeType/description')
async getNodeDescription(nodeType: string) {
  const nodeTypes = NodeTypes();
  const node = nodeTypes.getByNameAndVersion(nodeType);
  if (!node) {
    throw new NotFoundError(`Node type ${nodeType} not found`);
  }
  return node.description;
}
```

### Benefits
- Enables AI and external tools to understand available nodes
- Allows dynamic UI generation based on node capabilities
- Supports versioning and compatibility checks

### Backwards Compatibility
✅ Fully backwards compatible - only adds new endpoints

---

## PR 2: Workflow Execution Events via SSE/WebSocket

### Title
feat(core): Add real-time workflow execution events via SSE and WebSocket

### Description
Adds Server-Sent Events (SSE) and WebSocket support for real-time workflow execution monitoring. This enables live debugging, cost tracking, and visual execution flow.

### Changes
```typescript
// packages/cli/src/WorkflowExecute.ts

// Emit events during execution
this.emit('nodeExecutionStarted', {
  executionId,
  workflowId,
  nodeId: executionData.node.name,
  timestamp: new Date(),
});

this.emit('nodeExecutionCompleted', {
  executionId,
  workflowId,
  nodeId: executionData.node.name,
  duration: Date.now() - startTime,
  itemsProcessed: items.length,
  timestamp: new Date(),
});

// packages/cli/src/api/executions.api.ts
@Get('/executions/:id/events')
async getExecutionEvents(@Req() req: Request, @Res() res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  
  // Subscribe to execution events
  const handler = (event: any) => {
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  
  workflowRunner.on('nodeExecutionStarted', handler);
  workflowRunner.on('nodeExecutionCompleted', handler);
  
  req.on('close', () => {
    workflowRunner.off('nodeExecutionStarted', handler);
    workflowRunner.off('nodeExecutionCompleted', handler);
  });
}
```

### Benefits
- Real-time execution monitoring
- Live debugging capabilities
- Cost tracking and performance analysis
- Enhanced user experience

### Backwards Compatibility
✅ Fully backwards compatible - events are opt-in

---

## PR 3: Extensible Node Validation Framework

### Title
feat(core): Add extensible validation framework for workflow nodes

### Description
Introduces a plugin-based validation system that allows custom validators to be registered for nodes and workflows. This enables policy enforcement, security checks, and AI-guided validation.

### Changes
```typescript
// packages/workflow/src/Interfaces.ts
export interface INodeValidator {
  name: string;
  validate(
    node: INode,
    workflow: IWorkflow,
    options?: any
  ): ValidationResult;
}

export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
  warnings?: ValidationWarning[];
}

// packages/core/src/NodeValidation.ts
export class NodeValidationService {
  private validators: Map<string, INodeValidator[]> = new Map();
  
  registerValidator(nodeType: string, validator: INodeValidator) {
    if (!this.validators.has(nodeType)) {
      this.validators.set(nodeType, []);
    }
    this.validators.get(nodeType)!.push(validator);
  }
  
  async validateNode(node: INode, workflow: IWorkflow): Promise<ValidationResult> {
    const validators = [
      ...this.validators.get('*') || [],  // Global validators
      ...this.validators.get(node.type) || [],  // Type-specific
    ];
    
    const results = await Promise.all(
      validators.map(v => v.validate(node, workflow))
    );
    
    return mergeValidationResults(results);
  }
}
```

### Benefits
- Extensible validation system
- Custom policy enforcement
- Security validation hooks
- AI-assisted validation

### Backwards Compatibility
✅ Fully backwards compatible - validators are optional

---

## PR 4: Workflow Diff and Merge API

### Title
feat(api): Add workflow diff and merge capabilities

### Description
Adds API endpoints for comparing workflows and merging changes. Essential for Git integration, collaborative editing, and AI-powered modifications.

### Changes
```typescript
// packages/cli/src/api/workflows.api.ts

@Post('/workflows/diff')
async diffWorkflows(@Body() body: DiffRequest) {
  const { source, target } = body;
  
  const diff = computeWorkflowDiff(source, target);
  
  return {
    added: diff.addedNodes,
    removed: diff.removedNodes,
    modified: diff.modifiedNodes,
    connections: {
      added: diff.addedConnections,
      removed: diff.removedConnections,
    },
  };
}

@Post('/workflows/merge')
async mergeWorkflows(@Body() body: MergeRequest) {
  const { base, source, target, strategy = 'auto' } = body;
  
  const result = mergeWorkflows(base, source, target, strategy);
  
  if (result.conflicts.length > 0) {
    return {
      success: false,
      conflicts: result.conflicts,
      suggestions: result.suggestions,
    };
  }
  
  return {
    success: true,
    merged: result.workflow,
  };
}
```

### Benefits
- Git-based workflow management
- Collaborative editing support
- AI-powered workflow modifications
- Conflict resolution

### Backwards Compatibility
✅ Fully backwards compatible - new endpoints only

---

## PR 5: Node Authentication Context

### Title
feat(core): Add authentication context to node execution

### Description
Allows nodes to access authentication context during execution, enabling dynamic credential selection and multi-tenant scenarios.

### Changes
```typescript
// packages/workflow/src/Interfaces.ts
export interface IExecuteFunctions {
  // Existing methods...
  
  getAuthenticationContext(): IAuthenticationContext;
}

export interface IAuthenticationContext {
  userId: string;
  tenantId?: string;
  permissions: string[];
  metadata?: Record<string, any>;
}

// packages/core/src/NodeExecuteFunctions.ts
getAuthenticationContext(): IAuthenticationContext {
  return {
    userId: this.executionData.userId,
    tenantId: this.executionData.tenantId,
    permissions: this.executionData.permissions || [],
    metadata: this.executionData.authMetadata,
  };
}
```

### Benefits
- Multi-tenant support
- Dynamic credential selection
- Enhanced security context
- Audit trail improvements

### Backwards Compatibility
✅ Fully backwards compatible - new method with defaults

---

## Implementation Priority

1. **High Priority**: Workflow Introspection API - Essential for AI features
2. **High Priority**: Execution Events - Critical for real-time monitoring
3. **Medium Priority**: Validation Framework - Important for governance
4. **Medium Priority**: Diff/Merge API - Needed for Git integration
5. **Low Priority**: Authentication Context - Nice to have for enterprise

## Testing Strategy

Each PR should include:
- Comprehensive unit tests
- Integration tests
- Performance benchmarks
- Documentation updates
- Example implementations

## Migration Path

For features that might affect existing workflows:
1. Feature flags for gradual rollout
2. Backwards compatibility layer
3. Migration guides
4. Deprecation warnings

## Community Engagement

- Open RFC discussions before implementation
- Prototype implementations in n8n-ai
- Gather feedback from enterprise users
- Coordinate with n8n core team