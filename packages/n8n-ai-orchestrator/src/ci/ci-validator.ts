import { z } from 'zod';
import type { OperationBatch } from '@n8n-ai/schemas';
import { OperationBatchSchema } from '@n8n-ai/schemas';
import { DiffPolicyManager } from '../policies/diff-policies.js';
import { getDefaultPolicies } from '../policies/default-policies.js';

// CI validation result schema
export const CIValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.object({
    type: z.string(),
    severity: z.enum(['error', 'warning', 'info']),
    message: z.string(),
    location: z.any().optional(),
    suggestion: z.string().optional(),
  })),
  stats: z.object({
    totalChecks: z.number(),
    passedChecks: z.number(),
    failedChecks: z.number(),
    warnings: z.number(),
  }),
  duration: z.number(), // milliseconds
});

export type CIValidationResult = z.infer<typeof CIValidationResultSchema>;

// CI simulation result schema
export const CISimulationResultSchema = z.object({
  success: z.boolean(),
  executionPlan: z.array(z.object({
    nodeId: z.string(),
    nodeName: z.string(),
    nodeType: z.string(),
    estimatedDuration: z.number(), // milliseconds
    dependencies: z.array(z.string()),
    outputItemCount: z.number().optional(),
  })),
  estimatedTotalDuration: z.number(), // milliseconds
  resourceUsage: z.object({
    memory: z.number(), // MB
    cpu: z.number(), // percentage
    apiCalls: z.number(),
  }),
  warnings: z.array(z.string()),
});

export type CISimulationResult = z.infer<typeof CISimulationResultSchema>;

export class CIValidator {
  private policyManager: DiffPolicyManager;
  
  constructor() {
    const policies = getDefaultPolicies('strict'); // Use strict policies for CI
    this.policyManager = new DiffPolicyManager(policies);
  }
  
  /**
   * Validate workflow changes for CI
   */
  async validate(
    workflowId: string,
    batch: OperationBatch,
    context?: {
      baseWorkflow?: any;
      targetBranch?: string;
    }
  ): Promise<CIValidationResult> {
    const startTime = Date.now();
    const errors: CIValidationResult['errors'] = [];
    let totalChecks = 0;
    let passedChecks = 0;
    
    // 1. Schema validation
    totalChecks++;
    try {
      (OperationBatchSchema as any).parse ? (OperationBatchSchema as any).parse(batch) : null;
      passedChecks++;
    } catch (error) {
      errors.push({
        type: 'schema_validation',
        severity: 'error',
        message: 'Operation batch failed schema validation',
        location: error,
      });
    }
    
    // 2. Policy validation
    totalChecks++;
    try {
      await this.policyManager.checkBatchAsync(batch, {
        workflowId,
        currentWorkflow: context?.baseWorkflow,
      });
      passedChecks++;
    } catch (error: any) {
      errors.push({
        type: 'policy_violation',
        severity: 'error',
        message: error.message,
        location: error.details,
      });
    }
    
    // 3. Node type validation
    totalChecks++;
    const invalidNodes = this.validateNodeTypes(batch);
    if (invalidNodes.length === 0) {
      passedChecks++;
    } else {
      invalidNodes.forEach(node => {
        errors.push({
          type: 'invalid_node_type',
          severity: 'error',
          message: `Unknown node type: ${node.type}`,
          location: { nodeId: node.id },
        });
      });
    }
    
    // 4. Connection validation
    totalChecks++;
    const connectionErrors = this.validateConnections(batch, context?.baseWorkflow);
    if (connectionErrors.length === 0) {
      passedChecks++;
    } else {
      errors.push(...connectionErrors);
    }
    
    // 5. Parameter validation
    totalChecks++;
    const paramErrors = this.validateParameters(batch);
    if (paramErrors.length === 0) {
      passedChecks++;
    } else {
      errors.push(...paramErrors);
    }
    
    // 6. Workflow complexity check
    totalChecks++;
    const complexityWarnings = this.checkComplexity(batch, context?.baseWorkflow);
    if (complexityWarnings.length === 0) {
      passedChecks++;
    } else {
      errors.push(...complexityWarnings);
    }
    
    // 7. Security checks
    totalChecks++;
    const securityIssues = this.performSecurityChecks(batch);
    if (securityIssues.length === 0) {
      passedChecks++;
    } else {
      errors.push(...securityIssues);
    }
    
    const failedChecks = totalChecks - passedChecks;
    const warnings = errors.filter(e => e.severity === 'warning').length;
    
    return {
      valid: errors.filter(e => e.severity === 'error').length === 0,
      errors,
      stats: {
        totalChecks,
        passedChecks,
        failedChecks,
        warnings,
      },
      duration: Date.now() - startTime,
    };
  }
  
