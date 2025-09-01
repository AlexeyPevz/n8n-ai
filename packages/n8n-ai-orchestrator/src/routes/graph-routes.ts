import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { OperationBatchSchema } from '@n8n-ai/schemas';
import { DiffPolicyManager, PolicyViolationError } from '../policies/diff-policies.js';
import { getDefaultPolicies } from '../policies/default-policies.js';
import { getAuditLogger, type AuditContext } from '../audit/audit-logger.js';
import { graphManager } from '../graph-manager.js';
import { metrics, METRICS } from '../metrics.js';

export async function registerGraphRoutes(
  server: FastifyInstance,
  options: FastifyPluginOptions
) {
  // Initialize policy manager
  const policies = getDefaultPolicies(process.env.POLICY_ENV);
  const policyManager = new DiffPolicyManager(policies);
  const auditLogger = getAuditLogger();
  
  // POST /api/v1/ai/graph/:workflowId/batch
  server.post('/graph/:workflowId/batch', {
    schema: {
      params: z.object({
        workflowId: z.string(),
      }),
      body: OperationBatchSchema,
    },
    handler: async (request, reply) => {
      const { workflowId } = request.params as { workflowId: string };
      const batch = request.body as z.infer<typeof OperationBatchSchema>;
      
      // Build audit context
      const auditContext: AuditContext = {
        workflowId,
        userId: request.headers['x-user-id'] as string,
        sessionId: request.headers['x-session-id'] as string,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        prompt: request.headers['x-ai-prompt'] as string,
        model: request.headers['x-ai-model'] as string,
        provider: request.headers['x-ai-provider'] as string,
      };
      
      const startTime = Date.now();
      
      try {
        // Get current workflow for context
        const currentWorkflow = await fetchWorkflow(workflowId);
        
        // Check policies
        await policyManager.checkBatchAsync(batch, {
          workflowId,
          userId: auditContext.userId,
          currentWorkflow,
          estimatedCost: Number(request.headers['x-estimated-cost']) || undefined,
        });
        
        // Apply the batch
        const result = await graphManager.applyBatch(workflowId, batch);
        
        // Log successful operation
        await auditLogger.logOperation(batch, auditContext, {
          status: 'success',
        });
        
        // Update metrics
        metrics.increment(METRICS.GRAPH_OPERATIONS, {
          workflowId,
          status: 'success',
        });
        
        // Send SSE event
        try {
          (global as any).sendSse?.('graph_mutation', {
            workflowId,
            operationCount: batch.ops.length,
            status: 'success',
          });
        } catch {}
        
        return reply.send({
          ok: true,
          result,
          executionTime: Date.now() - startTime,
        });
        
      } catch (error) {
        // Handle policy violations
        if (error instanceof PolicyViolationError) {
          await auditLogger.logPolicyViolation(batch, auditContext, [{
            policy: error.policyName,
            violation: error.violation,
            details: error.details,
          }]);
          
          metrics.increment(METRICS.GRAPH_OPERATIONS, {
            workflowId,
            status: 'policy_violation',
          });
          
          return reply.status(403).send({
            ok: false,
            error: 'policy_violation',
            policy: error.policyName,
            message: error.message,
            details: error.details,
          });
        }
        
        // Log failed operation
        await auditLogger.logOperation(batch, auditContext, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        
        metrics.increment(METRICS.GRAPH_OPERATIONS, {
          workflowId,
          status: 'error',
        });
        
        throw error;
      }
    },
  });
  
  // GET /api/v1/ai/graph/:workflowId
  server.get('/graph/:workflowId', {
    schema: {
      params: z.object({
        workflowId: z.string(),
      }),
    },
    handler: async (request, reply) => {
      const { workflowId } = request.params as { workflowId: string };
      
      try {
        const workflow = await fetchWorkflow(workflowId);
        return reply.send(workflow);
      } catch (error) {
        if ((error as any).code === 'WORKFLOW_NOT_FOUND') {
          return reply.status(404).send({
            error: 'Workflow not found',
            workflowId,
          });
        }
        throw error;
      }
    },
  });
  
  // POST /api/v1/ai/graph/:workflowId/validate
  server.post('/graph/:workflowId/validate', {
    schema: {
      params: z.object({
        workflowId: z.string(),
      }),
      body: OperationBatchSchema,
    },
    handler: async (request, reply) => {
      const { workflowId } = request.params as { workflowId: string };
      const batch = request.body as z.infer<typeof OperationBatchSchema>;
      
      try {
        // Get current workflow
        const currentWorkflow = await fetchWorkflow(workflowId);
        
        // Check policies without applying
        await policyManager.checkBatchAsync(batch, {
          workflowId,
          currentWorkflow,
        });
        
        // Run validation
        const validationResult = await (graphManager as any).validateBatch?.(workflowId, batch) ?? { valid: true, errors: [] };
        
        return reply.send({
          ok: true,
          valid: validationResult.valid,
          errors: validationResult.errors,
        });
        
      } catch (error) {
        if (error instanceof PolicyViolationError) {
          return reply.send({
            ok: true,
            valid: false,
            errors: [{
              type: 'policy_violation',
              policy: error.policyName,
              message: error.message,
              details: error.details,
            }],
          });
        }
        throw error;
      }
    },
  });
  
  // POST /api/v1/ai/graph/:workflowId/undo
  server.post('/graph/:workflowId/undo', {
    schema: {
      params: z.object({
        workflowId: z.string(),
      }),
    },
    handler: async (request, reply) => {
      const { workflowId } = request.params as { workflowId: string };
      
      const result = await graphManager.undo(workflowId);
      
      if (!result.success) {
        return reply.status(400).send({
          ok: false,
          error: 'nothing_to_undo',
        });
      }
      
      return reply.send({
        ok: true,
        result,
      });
    },
  });
  
  // POST /api/v1/ai/graph/:workflowId/redo
  server.post('/graph/:workflowId/redo', {
    schema: {
      params: z.object({
        workflowId: z.string(),
      }),
    },
    handler: async (request, reply) => {
      const { workflowId } = request.params as { workflowId: string };
      
      const result = await graphManager.redo(workflowId);
      
      if (!result.success) {
        return reply.status(400).send({
          ok: false,
          error: 'nothing_to_redo',
        });
      }
      
      return reply.send({
        ok: true,
        result,
      });
    },
  });
}

// Mock function to fetch workflow - replace with actual implementation
async function fetchWorkflow(workflowId: string): Promise<any> {
  // Use in-memory state managed by graphManager for current workflow snapshot
  const current = graphManager.getWorkflow(workflowId);
  if (!current) {
    const err = new Error('Workflow not found') as Error & { code?: string };
    err.code = 'WORKFLOW_NOT_FOUND';
    throw err;
  }
  return current;
}