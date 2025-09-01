import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { DependencyIndexer, WorkflowDependencySchema } from './dependency-indexer.js';
import type { WorkflowMapService } from './workflow-map-service.js';

// Request/Response schemas
const WorkflowMapRequestSchema = z.object({
  workflowIds: z.array(z.string()).optional(),
  includeExternal: z.boolean().default(false),
  depth: z.number().int().min(1).max(5).default(2),
});

const WorkflowNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['workflow', 'webhook', 'external']),
  metadata: z.record(z.any()).optional(),
});

const WorkflowEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  type: z.enum(['execute_workflow', 'http_webhook', 'trigger_webhook']),
  probability: z.number().min(0).max(1).optional(),
  metadata: z.record(z.any()).optional(),
});

const WorkflowMapResponseSchema = z.object({
  nodes: z.array(WorkflowNodeSchema),
  edges: z.array(WorkflowEdgeSchema),
  stats: z.object({
    totalWorkflows: z.number(),
    totalConnections: z.number(),
    executeWorkflowCoverage: z.number(),
    httpWebhookCoverage: z.number(),
  }),
  generatedAt: z.string().datetime(),
});

export async function registerWorkflowMapRoutes(
  server: FastifyInstance,
  options: FastifyPluginOptions & { mapService: WorkflowMapService }
) {
  const { mapService } = options;
  
  // GET /api/v1/ai/workflow-map
  server.get('/workflow-map', {
    schema: {
      description: 'Get workflow dependency map',
      tags: ['workflow-map'],
      querystring: WorkflowMapRequestSchema,
      response: {
        200: WorkflowMapResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const { workflowIds, includeExternal, depth } = request.query as z.infer<typeof WorkflowMapRequestSchema>;
      
      try {
        // Get workflow map
        const map = await mapService.getWorkflowMap({
          workflowIds,
          includeExternal,
          depth,
        });
        
        return reply.send(map);
      } catch (error) {
        request.log.error(error, 'Failed to get workflow map');
        return reply.status(500).send({
          error: 'Failed to generate workflow map',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  });
  
  // GET /api/v1/ai/workflow-map/:workflowId
  server.get('/workflow-map/:workflowId', {
    schema: {
      description: 'Get dependency map for a specific workflow',
      tags: ['workflow-map'],
      params: z.object({
        workflowId: z.string(),
      }),
      querystring: z.object({
        direction: z.enum(['both', 'dependencies', 'dependents']).default('both'),
        depth: z.number().int().min(1).max(5).default(2),
      }),
      response: {
        200: WorkflowMapResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const { workflowId } = request.params as { workflowId: string };
      const { direction, depth } = request.query as { direction: string; depth: number };
      
      try {
        const map = await mapService.getWorkflowDependencies(workflowId, {
          direction: direction as 'both' | 'dependencies' | 'dependents',
          depth,
        });
        
        return reply.send(map);
      } catch (error) {
        request.log.error(error, 'Failed to get workflow dependencies');
        
        if (error instanceof Error && error.message.includes('not found')) {
          return reply.status(404).send({
            error: 'Workflow not found',
            workflowId,
          });
        }
        
        return reply.status(500).send({
          error: 'Failed to get workflow dependencies',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  });
  
  // POST /api/v1/ai/workflow-map/refresh
  server.post('/workflow-map/refresh', {
    schema: {
      description: 'Refresh workflow dependency index',
      tags: ['workflow-map'],
      body: z.object({
        workflowIds: z.array(z.string()).optional(),
      }),
      response: {
        200: z.object({
          success: z.boolean(),
          indexedWorkflows: z.number(),
          duration: z.number(),
        }),
      },
    },
    handler: async (request, reply) => {
      const { workflowIds } = request.body as { workflowIds?: string[] };
      
      try {
        const startTime = Date.now();
        const result = await mapService.refreshIndex(workflowIds);
        const duration = Date.now() - startTime;
        
        return reply.send({
          success: true,
          indexedWorkflows: result.indexedWorkflows,
          duration,
        });
      } catch (error) {
        request.log.error(error, 'Failed to refresh workflow index');
        return reply.status(500).send({
          error: 'Failed to refresh workflow index',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  });
  
  // GET /api/v1/ai/workflow-map/stats
  server.get('/workflow-map/stats', {
    schema: {
      description: 'Get workflow map statistics',
      tags: ['workflow-map'],
      response: {
        200: z.object({
          totalWorkflows: z.number(),
          totalConnections: z.number(),
          coverage: z.object({
            executeWorkflow: z.number(),
            httpWebhook: z.number(),
            overall: z.number(),
          }),
          topDependencies: z.array(z.object({
            workflowId: z.string(),
            workflowName: z.string(),
            dependentCount: z.number(),
          })),
          orphanedWorkflows: z.array(z.object({
            workflowId: z.string(),
            workflowName: z.string(),
          })),
          lastIndexed: z.string().datetime().nullable(),
        }),
      },
    },
    handler: async (request, reply) => {
      try {
        const stats = await mapService.getStatistics();
        return reply.send(stats);
      } catch (error) {
        request.log.error(error, 'Failed to get workflow map statistics');
        return reply.status(500).send({
          error: 'Failed to get workflow map statistics',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  });
}