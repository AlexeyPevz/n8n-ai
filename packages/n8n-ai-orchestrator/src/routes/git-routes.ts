import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { OperationBatchSchema } from '@n8n-ai/schemas';
import { createGitIntegration } from '../git/git-integration.js';
import { getAuditLogger } from '../audit/audit-logger.js';

const GitCommitRequestSchema = z.object({
  workflowId: z.string(),
  workflowName: z.string(),
  operationBatch: OperationBatchSchema,
  prompt: z.string().optional(),
  description: z.string().optional(),
});

export async function registerGitRoutes(
  server: FastifyInstance,
  options: FastifyPluginOptions
) {
  const gitIntegration = createGitIntegration();
  const auditLogger = getAuditLogger();
  
  if (!gitIntegration) {
    // Git integration is disabled
    server.post('/git/commit', async (request, reply) => {
      return reply.status(501).send({
        error: 'Git integration is not enabled',
        message: 'Set GIT_INTEGRATION_ENABLED=true to enable Git integration',
      });
    });
    
    return;
  }
  
  // POST /api/v1/ai/git/commit
  server.post('/git/commit', {
    schema: {
      body: GitCommitRequestSchema,
      response: {
        200: z.object({
          success: z.boolean(),
          commitHash: z.string().optional(),
          branch: z.string().optional(),
          pullRequestUrl: z.string().optional(),
          diffUrl: z.string().optional(),
          error: z.string().optional(),
        }),
      },
    },
    handler: async (request, reply) => {
      const body = request.body as z.infer<typeof GitCommitRequestSchema>;
      
      try {
        // Create commit
        const result = await gitIntegration.createCommit(
          body.workflowId,
          body.workflowName,
          body.operationBatch,
          {
            userId: request.headers['x-user-id'] as string,
            prompt: body.prompt,
            description: body.description,
          }
        );
        
        // Log to audit
        await auditLogger.logOperation(
          body.operationBatch,
          {
            workflowId: body.workflowId,
            workflowName: body.workflowName,
            userId: request.headers['x-user-id'] as string,
            metadata: {
              gitOperation: 'commit',
              commitHash: result.commitHash,
              branch: result.branch,
              pullRequestUrl: result.pullRequestUrl,
            },
          },
          {
            status: result.success ? 'success' : 'failed',
            error: result.error,
          }
        );
        
        if (!result.success) {
          return reply.status(500).send(result);
        }
        
        return reply.send(result);
        
      } catch (error) {
        server.log.error(error, 'Git commit failed');
        
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Git operation failed',
        });
      }
    },
  });
  
  // GET /api/v1/ai/git/status
  server.get('/git/status', {
    schema: {
      response: {
        200: z.object({
          enabled: z.boolean(),
          configured: z.boolean(),
          provider: z.string().optional(),
          branch: z.string().optional(),
          remote: z.string().optional(),
        }),
      },
    },
    handler: async (request, reply) => {
      // Check Git configuration status
      const config = {
        enabled: true,
        configured: !!process.env.GIT_REPO_PATH,
        provider: process.env.GIT_PROVIDER || 'github',
        branch: process.env.GIT_BRANCH || 'main',
        remote: process.env.GIT_REMOTE || 'origin',
      };
      
      return reply.send(config);
    },
  });
  
  // POST /api/v1/ai/git/validate
  server.post('/git/validate', {
    schema: {
      body: z.object({
        workflowId: z.string(),
        operationBatch: OperationBatchSchema,
      }),
      response: {
        200: z.object({
          valid: z.boolean(),
          errors: z.array(z.object({
            type: z.string(),
            message: z.string(),
            details: z.any().optional(),
          })).optional(),
          warnings: z.array(z.object({
            type: z.string(),
            message: z.string(),
            details: z.any().optional(),
          })).optional(),
        }),
      },
    },
    handler: async (request, reply) => {
      const { workflowId, operationBatch } = request.body as any;
      
      // Perform validation checks for Git commit
      const errors: any[] = [];
      const warnings: any[] = [];
      
      // Check operation count
      if (operationBatch.ops.length > 50) {
        warnings.push({
          type: 'large_changeset',
          message: 'Large number of operations may be hard to review',
          details: { operationCount: operationBatch.ops.length },
        });
      }
      
      // Check for destructive operations
      const deleteOps = operationBatch.ops.filter((op: any) => op.op === 'delete');
      if (deleteOps.length > 0) {
        warnings.push({
          type: 'destructive_operations',
          message: `Changeset contains ${deleteOps.length} delete operation(s)`,
          details: { deleteCount: deleteOps.length },
        });
      }
      
      // Check for credential changes
      const hasCredentials = operationBatch.ops.some((op: any) => 
        op.op === 'set_params' && 
        op.params && 
        Object.keys(op.params).some(key => 
          key.toLowerCase().includes('credential') ||
          key.toLowerCase().includes('auth') ||
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('secret')
        )
      );
      
      if (hasCredentials) {
        errors.push({
          type: 'credential_change',
          message: 'Operation batch contains credential or authentication changes',
          details: { 
            recommendation: 'Credentials should be managed through n8n UI, not Git',
          },
        });
      }
      
      return reply.send({
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
      });
    },
  });
}