  /**
   * Simulate workflow execution
   */
  async simulate(
    workflowId: string,
    batch: OperationBatch,
    context?: {
      baseWorkflow?: any;
      inputData?: any;
    }
  ): Promise<CISimulationResult> {
    const executionPlan: CISimulationResult['executionPlan'] = [];
    const warnings: string[] = [];
    
    // Build workflow from batch
    const workflow = this.buildWorkflowFromBatch(batch, context?.baseWorkflow);
    
    // Analyze execution order
    const executionOrder = this.analyzeExecutionOrder(workflow);
    
    // Simulate each node
    let totalDuration = 0;
    let totalMemory = 0;
    let totalApiCalls = 0;
    
    for (const nodeId of executionOrder) {
      const node = workflow.nodes.find((n: any) => n.id === nodeId);
      if (!node) continue;
      
      const simulation = this.simulateNode(node, workflow);
      
      executionPlan.push({
        nodeId: node.id,
        nodeName: node.name || node.type,
        nodeType: node.type,
        estimatedDuration: simulation.duration,
        dependencies: this.getNodeDependencies(nodeId, workflow),
        outputItemCount: simulation.outputItems,
      });
      
      totalDuration += simulation.duration;
      totalMemory = Math.max(totalMemory, simulation.memory);
      totalApiCalls += simulation.apiCalls;
      
      if (simulation.warning) {
        warnings.push(simulation.warning);
      }
    }
    
    return {
      success: warnings.length === 0,
      executionPlan,
      estimatedTotalDuration: totalDuration,
      resourceUsage: {
        memory: totalMemory,
        cpu: Math.min(100, executionOrder.length * 10), // Rough estimate
        apiCalls: totalApiCalls,
      },
      warnings,
    };
  }
  
  // Validation helpers
  
  private validateNodeTypes(batch: OperationBatch): any[] {
    const invalidNodes: any[] = [];
    const knownTypes = new Set([
      'n8n-nodes-base.httpRequest',
      'n8n-nodes-base.webhook',
      'n8n-nodes-base.set',
      'n8n-nodes-base.function',
      'n8n-nodes-base.if',
      'n8n-nodes-base.switch',
      'n8n-nodes-base.merge',
      'n8n-nodes-base.executeWorkflow',
      // Add more as needed
    ]);
    
    for (const op of batch.ops) {
      if (op.op === 'add_node') {
        if (!knownTypes.has(op.node.type)) {
          invalidNodes.push(op.node);
        }
      }
    }
    
    return invalidNodes;
  }
  
  private validateConnections(
    batch: OperationBatch,
    baseWorkflow?: any
  ): CIValidationResult['errors'] {
    const errors: CIValidationResult['errors'] = [];
    const nodeIds = new Set<string>();
    
    // Collect existing nodes
    if (baseWorkflow?.nodes) {
      baseWorkflow.nodes.forEach((n: any) => nodeIds.add(n.id));
    }
    
    // Track added/deleted nodes
    for (const op of batch.ops) {
      if (op.op === 'add_node') {
        nodeIds.add(op.node.id);
      } else if (op.op === 'delete') {
        nodeIds.delete(op.nodeId);
      }
    }
    
    // Validate connections
    for (const op of batch.ops) {
      if (op.op === 'connect') {
        if (!nodeIds.has(op.from.nodeId)) {
          errors.push({
            type: 'invalid_connection',
            severity: 'error',
            message: `Connection from non-existent node: ${op.from.nodeId}`,
            location: { operation: op },
          });
        }
        if (!nodeIds.has(op.to.nodeId)) {
          errors.push({
            type: 'invalid_connection',
            severity: 'error',
            message: `Connection to non-existent node: ${op.to.nodeId}`,
            location: { operation: op },
          });
        }
      }
    }
    
    return errors;
  }
  
  private validateParameters(batch: OperationBatch): CIValidationResult['errors'] {
    const errors: CIValidationResult['errors'] = [];
    
    for (const op of batch.ops) {
      if (op.op === 'set_params' || op.op === 'add_node') {
        const params = op.op === 'set_params' ? op.params : op.node.parameters;
        
        // Check for empty required parameters
        if (params) {
          for (const [key, value] of Object.entries(params)) {
            if (value === '' || value === null) {
              errors.push({
                type: 'empty_parameter',
                severity: 'warning',
                message: `Empty parameter: ${key}`,
                location: { 
                  nodeId: op.op === 'set_params' ? op.nodeId : op.node.id,
                  parameter: key,
                },
                suggestion: 'Provide a value or remove the parameter',
              });
            }
          }
        }
      }
    }
    
    return errors;
  }
  
