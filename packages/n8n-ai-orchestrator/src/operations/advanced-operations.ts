import { z } from 'zod';
// Не используется напрямую; опишем собственные op-типы ниже

// Replace node operation
export const ReplaceNodeOpSchema = z.object({
  op: z.literal('replace_node'),
  nodeId: z.string(),
  newNode: z.object({
    type: z.string(),
    parameters: z.record(z.any()).optional(),
    name: z.string().optional(),
    position: z.tuple([z.number(), z.number()]).optional(),
  }),
  preserveConnections: z.boolean().default(true),
  parameterMapping: z.record(z.string()).optional(), // oldParam -> newParam
});

export type ReplaceNodeOp = z.infer<typeof ReplaceNodeOpSchema>;

// Extract subworkflow operation
export const ExtractSubworkflowOpSchema = z.object({
  op: z.literal('extract_subworkflow'),
  nodeIds: z.array(z.string()).min(1),
  subworkflowName: z.string(),
  createExecuteWorkflowNode: z.boolean().default(true),
  inputNodeId: z.string().optional(), // Node to use as input
  outputNodeId: z.string().optional(), // Node to use as output
});

export type ExtractSubworkflowOp = z.infer<typeof ExtractSubworkflowOpSchema>;

// Optimize batches operation
export const OptimizeBatchesOpSchema = z.object({
  op: z.literal('optimize_batches'),
  strategy: z.enum(['merge_sets', 'batch_http', 'deduplicate', 'parallel_execution']),
  targetNodes: z.array(z.string()).optional(), // If not specified, optimize all
  options: z.record(z.any()).optional(),
});

export type OptimizeBatchesOp = z.infer<typeof OptimizeBatchesOpSchema>;

// Extended operation schema
export const ExtendedGraphOpSchema = z.union([
  ReplaceNodeOpSchema,
  ExtractSubworkflowOpSchema,
  OptimizeBatchesOpSchema,
]);

export type ExtendedGraphOp = z.infer<typeof ExtendedGraphOpSchema>;

// Operation handlers
export interface OperationHandler<T = any> {
  validate(op: T, context: OperationContext): ValidationResult;
  apply(op: T, context: OperationContext): Promise<ApplyResult>;
}

