import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { build } from '../server.js';

describe('Full User Flow E2E', () => {
  let server: FastifyInstance;
  const baseUrl = 'http://localhost:3001/api/v1';

  beforeAll(async () => {
    server = await build({ logger: false });
    await server.listen({ port: 3001 });
  });

  afterAll(async () => {
    await server.close();
  });

  describe('Complete AI Workflow Creation Flow', () => {
    let workflowId: string;
    let sessionId: string;

    it('should create workflow from natural language prompt', async () => {
      // Step 1: Submit AI prompt
      const planResponse = await fetch(`${baseUrl}/ai/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Create a workflow that fetches weather data from OpenWeather API every hour and saves it to Google Sheets',
          context: {
            currentWorkflow: { nodes: [], connections: {} },
            availableNodes: ['webhook', 'schedule', 'httpRequest', 'googleSheets'],
          },
        }),
      });

      expect(planResponse.ok).toBe(true);
      const plan = await planResponse.json();
      
      expect(plan.success).toBe(true);
      expect(plan.operations.ops).toHaveLength(5); // trigger, http, sheets, connections
      expect(plan.confidence).toBeGreaterThan(0.8);
      
      sessionId = plan.sessionId;
    });

    it('should validate the generated workflow', async () => {
      // Step 2: Validate before applying
      const validateResponse = await fetch(`${baseUrl}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow: {
            nodes: [
              {
                id: 'schedule1',
                type: 'n8n-nodes-base.schedule',
                position: [250, 300],
                parameters: { rule: { interval: [{ field: 'hours', hoursInterval: 1 }] } },
              },
              {
                id: 'http1',
                type: 'n8n-nodes-base.httpRequest',
                position: [450, 300],
                parameters: {
                  url: 'https://api.openweathermap.org/data/2.5/weather',
                  qs: { q: 'London', appid: '{{$credentials.openWeatherApi.apiKey}}' },
                },
              },
              {
                id: 'sheets1',
                type: 'n8n-nodes-base.googleSheets',
                position: [650, 300],
                parameters: {
                  operation: 'append',
                  sheetId: '{{$credentials.googleSheets.sheetId}}',
                  range: 'A:E',
                },
              },
            ],
            connections: {
              schedule1: { main: [[{ node: 'http1', type: 'main', index: 0 }]] },
              http1: { main: [[{ node: 'sheets1', type: 'main', index: 0 }]] },
            },
          },
        }),
      });

      expect(validateResponse.ok).toBe(true);
      const validation = await validateResponse.json();
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      
      // Should have warnings about missing credentials
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings[0].code).toBe('MISSING_CREDENTIALS');
    });

    it('should apply workflow changes with policy check', async () => {
      // Step 3: Apply with policies
      const applyResponse = await fetch(`${baseUrl}/apply`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Id': 'test-user',
        },
        body: JSON.stringify({
          operations: {
            version: 'v1',
            ops: [
              { op: 'add_node', nodeId: 'schedule1', nodeType: 'n8n-nodes-base.schedule' },
              { op: 'add_node', nodeId: 'http1', nodeType: 'n8n-nodes-base.httpRequest' },
              { op: 'add_node', nodeId: 'sheets1', nodeType: 'n8n-nodes-base.googleSheets' },
              { op: 'connect', source: { node: 'schedule1' }, target: { node: 'http1' } },
              { op: 'connect', source: { node: 'http1' }, target: { node: 'sheets1' } },
            ],
          },
          metadata: {
            prompt: 'Create weather tracking workflow',
            sessionId,
          },
        }),
      });

      expect(applyResponse.ok).toBe(true);
      const result = await applyResponse.json();
      
      expect(result.success).toBe(true);
      expect(result.workflowId).toBeDefined();
      expect(result.policyChecks).toMatchObject({
        passed: true,
        appliedPolicies: expect.arrayContaining(['node_whitelist', 'operation_limit']),
      });
      
      workflowId = result.workflowId;
    });

    it('should retrieve workflow map with new workflow', async () => {
      // Step 4: Check workflow map
      const mapResponse = await fetch(`${baseUrl}/workflow-map`);
      
      expect(mapResponse.ok).toBe(true);
      const map = await mapResponse.json();
      
      expect(map.workflows).toContainEqual(
        expect.objectContaining({
          id: workflowId,
          nodeCount: 3,
          tags: expect.arrayContaining(['ai-generated']),
        })
      );
    });

    it('should estimate workflow cost', async () => {
      // Step 5: Get cost estimate
      const costResponse = await fetch(`${baseUrl}/workflow/${workflowId}/cost-estimate`);
      
      expect(costResponse.ok).toBe(true);
      const cost = await costResponse.json();
      
      expect(cost).toMatchObject({
        hourly: expect.objectContaining({
          apiCalls: 1, // OpenWeather API
          dataTransfer: expect.any(Number),
          totalCost: expect.any(Number),
        }),
        daily: expect.objectContaining({
          apiCalls: 24,
          totalCost: expect.any(Number),
        }),
        monthly: expect.objectContaining({
          apiCalls: 720,
          totalCost: expect.any(Number),
        }),
      });
    });

    it('should handle workflow optimization request', async () => {
      // Step 6: Request optimization
      const optimizeResponse = await fetch(`${baseUrl}/ai/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId,
          goal: 'reduce_costs',
          constraints: {
            maintainFunctionality: true,
            maxChanges: 5,
          },
        }),
      });

      expect(optimizeResponse.ok).toBe(true);
      const optimization = await optimizeResponse.json();
      
      expect(optimization.suggestions).toContainEqual(
        expect.objectContaining({
          type: 'batch_requests',
          description: expect.stringContaining('batch multiple weather requests'),
          estimatedSavings: expect.any(Number),
        })
      );
    });

    it('should create git commit for workflow', async () => {
      // Step 7: Git integration
      const gitResponse = await fetch(`${baseUrl}/git/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow: {
            id: workflowId,
            name: 'Weather Tracker',
            nodes: [], // Would include full workflow
            connections: {},
          },
          message: 'Add weather tracking workflow',
          metadata: {
            prompt: 'Create weather tracking workflow',
            model: 'gpt-4',
            userId: 'test-user',
          },
        }),
      });

      if (process.env.GIT_INTEGRATION_ENABLED === 'true') {
        expect(gitResponse.ok).toBe(true);
        const commit = await gitResponse.json();
        
        expect(commit).toMatchObject({
          success: true,
          commitHash: expect.stringMatching(/^[a-f0-9]{40}$/),
          branch: expect.any(String),
        });
      }
    });

    it('should track metrics for the entire flow', async () => {
      // Step 8: Check metrics
      const metricsResponse = await fetch(`${baseUrl}/metrics/json`);
      
      expect(metricsResponse.ok).toBe(true);
      const metrics = await metricsResponse.json();
      
      // Should have recorded AI usage
      const aiMetrics = metrics.metrics.find((m: any) => m.name === 'ai_tokens_used');
      expect(aiMetrics).toBeDefined();
      expect(aiMetrics.value).toBeGreaterThan(0);
      
      // Should have recorded HTTP requests
      const httpMetrics = metrics.metrics.find((m: any) => m.name === 'http_requests_total');
      expect(httpMetrics).toBeDefined();
      expect(httpMetrics.value).toBeGreaterThan(0);
    });

    it('should generate audit log for the session', async () => {
      // Step 9: Verify audit trail
      const auditResponse = await fetch(`${baseUrl}/audit/logs?sessionId=${sessionId}`);
      
      expect(auditResponse.ok).toBe(true);
      const logs = await auditResponse.json();
      
      expect(logs.entries).toContainEqual(
        expect.objectContaining({
          type: 'ai_prompt',
          userId: 'test-user',
          prompt: expect.stringContaining('weather'),
          model: expect.any(String),
          status: 'success',
        })
      );
      
      expect(logs.entries).toContainEqual(
        expect.objectContaining({
          type: 'workflow_creation',
          workflowId,
          operationCount: 5,
          status: 'success',
        })
      );
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle invalid prompts gracefully', async () => {
      const response = await fetch(`${baseUrl}/ai/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Do something undefined with unknown nodes',
          context: { availableNodes: ['webhook'] },
        }),
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('ambiguous');
      expect(result.suggestions).toBeDefined();
    });

    it('should enforce security policies', async () => {
      const response = await fetch(`${baseUrl}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operations: {
            version: 'v1',
            ops: [
              { 
                op: 'add_node', 
                nodeId: 'exec1', 
                nodeType: 'n8n-nodes-base.executeCommand',
                parameters: { command: 'rm -rf /' }, // Dangerous!
              },
            ],
          },
        }),
      });

      expect(response.status).toBe(403);
      const error = await response.json();
      
      expect(error.error).toContain('policy_violation');
      expect(error.violations).toContainEqual(
        expect.objectContaining({
          policy: 'node_whitelist',
          message: expect.stringContaining('not allowed'),
        })
      );
    });

    it('should handle rate limiting', async () => {
      // Make many requests quickly
      const promises = Array(20).fill(null).map(() => 
        fetch(`${baseUrl}/ai/health`)
      );

      const responses = await Promise.all(promises);
      
      // Some should be rate limited
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
      
      // Check rate limit headers
      const limited = rateLimited[0];
      expect(limited.headers.get('X-RateLimit-Limit')).toBeDefined();
      expect(limited.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(limited.headers.get('X-RateLimit-Reset')).toBeDefined();
    });
  });

  describe('Performance and Scale', () => {
    it('should handle large workflows with pagination', async () => {
      // Create a large workflow simulation
      const nodes = Array.from({ length: 100 }, (_, i) => ({
        id: `node${i}`,
        type: 'n8n-nodes-base.function',
        position: [i * 50, 0],
        parameters: {},
      }));

      const response = await fetch(`${baseUrl}/workflows/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow: { nodes, connections: {} },
          options: { 
            paginate: true,
            pageSize: 20,
          },
        }),
      });

      expect(response.ok).toBe(true);
      const analysis = await response.json();
      
      expect(analysis.pagination).toMatchObject({
        total: 100,
        pageSize: 20,
        pages: 5,
        currentPage: 1,
      });
      
      expect(analysis.data.nodes).toHaveLength(20);
      expect(analysis.links).toMatchObject({
        next: expect.stringContaining('page=2'),
        last: expect.stringContaining('page=5'),
      });
    });

    it('should stream large results', async () => {
      const response = await fetch(`${baseUrl}/workflows/export?format=ndjson`, {
        headers: { Accept: 'application/x-ndjson' },
      });

      expect(response.ok).toBe(true);
      expect(response.headers.get('content-type')).toContain('application/x-ndjson');
      
      // Read streaming response
      const reader = response.body?.getReader();
      expect(reader).toBeDefined();
      
      if (reader) {
        const { value } = await reader.read();
        expect(value).toBeDefined();
        
        // Should be able to parse as NDJSON
        const lines = new TextDecoder().decode(value).trim().split('\n');
        lines.forEach(line => {
          expect(() => JSON.parse(line)).not.toThrow();
        });
      }
    });
  });
});