  private checkComplexity(
    batch: OperationBatch,
    baseWorkflow?: any
  ): CIValidationResult['errors'] {
    const warnings: CIValidationResult['errors'] = [];
    
    // Count total nodes after applying batch
    let nodeCount = baseWorkflow?.nodes?.length || 0;
    let connectionCount = baseWorkflow?.connections?.length || 0;
    
    for (const op of batch.ops) {
      if (op.op === 'add_node') nodeCount++;
      if (op.op === 'delete') nodeCount--;
      if (op.op === 'connect') connectionCount++;
    }
    
    if (nodeCount > 50) {
      warnings.push({
        type: 'high_complexity',
        severity: 'warning',
        message: `Workflow has ${nodeCount} nodes, which may impact performance`,
        suggestion: 'Consider breaking into sub-workflows',
      });
    }
    
    if (connectionCount > 100) {
      warnings.push({
        type: 'high_complexity',
        severity: 'warning',
        message: `Workflow has ${connectionCount} connections`,
        suggestion: 'Review workflow structure for optimization opportunities',
      });
    }
    
    return warnings;
  }
  
  private performSecurityChecks(batch: OperationBatch): CIValidationResult['errors'] {
    const issues: CIValidationResult['errors'] = [];
    
    for (const op of batch.ops) {
      if (op.op === 'set_params' || op.op === 'add_node') {
        const params = op.op === 'set_params' ? op.params : op.node.parameters;
        
        if (params) {
          const paramStr = JSON.stringify(params);
          
          // Check for hardcoded credentials
          if (/api[_-]?key|password|secret|token/i.test(paramStr)) {
            issues.push({
              type: 'security_risk',
              severity: 'error',
              message: 'Possible hardcoded credentials detected',
              location: { 
                nodeId: op.op === 'set_params' ? op.nodeId : op.node.id,
              },
              suggestion: 'Use n8n credentials instead of hardcoding sensitive data',
            });
          }
          
          // Check for unsafe URLs
          const urlRegex = /https?:\/\/[^\s"']+/g;
          const urls = paramStr.match(urlRegex) || [];
          for (const url of urls) {
            if (url.includes('localhost') || url.includes('127.0.0.1')) {
              issues.push({
                type: 'security_warning',
                severity: 'warning',
                message: 'URL points to localhost',
                location: { url },
                suggestion: 'Use environment-specific URLs',
              });
            }
          }
        }
      }
    }
    
    return issues;
  }
  
  // Simulation helpers
  
  private buildWorkflowFromBatch(batch: OperationBatch, baseWorkflow?: any): any {
    // Simple implementation - would need more sophisticated logic
    const workflow = {
      nodes: [...(baseWorkflow?.nodes || [])],
      connections: { ...(baseWorkflow?.connections || {}) },
    };
    
    for (const op of batch.ops) {
      switch (op.op) {
        case 'add_node':
          workflow.nodes.push(op.node);
          break;
        case 'delete':
          workflow.nodes = workflow.nodes.filter((n: any) => n.id !== op.nodeId);
          break;
        // Handle other operations
      }
    }
    
    return workflow;
  }
  
  private analyzeExecutionOrder(workflow: any): string[] {
    // Simple topological sort
    const order: string[] = [];
    const visited = new Set<string>();
    
    // Find trigger nodes
    const triggers = workflow.nodes.filter((n: any) => 
      n.type.includes('trigger') || n.type.includes('webhook')
    );
    
    // Start from triggers
    for (const trigger of triggers) {
      this.visitNode(trigger.id, workflow, visited, order);
    }
    
    // Add any unvisited nodes
    for (const node of workflow.nodes) {
      if (!visited.has(node.id)) {
        this.visitNode(node.id, workflow, visited, order);
      }
    }
    
    return order;
  }
  
  private visitNode(
    nodeId: string,
    workflow: any,
    visited: Set<string>,
    order: string[]
  ): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    
    // Visit dependencies first
    // (simplified - would need proper connection handling)
    
    order.push(nodeId);
  }
  
  private getNodeDependencies(nodeId: string, workflow: any): string[] {
    // Simplified - return empty array
    return [];
  }
  
  private simulateNode(node: any, workflow: any): {
    duration: number;
    memory: number;
    apiCalls: number;
    outputItems?: number;
    warning?: string;
  } {
    // Base estimates by node type
    const estimates: Record<string, any> = {
      'httpRequest': { duration: 500, memory: 50, apiCalls: 1 },
      'webhook': { duration: 10, memory: 10, apiCalls: 0 },
      'set': { duration: 5, memory: 20, apiCalls: 0 },
      'function': { duration: 50, memory: 100, apiCalls: 0 },
      'executeWorkflow': { duration: 1000, memory: 200, apiCalls: 0 },
    };
    
    const nodeTypeKey = Object.keys(estimates).find(key => 
      node.type.includes(key)
    );
    
    const estimate = estimates[nodeTypeKey || ''] || {
      duration: 10,
      memory: 20,
      apiCalls: 0,
    };
    
    // Add warnings for specific conditions
    let warning: string | undefined;
    
    if (node.type.includes('httpRequest') && !node.parameters?.url) {
      warning = `HTTP Request node ${node.id} missing URL parameter`;
    }
    
    return {
      ...estimate,
      warning,
    };
  }
}