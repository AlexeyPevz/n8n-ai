import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CIValidator, ValidationResult, SimulationResult } from './ci-validator.js';
import type { INodeGraph, OperationBatch } from '@n8n-ai/schemas';

describe('CIValidator', () => {
  let validator: CIValidator;
  let mockIntrospectApi: any;

  beforeEach(() => {
    mockIntrospectApi = {
      getNodeDescription: vi.fn(),
      getCredentialTypes: vi.fn(),
    };

    validator = new CIValidator({
      introspectApi: mockIntrospectApi,
      strict: true,
      enableSimulation: true,
    });
  });

  describe('workflow validation', () => {
    it('should validate a valid workflow', async () => {
      const workflow: INodeGraph = {
        nodes: [
          {
            id: 'webhook',
            name: 'Webhook',
            type: 'n8n-nodes-base.webhook',
            position: [0, 0],
            parameters: { path: 'test' },
          },
          {
            id: 'set',
            name: 'Set',
            type: 'n8n-nodes-base.set',
            position: [250, 0],
            parameters: {
              values: {
                string: [{ name: 'key', value: 'value' }],
              },
            },
          },
        ],
        connections: {
          webhook: {
            main: [[{ node: 'set', type: 'main', index: 0 }]],
          },
        },
      };

      mockIntrospectApi.getNodeDescription
        .mockResolvedValueOnce({
          name: 'n8n-nodes-base.webhook',
          inputs: [],
          outputs: ['main'],
          properties: [
            { name: 'path', type: 'string', required: true },
          ],
        })
        .mockResolvedValueOnce({
          name: 'n8n-nodes-base.set',
          inputs: ['main'],
          outputs: ['main'],
          properties: [
            { name: 'values', type: 'fixedCollection', required: true },
          ],
        });

      const result = await validator.validateWorkflow(workflow);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect missing trigger node', async () => {
      const workflow: INodeGraph = {
        nodes: [
          {
            id: 'set',
            name: 'Set',
            type: 'n8n-nodes-base.set',
            position: [0, 0],
            parameters: {},
          },
        ],
        connections: {},
      };

      mockIntrospectApi.getNodeDescription.mockResolvedValue({
        name: 'n8n-nodes-base.set',
        inputs: ['main'],
        outputs: ['main'],
        properties: [],
      });

      const result = await validator.validateWorkflow(workflow);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'MISSING_TRIGGER',
          message: expect.stringContaining('trigger node'),
        })
      );
    });

    it('should detect invalid connections', async () => {
      const workflow: INodeGraph = {
        nodes: [
          {
            id: 'webhook',
            name: 'Webhook',
            type: 'n8n-nodes-base.webhook',
            position: [0, 0],
            parameters: {},
          },
          {
            id: 'set',
            name: 'Set',
            type: 'n8n-nodes-base.set',
            position: [250, 0],
            parameters: {},
          },
        ],
        connections: {
          webhook: {
            main: [[{ node: 'nonexistent', type: 'main', index: 0 }]],
          },
        },
      };

      mockIntrospectApi.getNodeDescription
        .mockResolvedValue({
          name: 'n8n-nodes-base.webhook',
          inputs: [],
          outputs: ['main'],
          properties: [],
        });

      const result = await validator.validateWorkflow(workflow);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_CONNECTION',
          message: expect.stringContaining('nonexistent'),
        })
      );
    });

    it('should detect missing required parameters', async () => {
      const workflow: INodeGraph = {
        nodes: [
          {
            id: 'http',
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            position: [0, 0],
            parameters: {}, // Missing required 'url'
          },
        ],
        connections: {},
      };

      mockIntrospectApi.getNodeDescription.mockResolvedValue({
        name: 'n8n-nodes-base.httpRequest',
        inputs: ['main'],
        outputs: ['main'],
        properties: [
          { name: 'url', type: 'string', required: true },
          { name: 'method', type: 'options', required: true, default: 'GET' },
        ],
      });

      const result = await validator.validateWorkflow(workflow);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'MISSING_PARAMETER',
          message: expect.stringContaining('url'),
          nodeId: 'http',
        })
      );
    });

    it('should validate credential requirements', async () => {
      const workflow: INodeGraph = {
        nodes: [
          {
            id: 'gmail',
            name: 'Gmail',
            type: 'n8n-nodes-base.gmail',
            position: [0, 0],
            parameters: {},
            credentials: {}, // Missing required credentials
          },
        ],
        connections: {},
      };

      mockIntrospectApi.getNodeDescription.mockResolvedValue({
        name: 'n8n-nodes-base.gmail',
        inputs: ['main'],
        outputs: ['main'],
        credentials: [
          { name: 'gmailOAuth2', required: true },
        ],
        properties: [],
      });

      const result = await validator.validateWorkflow(workflow);

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'MISSING_CREDENTIALS',
          message: expect.stringContaining('gmailOAuth2'),
          nodeId: 'gmail',
        })
      );
    });
  });

  describe('operation batch validation', () => {
    it('should validate operation batch', async () => {
      const batch: OperationBatch = {
        version: 'v1',
        ops: [
          {
            op: 'add_node',
            nodeId: 'http1',
            nodeType: 'n8n-nodes-base.httpRequest',
            position: [0, 0],
          },
          {
            op: 'set_params',
            nodeId: 'http1',
            params: { url: 'https://api.example.com' },
          },
          {
            op: 'connect',
            source: { node: 'trigger', output: 'main' },
            target: { node: 'http1', input: 'main' },
          },
        ],
      };

      const result = await validator.validateOperationBatch(batch);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid operations', async () => {
      const batch: OperationBatch = {
        version: 'v1',
        ops: [
          {
            op: 'set_params',
            nodeId: 'nonexistent', // Setting params on non-existent node
            params: { url: 'test' },
          },
        ],
      };

      const result = await validator.validateOperationBatch(batch);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_OPERATION',
          message: expect.stringContaining('nonexistent'),
        })
      );
    });
  });

  describe('workflow simulation', () => {
    it('should simulate workflow execution', async () => {
      const workflow: INodeGraph = {
        nodes: [
          {
            id: 'webhook',
            name: 'Webhook',
            type: 'n8n-nodes-base.webhook',
            position: [0, 0],
            parameters: { path: 'test' },
          },
          {
            id: 'http',
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            position: [250, 0],
            parameters: {
              url: 'https://api.example.com/users',
              method: 'GET',
            },
          },
        ],
        connections: {
          webhook: {
            main: [[{ node: 'http', type: 'main', index: 0 }]],
          },
        },
      };

      mockIntrospectApi.getNodeDescription.mockResolvedValue({
        name: 'n8n-nodes-base.httpRequest',
        inputs: ['main'],
        outputs: ['main'],
        properties: [],
      });

      const result = await validator.simulateWorkflow(workflow, {
        inputData: { test: 'data' },
        maxExecutionTime: 30000,
      });

      expect(result.success).toBe(true);
      expect(result.executionPath).toEqual(['webhook', 'http']);
      expect(result.estimatedDuration).toBeGreaterThan(0);
      expect(result.nodeExecutions).toHaveProperty('webhook');
      expect(result.nodeExecutions).toHaveProperty('http');
    });

    it('should detect potential infinite loops', async () => {
      const workflow: INodeGraph = {
        nodes: [
          {
            id: 'start',
            name: 'Start',
            type: 'n8n-nodes-base.start',
            position: [0, 0],
            parameters: {},
          },
          {
            id: 'loop',
            name: 'Loop',
            type: 'n8n-nodes-base.function',
            position: [250, 0],
            parameters: {},
          },
        ],
        connections: {
          start: {
            main: [[{ node: 'loop', type: 'main', index: 0 }]],
          },
          loop: {
            main: [[{ node: 'loop', type: 'main', index: 0 }]], // Self-reference
          },
        },
      };

      const result = await validator.simulateWorkflow(workflow);

      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'INFINITE_LOOP',
          message: expect.stringContaining('loop detected'),
        })
      );
    });

    it('should estimate resource usage', async () => {
      const workflow: INodeGraph = {
        nodes: [
          {
            id: 'trigger',
            name: 'Trigger',
            type: 'n8n-nodes-base.webhook',
            position: [0, 0],
            parameters: {},
          },
          {
            id: 'http1',
            name: 'HTTP 1',
            type: 'n8n-nodes-base.httpRequest',
            position: [250, 0],
            parameters: { url: 'https://api1.example.com' },
          },
          {
            id: 'http2',
            name: 'HTTP 2',
            type: 'n8n-nodes-base.httpRequest',
            position: [500, 0],
            parameters: { url: 'https://api2.example.com' },
          },
        ],
        connections: {
          trigger: {
            main: [[{ node: 'http1', type: 'main', index: 0 }]],
          },
          http1: {
            main: [[{ node: 'http2', type: 'main', index: 0 }]],
          },
        },
      };

      const result = await validator.simulateWorkflow(workflow);

      expect(result.resourceEstimates).toBeDefined();
      expect(result.resourceEstimates?.apiCalls).toBe(2);
      expect(result.resourceEstimates?.estimatedCost).toBeGreaterThan(0);
      expect(result.performanceWarnings).toBeDefined();
    });
  });

  describe('security validation', () => {
    it('should detect security risks', async () => {
      const workflow: INodeGraph = {
        nodes: [
          {
            id: 'exec',
            name: 'Execute Command',
            type: 'n8n-nodes-base.executeCommand',
            position: [0, 0],
            parameters: {
              command: 'rm -rf {{$json.path}}', // Dangerous command with user input
            },
          },
        ],
        connections: {},
      };

      mockIntrospectApi.getNodeDescription.mockResolvedValue({
        name: 'n8n-nodes-base.executeCommand',
        inputs: ['main'],
        outputs: ['main'],
        properties: [
          { name: 'command', type: 'string', required: true },
        ],
      });

      const result = await validator.validateWorkflowSecurity(workflow);

      expect(result.risks).toContainEqual(
        expect.objectContaining({
          severity: 'high',
          type: 'COMMAND_INJECTION',
          nodeId: 'exec',
          message: expect.stringContaining('command injection'),
        })
      );
    });

    it('should check for exposed credentials', async () => {
      const workflow: INodeGraph = {
        nodes: [
          {
            id: 'http',
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            position: [0, 0],
            parameters: {
              url: 'https://api.example.com',
              headerParameters: {
                parameters: [
                  {
                    name: 'Authorization',
                    value: 'Bearer sk-1234567890abcdef', // Hardcoded token
                  },
                ],
              },
            },
          },
        ],
        connections: {},
      };

      const result = await validator.validateWorkflowSecurity(workflow);

      expect(result.risks).toContainEqual(
        expect.objectContaining({
          severity: 'high',
          type: 'EXPOSED_CREDENTIAL',
          nodeId: 'http',
          message: expect.stringContaining('hardcoded credential'),
        })
      );
    });
  });

  describe('performance analysis', () => {
    it('should analyze workflow performance', async () => {
      const workflow: INodeGraph = {
        nodes: Array.from({ length: 50 }, (_, i) => ({
          id: `node${i}`,
          name: `Node ${i}`,
          type: 'n8n-nodes-base.function',
          position: [i * 100, 0],
          parameters: {},
        })),
        connections: {},
      };

      const result = await validator.analyzePerformance(workflow);

      expect(result.metrics).toBeDefined();
      expect(result.metrics.nodeCount).toBe(50);
      expect(result.metrics.complexity).toBeGreaterThan(1);
      expect(result.bottlenecks).toBeDefined();
      expect(result.optimizationSuggestions).toBeDefined();
    });
  });
});