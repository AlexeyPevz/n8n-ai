import { z } from 'zod';
import { OperationBatchSchema } from '@n8n-ai/schemas';
import { DiffPolicyManager, PolicyViolationError } from '../policies/diff-policies.js';
import { getDefaultPolicies } from '../policies/default-policies.js';
import { getAuditLogger } from '../audit/audit-logger.js';
import { graphManager } from '../graph-manager.js';
import { metrics, METRICS } from '../metrics.js';
export async function registerGraphRoutes(server, options) {
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
            const { workflowId } = request.params;
            const batch = request.body;
            // Build audit context
            const auditContext = {
                workflowId,
                userId: request.headers['x-user-id'],
                sessionId: request.headers['x-session-id'],
                ipAddress: request.ip,
                userAgent: request.headers['user-agent'],
                prompt: request.headers['x-ai-prompt'],
                model: request.headers['x-ai-model'],
                provider: request.headers['x-ai-provider'],
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
                    global.sendSse?.('graph_mutation', {
                        workflowId,
                        operationCount: batch.ops.length,
                        status: 'success',
                    });
                }
                catch { }
                return reply.send({
                    ok: true,
                    result,
                    executionTime: Date.now() - startTime,
                });
            }
            catch (error) {
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
            const { workflowId } = request.params;
            try {
                const workflow = await fetchWorkflow(workflowId);
                return reply.send(workflow);
            }
            catch (error) {
                if (error.code === 'WORKFLOW_NOT_FOUND') {
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
            const { workflowId } = request.params;
            const batch = request.body;
            try {
                // Get current workflow
                const currentWorkflow = await fetchWorkflow(workflowId);
                // Check policies without applying
                await policyManager.checkBatchAsync(batch, {
                    workflowId,
                    currentWorkflow,
                });
                // Run validation
                const validationResult = await graphManager.validateBatch?.(workflowId, batch) ?? { valid: true, errors: [] };
                return reply.send({
                    ok: true,
                    valid: validationResult.valid,
                    errors: validationResult.errors,
                });
            }
            catch (error) {
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
            const { workflowId } = request.params;
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
            const { workflowId } = request.params;
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
async function fetchWorkflow(workflowId) {
    // Use in-memory state managed by graphManager for current workflow snapshot
    const current = graphManager.getWorkflow(workflowId);
    if (!current) {
        const err = new Error('Workflow not found');
        err.code = 'WORKFLOW_NOT_FOUND';
        throw err;
    }
    return current;
}
