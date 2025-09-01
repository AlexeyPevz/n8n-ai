import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyIndexer } from './dependency-indexer.js';

describe('DependencyIndexer', () => {
  let indexer: DependencyIndexer;
  
  beforeEach(() => {
    indexer = new DependencyIndexer();
  });
  
  describe('Execute Workflow nodes', () => {
    it('should detect execute workflow dependencies', () => {
      const workflow = {
        id: 'workflow1',
        name: 'Main Workflow',
        nodes: [
          {
            id: 'node1',
            name: 'Execute Sub Workflow',
            type: 'n8n-nodes-base.executeWorkflow',
            parameters: {
              workflowId: 'workflow2',
            },
            position: [100, 100] as [number, number],
          },
        ],
        connections: {},
      };
      
      const result = indexer.indexWorkflow(workflow);
      
      expect(result.workflowId).toBe('workflow1');
      expect(result.dependencies).toHaveLength(1);
      expect(result.dependencies[0]).toMatchObject({
        type: 'execute_workflow',
        source: {
          nodeId: 'node1',
          nodeName: 'Execute Sub Workflow',
          nodeType: 'n8n-nodes-base.executeWorkflow',
        },
        target: {
          workflowId: 'workflow2',
        },
      });
    });
    
    it('should achieve 95%+ coverage for execute workflow nodes', () => {
      const workflows = [
        {
          id: 'wf1',
          name: 'Workflow 1',
          nodes: [
            {
              id: 'exec1',
              name: 'Execute 1',
              type: 'n8n-nodes-base.executeWorkflow',
              parameters: { workflowId: 'wf2' },
              position: [0, 0] as [number, number],
            },
            {
              id: 'exec2',
              name: 'Execute 2',
              type: 'n8n-nodes-base.executeWorkflow',
              parameters: { workflowId: 'wf3' },
              position: [0, 0] as [number, number],
            },
            {
              id: 'exec3',
              name: 'Execute 3',
              type: 'n8n-nodes-base.executeWorkflow',
              parameters: { workflowId: 'wf4' },
              position: [0, 0] as [number, number],
            },
          ],
          connections: {},
        },
      ];
      
      const depMap = indexer.buildDependencyMap(workflows);
      const coverage = indexer.calculateCoverage(depMap);
      
      expect(coverage.executeWorkflowCoverage).toBe(1.0); // 100% coverage
      expect(coverage.executeWorkflowCoverage).toBeGreaterThanOrEqual(0.95);
    });
  });
  
  describe('HTTP to Webhook matching', () => {
    it('should match exact webhook paths', () => {
      const workflows = [
        {
          id: 'webhook-wf',
          name: 'Webhook Workflow',
          nodes: [
            {
              id: 'webhook1',
              name: 'Webhook',
              type: 'n8n-nodes-base.webhook',
              parameters: { path: '/webhook/contact-form' },
              position: [0, 0] as [number, number],
            },
          ],
          connections: {},
        },
        {
          id: 'http-wf',
          name: 'HTTP Workflow',
          nodes: [
            {
              id: 'http1',
              name: 'Call Webhook',
              type: 'n8n-nodes-base.httpRequest',
              parameters: { url: 'http://localhost:5678/webhook/contact-form' },
              position: [0, 0] as [number, number],
            },
          ],
          connections: {},
        },
      ];
      
      const depMap = indexer.buildDependencyMap(workflows);
      const httpDeps = depMap.get('http-wf')!;
      
      expect(httpDeps.dependencies).toHaveLength(1);
      expect(httpDeps.dependencies[0]).toMatchObject({
        type: 'http_webhook',
        target: {
          webhookPath: '/webhook/contact-form',
          probability: 0.95,
        },
      });
    });
    
    it('should match n8n webhook URL patterns', () => {
      const workflow = {
        id: 'http-wf',
        name: 'HTTP Workflow',
        nodes: [
          {
            id: 'http1',
            name: 'Call n8n Webhook',
            type: 'n8n-nodes-base.httpRequest',
            parameters: { url: 'https://n8n.mycompany.com/webhook/order-processor' },
            position: [0, 0] as [number, number],
          },
        ],
        connections: {},
      };
      
      const result = indexer.indexWorkflow(workflow);
      
      expect(result.dependencies).toHaveLength(1);
      expect(result.dependencies[0].target.probability).toBe(0.9);
      expect(result.dependencies[0].metadata?.matchReason).toBe('n8n_webhook_pattern');
    });
    
    it('should achieve 70%+ coverage for HTTP webhook matching', () => {
      const workflows = [
        {
          id: 'webhooks',
          name: 'Webhooks',
          nodes: [
            {
              id: 'wh1',
              name: 'Form Webhook',
              type: 'n8n-nodes-base.webhook',
              parameters: { path: '/webhook/form' },
              position: [0, 0] as [number, number],
            },
            {
              id: 'wh2',
              name: 'API Webhook',
              type: 'n8n-nodes-base.webhook',
              parameters: { path: '/webhook/api' },
              position: [0, 0] as [number, number],
            },
          ],
          connections: {},
        },
        {
          id: 'http-calls',
          name: 'HTTP Calls',
          nodes: [
            // High confidence matches
            {
              id: 'http1',
              name: 'Call Form',
              type: 'n8n-nodes-base.httpRequest',
              parameters: { url: 'http://localhost:5678/webhook/form' },
              position: [0, 0] as [number, number],
            },
            {
              id: 'http2',
              name: 'Call API',
              type: 'n8n-nodes-base.httpRequest',
              parameters: { url: 'http://n8n.local/webhook/api' },
              position: [0, 0] as [number, number],
            },
            // Medium confidence match
            {
              id: 'http3',
              name: 'Internal Call',
              type: 'n8n-nodes-base.httpRequest',
              parameters: { url: 'http://localhost/webhook/processor' },
              position: [0, 0] as [number, number],
            },
            // Low confidence (no match)
            {
              id: 'http4',
              name: 'External API',
              type: 'n8n-nodes-base.httpRequest',
              parameters: { url: 'https://api.external.com/v1/data' },
              position: [0, 0] as [number, number],
            },
          ],
          connections: {},
        },
      ];
      
      const depMap = indexer.buildDependencyMap(workflows);
      const coverage = indexer.calculateCoverage(depMap);
      
      // 3 out of 4 HTTP nodes should match (75%)
      expect(coverage.httpWebhookCoverage).toBeGreaterThanOrEqual(0.7);
    });
  });
  
  describe('Dependency graph operations', () => {
    it('should find dependent workflows', () => {
      const workflows = [
        {
          id: 'wf1',
          name: 'Workflow 1',
          nodes: [
            {
              id: 'exec1',
              name: 'Execute WF2',
              type: 'n8n-nodes-base.executeWorkflow',
              parameters: { workflowId: 'wf2' },
              position: [0, 0] as [number, number],
            },
          ],
          connections: {},
        },
        {
          id: 'wf2',
          name: 'Workflow 2',
          nodes: [],
          connections: {},
        },
        {
          id: 'wf3',
          name: 'Workflow 3',
          nodes: [
            {
              id: 'exec2',
              name: 'Execute WF2',
              type: 'n8n-nodes-base.executeWorkflow',
              parameters: { workflowId: 'wf2' },
              position: [0, 0] as [number, number],
            },
          ],
          connections: {},
        },
      ];
      
      const depMap = indexer.buildDependencyMap(workflows);
      const dependents = indexer.findDependents('wf2', depMap);
      
      expect(dependents).toHaveLength(2);
      expect(dependents).toContain('wf1');
      expect(dependents).toContain('wf3');
    });
    
    it('should find workflow dependencies', () => {
      const workflows = [
        {
          id: 'main',
          name: 'Main Workflow',
          nodes: [
            {
              id: 'exec1',
              name: 'Execute Sub1',
              type: 'n8n-nodes-base.executeWorkflow',
              parameters: { workflowId: 'sub1' },
              position: [0, 0] as [number, number],
            },
            {
              id: 'exec2',
              name: 'Execute Sub2',
              type: 'n8n-nodes-base.executeWorkflow',
              parameters: { workflowId: 'sub2' },
              position: [0, 0] as [number, number],
            },
            {
              id: 'exec3',
              name: 'Execute Sub1 Again',
              type: 'n8n-nodes-base.executeWorkflow',
              parameters: { workflowId: 'sub1' },
              position: [0, 0] as [number, number],
            },
          ],
          connections: {},
        },
      ];
      
      const depMap = indexer.buildDependencyMap(workflows);
      const dependencies = indexer.findDependencies('main', depMap);
      
      expect(dependencies).toHaveLength(2); // Deduplicated
      expect(dependencies).toContain('sub1');
      expect(dependencies).toContain('sub2');
    });
  });
  
  describe('Webhook index', () => {
    it('should build webhook index correctly', () => {
      const workflows = [
        {
          id: 'wf1',
          name: 'Workflow 1',
          nodes: [
            {
              id: 'wh1',
              name: 'Webhook 1',
              type: 'n8n-nodes-base.webhook',
              parameters: { path: '/webhook/shared' },
              position: [0, 0] as [number, number],
            },
          ],
          connections: {},
        },
        {
          id: 'wf2',
          name: 'Workflow 2',
          nodes: [
            {
              id: 'wh2',
              name: 'Webhook 2',
              type: 'n8n-nodes-base.webhook',
              parameters: { path: '/webhook/shared' },
              position: [0, 0] as [number, number],
            },
            {
              id: 'wh3',
              name: 'Webhook 3',
              type: 'n8n-nodes-base.webhook',
              parameters: { path: '/webhook/unique' },
              position: [0, 0] as [number, number],
            },
          ],
          connections: {},
        },
      ];
      
      indexer.buildWebhookIndex(workflows);
      const depMap = indexer.buildDependencyMap(workflows);
      
      // Check that shared webhook paths are detected
      const deps1 = depMap.get('wf1')!.dependencies;
      const deps2 = depMap.get('wf2')!.dependencies;
      
      expect(deps1.some(d => d.target.webhookPath === '/webhook/shared')).toBe(true);
      expect(deps2.some(d => d.target.webhookPath === '/webhook/shared')).toBe(true);
      expect(deps2.some(d => d.target.webhookPath === '/webhook/unique')).toBe(true);
    });
  });
  
  describe('Edge cases', () => {
    it('should handle empty workflows', () => {
      const workflow = {
        id: 'empty',
        name: 'Empty Workflow',
        nodes: [],
        connections: {},
      };
      
      const result = indexer.indexWorkflow(workflow);
      
      expect(result.workflowId).toBe('empty');
      expect(result.dependencies).toHaveLength(0);
    });
    
    it('should handle nodes without parameters', () => {
      const workflow = {
        id: 'no-params',
        name: 'No Params',
        nodes: [
          {
            id: 'node1',
            name: 'Execute',
            type: 'n8n-nodes-base.executeWorkflow',
            position: [0, 0] as [number, number],
            // No parameters
          },
        ],
        connections: {},
      };
      
      const result = indexer.indexWorkflow(workflow);
      
      expect(result.dependencies).toHaveLength(0);
    });
    
    it('should handle invalid URLs in HTTP nodes', () => {
      const workflow = {
        id: 'invalid-url',
        name: 'Invalid URL',
        nodes: [
          {
            id: 'http1',
            name: 'Bad URL',
            type: 'n8n-nodes-base.httpRequest',
            parameters: { url: 'not-a-valid-url' },
            position: [0, 0] as [number, number],
          },
        ],
        connections: {},
      };
      
      const result = indexer.indexWorkflow(workflow);
      
      expect(result.dependencies).toHaveLength(0);
    });
  });
});