export interface OperationContext {
  workflowId: string;
  workflow: any; // Current workflow state
  nodeMap: Map<string, any>;
  connectionMap: Map<string, any[]>;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export interface ApplyResult {
  success: boolean;
  changes: any[];
  newWorkflow?: any;
  subworkflow?: any;
  error?: string;
}

// Replace node handler
export class ReplaceNodeHandler implements OperationHandler<ReplaceNodeOp> {
  validate(op: ReplaceNodeOp, context: OperationContext): ValidationResult {
    const errors: string[] = [];
    
    // Check if node exists
    if (!context.nodeMap.has(op.nodeId)) {
      errors.push(`Node ${op.nodeId} not found`);
    }
    
    // Validate new node type
    if (!op.newNode.type) {
      errors.push('New node type is required');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  async apply(op: ReplaceNodeOp, context: OperationContext): Promise<ApplyResult> {
    const oldNode = context.nodeMap.get(op.nodeId);
    if (!oldNode) {
      return {
        success: false,
        changes: [],
        error: `Node ${op.nodeId} not found`,
      };
    }
    
    const changes: any[] = [];
    
    // Create new node with preserved/mapped parameters
    const newNode = {
      id: op.nodeId,
      name: op.newNode.name || oldNode.name,
      type: op.newNode.type,
      position: op.newNode.position || oldNode.position,
      parameters: {},
    };
    
    // Map parameters from old to new
    if (op.parameterMapping && oldNode.parameters) {
      for (const [oldParam, newParam] of Object.entries(op.parameterMapping)) {
        if (oldParam in oldNode.parameters) {
          newNode.parameters[newParam] = oldNode.parameters[oldParam];
        }
      }
    }
    
    // Add any new parameters
    if (op.newNode.parameters) {
      Object.assign(newNode.parameters, op.newNode.parameters);
    }
    
    changes.push({
      type: 'node_replaced',
      nodeId: op.nodeId,
      oldNode,
      newNode,
    });
    
    // Update connections if preserving
    if (op.preserveConnections) {
      const incomingConnections = context.connectionMap.get(`in:${op.nodeId}`) || [];
      const outgoingConnections = context.connectionMap.get(`out:${op.nodeId}`) || [];
      
      changes.push({
        type: 'connections_preserved',
        nodeId: op.nodeId,
        incoming: incomingConnections.length,
        outgoing: outgoingConnections.length,
      });
    }
    
    return {
      success: true,
      changes,
    };
  }
}

// Extract subworkflow handler
export class ExtractSubworkflowHandler implements OperationHandler<ExtractSubworkflowOp> {
  validate(op: ExtractSubworkflowOp, context: OperationContext): ValidationResult {
    const errors: string[] = [];
    
    // Check if all nodes exist
    for (const nodeId of op.nodeIds) {
      if (!context.nodeMap.has(nodeId)) {
        errors.push(`Node ${nodeId} not found`);
      }
    }
    
    // Validate input/output nodes if specified
    if (op.inputNodeId && !op.nodeIds.includes(op.inputNodeId)) {
      errors.push('Input node must be part of the extracted nodes');
    }
    
    if (op.outputNodeId && !op.nodeIds.includes(op.outputNodeId)) {
      errors.push('Output node must be part of the extracted nodes');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  async apply(op: ExtractSubworkflowOp, context: OperationContext): Promise<ApplyResult> {
    const changes: any[] = [];
    const extractedNodes: any[] = [];
    const extractedConnections: any[] = [];
    
    // Collect nodes to extract
    for (const nodeId of op.nodeIds) {
      const node = context.nodeMap.get(nodeId);
      if (node) {
        extractedNodes.push({ ...node });
      }
    }
    
    // Find connections between extracted nodes
    for (const connection of context.workflow.connections || []) {
      if (op.nodeIds.includes(connection.from) && op.nodeIds.includes(connection.to)) {
        extractedConnections.push({ ...connection });
      }
    }
    
    // Create subworkflow
    const subworkflow = {
      name: op.subworkflowName,
      nodes: extractedNodes,
      connections: extractedConnections,
      settings: {},
    };
    
    changes.push({
      type: 'subworkflow_extracted',
      nodeCount: extractedNodes.length,
      connectionCount: extractedConnections.length,
      subworkflowName: op.subworkflowName,
    });
    
    // Create Execute Workflow node if requested
    if (op.createExecuteWorkflowNode) {
      const executeNode = {
        id: `execute_${op.subworkflowName.toLowerCase().replace(/\s+/g, '_')}`,
        name: `Execute ${op.subworkflowName}`,
        type: 'n8n-nodes-base.executeWorkflow',
        position: this.calculateCenterPosition(extractedNodes),
        parameters: {
          workflowId: '{{ $parameter.subworkflowId }}', // Placeholder
        },
      };
      
      changes.push({
        type: 'execute_workflow_node_created',
        node: executeNode,
      });
    }
    
    // Remove extracted nodes from main workflow
    changes.push({
      type: 'nodes_removed',
      nodeIds: op.nodeIds,
    });
    
    return {
      success: true,
      changes,
      subworkflow,
    };
  }
  
  private calculateCenterPosition(nodes: any[]): [number, number] {
    if (nodes.length === 0) return [0, 0];
    
    let sumX = 0, sumY = 0;
    for (const node of nodes) {
      sumX += node.position[0];
      sumY += node.position[1];
    }
    
    return [
      Math.round(sumX / nodes.length),
      Math.round(sumY / nodes.length),
    ];
  }
}

// Optimize batches handler
export class OptimizeBatchesHandler implements OperationHandler<OptimizeBatchesOp> {
  validate(op: OptimizeBatchesOp, context: OperationContext): ValidationResult {
    const errors: string[] = [];
    
    // Validate target nodes if specified
    if (op.targetNodes) {
      for (const nodeId of op.targetNodes) {
        if (!context.nodeMap.has(nodeId)) {
          errors.push(`Node ${nodeId} not found`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  async apply(op: OptimizeBatchesOp, context: OperationContext): Promise<ApplyResult> {
    const changes: any[] = [];
    
    switch (op.strategy) {
      case 'merge_sets':
        changes.push(...this.mergeConsecutiveSets(context, op.targetNodes));
        break;
        
      case 'batch_http':
        changes.push(...this.batchHttpRequests(context, op.targetNodes));
        break;
        
      case 'deduplicate':
        changes.push(...this.deduplicateNodes(context, op.targetNodes));
        break;
        
      case 'parallel_execution':
        changes.push(...this.enableParallelExecution(context, op.targetNodes));
        break;
    }
    
    return {
      success: true,
      changes,
    };
  }
  
  private mergeConsecutiveSets(context: OperationContext, targetNodes?: string[]): any[] {
    const changes: any[] = [];
    const nodes = Array.from(context.nodeMap.values());
    
    // Find consecutive Set nodes
    for (let i = 0; i < nodes.length - 1; i++) {
      const node1 = nodes[i];
      const node2 = nodes[i + 1];
      
      if (node1.type === 'n8n-nodes-base.set' && 
          node2.type === 'n8n-nodes-base.set' &&
          (!targetNodes || (targetNodes.includes(node1.id) && targetNodes.includes(node2.id)))) {
        
        // Check if node2 immediately follows node1
        const connections = context.connectionMap.get(`out:${node1.id}`) || [];
        if (connections.some(c => c.to === node2.id)) {
          changes.push({
            type: 'merge_sets',
            node1: node1.id,
            node2: node2.id,
            action: 'merge node2 values into node1 and remove node2',
          });
        }
      }
    }
    
    return changes;
  }
  
  private batchHttpRequests(context: OperationContext, targetNodes?: string[]): any[] {
    const changes: any[] = [];
    const httpNodes: any[] = [];
    
    // Find HTTP Request nodes with similar configurations
    for (const [nodeId, node] of context.nodeMap) {
      if (node.type === 'n8n-nodes-base.httpRequest' &&
          (!targetNodes || targetNodes.includes(nodeId))) {
        httpNodes.push(node);
      }
    }
    
    // Group by base URL
    const urlGroups = new Map<string, any[]>();
    for (const node of httpNodes) {
      const url = node.parameters?.url;
      if (url) {
        const baseUrl = new URL(url).origin;
        if (!urlGroups.has(baseUrl)) {
          urlGroups.set(baseUrl, []);
        }
        urlGroups.get(baseUrl)!.push(node);
      }
    }
    
    // Suggest batching for groups with multiple requests
    for (const [baseUrl, nodes] of urlGroups) {
      if (nodes.length > 1) {
        changes.push({
          type: 'batch_http',
          baseUrl,
          nodes: nodes.map(n => n.id),
          action: 'combine into single batch request',
        });
      }
    }
    
    return changes;
  }
  
  private deduplicateNodes(context: OperationContext, targetNodes?: string[]): any[] {
    const changes: any[] = [];
    const nodesByType = new Map<string, any[]>();
    
    // Group nodes by type and parameters
    for (const [nodeId, node] of context.nodeMap) {
      if (!targetNodes || targetNodes.includes(nodeId)) {
        const key = `${node.type}:${JSON.stringify(node.parameters || {})}`;
        if (!nodesByType.has(key)) {
          nodesByType.set(key, []);
        }
        nodesByType.get(key)!.push(node);
      }
    }
    
    // Find duplicates
    for (const [key, nodes] of nodesByType) {
      if (nodes.length > 1) {
        changes.push({
          type: 'deduplicate',
          nodes: nodes.map(n => n.id),
          action: 'remove duplicates and reuse single node',
        });
      }
    }
    
    return changes;
  }
  
  private enableParallelExecution(context: OperationContext, targetNodes?: string[]): any[] {
    const changes: any[] = [];
    
    // Find independent branches that can run in parallel
    const visited = new Set<string>();
    const branches: string[][] = [];
    
    for (const [nodeId, node] of context.nodeMap) {
      if (!visited.has(nodeId) && (!targetNodes || targetNodes.includes(nodeId))) {
        const branch = this.findIndependentBranch(nodeId, context, visited);
        if (branch.length > 1) {
          branches.push(branch);
        }
      }
    }
    
    // Suggest parallel execution for independent branches
    if (branches.length > 1) {
      changes.push({
        type: 'parallel_execution',
        branches: branches.map(b => ({
          nodes: b,
          estimatedTimeReduction: '30-50%',
        })),
        action: 'enable parallel execution for independent branches',
      });
    }
    
    return changes;
  }
  
  private findIndependentBranch(
    startNode: string,
    context: OperationContext,
    visited: Set<string>
  ): string[] {
    const branch: string[] = [];
    const queue = [startNode];
    
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      
      visited.add(nodeId);
      branch.push(nodeId);
      
      // Add downstream nodes
      const connections = context.connectionMap.get(`out:${nodeId}`) || [];
      for (const conn of connections) {
        if (!visited.has(conn.to)) {
          queue.push(conn.to);
        }
      }
    }
    
    return branch;
  }
}