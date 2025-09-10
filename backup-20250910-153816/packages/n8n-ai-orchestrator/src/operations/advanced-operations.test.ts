import { describe, it, expect } from 'vitest';
import { 
  replaceNode, 
  extractSubworkflow, 
  optimizeBatches,
  mergeSequentialNodes,
  parallelizeIndependentNodes 
} from './advanced-operations.js';
import type { OperationBatch, INodeGraph } from '@n8n-ai/schemas';

describe('Advanced Operations', () => {
  describe('replaceNode', () => {
    it('should replace node and preserve connections', () => {
      const graph: INodeGraph = {
        nodes: [
          { id: 'webhook', name: 'Webhook', type: 'n8n-nodes-base.webhook', position: [0, 0], parameters: {} },
          { id: 'http1', name: 'HTTP Request', type: 'n8n-nodes-base.httpRequest', position: [250, 0], parameters: { url: 'old.com' } },
          { id: 'set', name: 'Set', type: 'n8n-nodes-base.set', position: [500, 0], parameters: {} },
        ],
        connections: {
          'webhook': { main: [[{ node: 'http1', type: 'main', index: 0 }]] },
          'http1': { main: [[{ node: 'set', type: 'main', index: 0 }]] },
        },
      };

      const result = replaceNode(graph, 'http1', 'n8n-nodes-base.httpRequest', {
        url: 'new.com',
        method: 'POST',
      });

      expect(result.ops).toHaveLength(4);
      expect(result.ops[0]).toMatchObject({ op: 'delete', nodeId: 'http1' });
      expect(result.ops[1]).toMatchObject({ 
        op: 'add_node', 
        nodeType: 'n8n-nodes-base.httpRequest',
        parameters: { url: 'new.com', method: 'POST' },
      });
      expect(result.ops[2]).toMatchObject({ 
        op: 'connect', 
        source: { node: 'webhook', output: 'main', index: 0 },
      });
      expect(result.ops[3]).toMatchObject({ 
        op: 'connect',
        source: { output: 'main', index: 0 },
        target: { node: 'set', input: 'main', index: 0 },
      });
    });

    it('should handle nodes with multiple connections', () => {
      const graph: INodeGraph = {
        nodes: [
          { id: 'if', name: 'IF', type: 'n8n-nodes-base.if', position: [0, 0], parameters: {} },
          { id: 'set1', name: 'Set1', type: 'n8n-nodes-base.set', position: [250, -100], parameters: {} },
          { id: 'set2', name: 'Set2', type: 'n8n-nodes-base.set', position: [250, 100], parameters: {} },
        ],
        connections: {
          'if': { 
            main: [
              [{ node: 'set1', type: 'main', index: 0 }],
              [{ node: 'set2', type: 'main', index: 0 }],
            ],
          },
        },
      };

      const result = replaceNode(graph, 'if', 'n8n-nodes-base.switch', {
        dataType: 'string',
        value1: '={{ $json.status }}',
      });

      // Should preserve both output connections
      const connectOps = result.ops.filter(op => op.op === 'connect');
      expect(connectOps).toHaveLength(2);
      expect(connectOps[0].target.node).toBe('set1');
      expect(connectOps[1].target.node).toBe('set2');
    });
  });

  describe('extractSubworkflow', () => {
    it('should extract connected nodes into subworkflow', () => {
      const graph: INodeGraph = {
        nodes: [
          { id: 'webhook', name: 'Webhook', type: 'n8n-nodes-base.webhook', position: [0, 0], parameters: {} },
          { id: 'http1', name: 'HTTP1', type: 'n8n-nodes-base.httpRequest', position: [250, 0], parameters: {} },
          { id: 'http2', name: 'HTTP2', type: 'n8n-nodes-base.httpRequest', position: [500, 0], parameters: {} },
          { id: 'set', name: 'Set', type: 'n8n-nodes-base.set', position: [750, 0], parameters: {} },
        ],
        connections: {
          'webhook': { main: [[{ node: 'http1', type: 'main', index: 0 }]] },
          'http1': { main: [[{ node: 'http2', type: 'main', index: 0 }]] },
          'http2': { main: [[{ node: 'set', type: 'main', index: 0 }]] },
        },
      };

      const result = extractSubworkflow(graph, ['http1', 'http2'], 'API Calls Subworkflow');

      // Should have operations to delete nodes and add execute workflow node
      expect(result.ops.some(op => op.op === 'delete' && op.nodeId === 'http1')).toBe(true);
      expect(result.ops.some(op => op.op === 'delete' && op.nodeId === 'http2')).toBe(true);
      expect(result.ops.some(op => 
        op.op === 'add_node' && 
        op.nodeType === 'n8n-nodes-base.executeWorkflow' &&
        op.name === 'API Calls Subworkflow'
      )).toBe(true);

      // Should connect webhook to execute workflow and execute workflow to set
      const connectOps = result.ops.filter(op => op.op === 'connect');
      expect(connectOps).toHaveLength(2);
    });

    it('should handle extraction with multiple entry/exit points', () => {
      const graph: INodeGraph = {
        nodes: [
          { id: 'webhook1', name: 'Webhook1', type: 'n8n-nodes-base.webhook', position: [0, -100], parameters: {} },
          { id: 'webhook2', name: 'Webhook2', type: 'n8n-nodes-base.webhook', position: [0, 100], parameters: {} },
          { id: 'merge', name: 'Merge', type: 'n8n-nodes-base.merge', position: [250, 0], parameters: {} },
          { id: 'process', name: 'Process', type: 'n8n-nodes-base.function', position: [500, 0], parameters: {} },
          { id: 'split', name: 'Split', type: 'n8n-nodes-base.split', position: [750, 0], parameters: {} },
        ],
        connections: {
          'webhook1': { main: [[{ node: 'merge', type: 'main', index: 0 }]] },
          'webhook2': { main: [[{ node: 'merge', type: 'main', index: 1 }]] },
          'merge': { main: [[{ node: 'process', type: 'main', index: 0 }]] },
          'process': { main: [[{ node: 'split', type: 'main', index: 0 }]] },
        },
      };

      const result = extractSubworkflow(graph, ['merge', 'process'], 'Processing Subworkflow');

      // Should properly handle multiple inputs
      const executeWorkflowOp = result.ops.find(op => 
        op.op === 'add_node' && op.nodeType === 'n8n-nodes-base.executeWorkflow'
      );
      expect(executeWorkflowOp).toBeDefined();
    });
  });

  describe('optimizeBatches', () => {
    it('should merge consecutive set_params operations', () => {
      const batch: OperationBatch = {
        version: 'v1',
        ops: [
          { op: 'add_node', nodeId: 'http1', nodeType: 'n8n-nodes-base.httpRequest', position: [0, 0] },
          { op: 'set_params', nodeId: 'http1', params: { url: 'example.com' } },
          { op: 'set_params', nodeId: 'http1', params: { method: 'POST' } },
          { op: 'set_params', nodeId: 'http1', params: { headers: { 'Content-Type': 'application/json' } } },
        ],
      };

      const optimized = optimizeBatches(batch);

      expect(optimized.ops).toHaveLength(2);
      expect(optimized.ops[0].op).toBe('add_node');
      expect(optimized.ops[1]).toMatchObject({
        op: 'set_params',
        nodeId: 'http1',
        params: {
          url: 'example.com',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
      });
    });

    it('should combine add_node with immediate set_params', () => {
      const batch: OperationBatch = {
        version: 'v1',
        ops: [
          { op: 'add_node', nodeId: 'set1', nodeType: 'n8n-nodes-base.set', position: [0, 0] },
          { op: 'set_params', nodeId: 'set1', params: { values: { string: [{ name: 'test', value: 'value' }] } } },
          { op: 'add_node', nodeId: 'set2', nodeType: 'n8n-nodes-base.set', position: [250, 0] },
          { op: 'connect', source: { node: 'set1', output: 'main' }, target: { node: 'set2', input: 'main' } },
        ],
      };

      const optimized = optimizeBatches(batch);

      expect(optimized.ops[0]).toMatchObject({
        op: 'add_node',
        nodeId: 'set1',
        parameters: { values: { string: [{ name: 'test', value: 'value' }] } },
      });
      expect(optimized.ops.filter(op => op.op === 'set_params')).toHaveLength(0);
    });
  });

  describe('mergeSequentialNodes', () => {
    it('should merge sequential HTTP requests', () => {
      const graph: INodeGraph = {
        nodes: [
          { id: 'http1', name: 'API Call 1', type: 'n8n-nodes-base.httpRequest', position: [0, 0], 
            parameters: { url: 'api.com/users', method: 'GET' } },
          { id: 'http2', name: 'API Call 2', type: 'n8n-nodes-base.httpRequest', position: [250, 0], 
            parameters: { url: 'api.com/posts', method: 'GET' } },
          { id: 'http3', name: 'API Call 3', type: 'n8n-nodes-base.httpRequest', position: [500, 0], 
            parameters: { url: 'api.com/comments', method: 'GET' } },
        ],
        connections: {
          'http1': { main: [[{ node: 'http2', type: 'main', index: 0 }]] },
          'http2': { main: [[{ node: 'http3', type: 'main', index: 0 }]] },
        },
      };

      const result = mergeSequentialNodes(graph, ['http1', 'http2', 'http3']);

      // Should create a code node that makes all requests
      expect(result.ops.some(op => op.op === 'add_node' && op.nodeType === 'n8n-nodes-base.function')).toBe(true);
      expect(result.ops.filter(op => op.op === 'delete').length).toBe(3);
    });
  });

  describe('parallelizeIndependentNodes', () => {
    it('should identify and parallelize independent nodes', () => {
      const graph: INodeGraph = {
        nodes: [
          { id: 'trigger', name: 'Trigger', type: 'n8n-nodes-base.webhook', position: [0, 0], parameters: {} },
          { id: 'http1', name: 'API 1', type: 'n8n-nodes-base.httpRequest', position: [250, -100], parameters: {} },
          { id: 'http2', name: 'API 2', type: 'n8n-nodes-base.httpRequest', position: [250, 100], parameters: {} },
          { id: 'merge', name: 'Merge', type: 'n8n-nodes-base.merge', position: [500, 0], parameters: {} },
        ],
        connections: {
          'trigger': { main: [[{ node: 'http1', type: 'main', index: 0 }]] },
          'http1': { main: [[{ node: 'merge', type: 'main', index: 0 }]] },
          'http2': { main: [[{ node: 'merge', type: 'main', index: 1 }]] },
        },
      };

      // Note: http2 is not connected to trigger, which is incorrect for parallel execution
      // The function should add the missing connection
      const result = parallelizeIndependentNodes(graph, ['http1', 'http2']);

      // Should add connection from trigger to http2 for true parallel execution
      expect(result.ops.some(op => 
        op.op === 'connect' && 
        op.source.node === 'trigger' && 
        op.target.node === 'http2'
      )).toBe(true);
    });
  });
});