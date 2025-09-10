/**
 * Edge Cases and Negative Tests for Graph Manager
 * Tests boundary conditions, error cases, and complex scenarios
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GraphManager } from './graph-manager.js';
import { OperationBatch, Node } from '@n8n-ai/schemas';

describe('Graph Manager - Edge Cases & Negative Tests', () => {
  let graphManager: GraphManager;

  beforeEach(() => {
    graphManager = new GraphManager();
  });

  describe('Workflow Creation - Edge Cases', () => {
    it('should handle empty workflow ID', () => {
      expect(() => graphManager.createWorkflow('', 'Test Workflow')).toThrow();
    });

    it('should handle null workflow ID', () => {
      expect(() => graphManager.createWorkflow(null as any, 'Test Workflow')).toThrow();
    });

    it('should handle undefined workflow ID', () => {
      expect(() => graphManager.createWorkflow(undefined as any, 'Test Workflow')).toThrow();
    });

    it('should handle very long workflow ID', () => {
      const longId = 'a'.repeat(1000);
      expect(() => graphManager.createWorkflow(longId, 'Test Workflow')).not.toThrow();
    });

    it('should handle special characters in workflow ID', () => {
      const specialId = 'workflow-123_test@domain.com';
      expect(() => graphManager.createWorkflow(specialId, 'Test Workflow')).not.toThrow();
    });

    it('should handle duplicate workflow creation', () => {
      graphManager.createWorkflow('test', 'Test Workflow');
      expect(() => graphManager.createWorkflow('test', 'Another Workflow')).toThrow();
    });

    it('should handle empty workflow name', () => {
      expect(() => graphManager.createWorkflow('test', '')).not.toThrow();
    });

    it('should handle null workflow name', () => {
      expect(() => graphManager.createWorkflow('test', null as any)).not.toThrow();
    });

    it('should handle very long workflow name', () => {
      const longName = 'A'.repeat(10000);
      expect(() => graphManager.createWorkflow('test', longName)).not.toThrow();
    });
  });

  describe('Node Operations - Edge Cases', () => {
    beforeEach(() => {
      graphManager.createWorkflow('test', 'Test Workflow');
    });

    it('should handle invalid node ID', () => {
      const batch: OperationBatch = {
        ops: [{
          op: 'add_node',
          node: {
            id: '',
            name: 'Test Node',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 1,
            position: [100, 100],
            parameters: {}
          }
        }],
        version: 'v1'
      };

      const result = graphManager.applyBatch('test', batch);
      expect(result.success).toBe(false);
    });

    it('should handle null node ID', () => {
      const batch: OperationBatch = {
        ops: [{
          op: 'add_node',
          node: {
            id: null as any,
            name: 'Test Node',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 1,
            position: [100, 100],
            parameters: {}
          }
        }],
        version: 'v1'
      };

      const result = graphManager.applyBatch('test', batch);
      expect(result.success).toBe(false);
    });

    it('should handle invalid node type', () => {
      const batch: OperationBatch = {
        ops: [{
          op: 'add_node',
          node: {
            id: 'node1',
            name: 'Test Node',
            type: '',
            typeVersion: 1,
            position: [100, 100],
            parameters: {}
          }
        }],
        version: 'v1'
      };

      const result = graphManager.applyBatch('test', batch);
      expect(result.success).toBe(false);
    });

    it('should handle invalid node type version', () => {
      const batch: OperationBatch = {
        ops: [{
          op: 'add_node',
          node: {
            id: 'node1',
            name: 'Test Node',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 0,
            position: [100, 100],
            parameters: {}
          }
        }],
        version: 'v1'
      };

      const result = graphManager.applyBatch('test', batch);
      expect(result.success).toBe(false);
    });

    it('should handle negative node type version', () => {
      const batch: OperationBatch = {
        ops: [{
          op: 'add_node',
          node: {
            id: 'node1',
            name: 'Test Node',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: -1,
            position: [100, 100],
            parameters: {}
          }
        }],
        version: 'v1'
      };

      const result = graphManager.applyBatch('test', batch);
      expect(result.success).toBe(false);
    });

    it('should handle invalid position coordinates', () => {
      const batch: OperationBatch = {
        ops: [{
          op: 'add_node',
          node: {
            id: 'node1',
            name: 'Test Node',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 1,
            position: [NaN, 100],
            parameters: {}
          }
        }],
        version: 'v1'
      };

      const result = graphManager.applyBatch('test', batch);
      expect(result.success).toBe(false);
    });

    it('should handle negative position coordinates', () => {
      const batch: OperationBatch = {
        ops: [{
          op: 'add_node',
          node: {
            id: 'node1',
            name: 'Test Node',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 1,
            position: [-100, -100],
            parameters: {}
          }
        }],
        version: 'v1'
      };

      const result = graphManager.applyBatch('test', batch);
      expect(result.success).toBe(false);
    });

    it('should handle very large position coordinates', () => {
      const batch: OperationBatch = {
        ops: [{
          op: 'add_node',
          node: {
            id: 'node1',
            name: 'Test Node',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 1,
            position: [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
            parameters: {}
          }
        }],
        version: 'v1'
      };

      const result = graphManager.applyBatch('test', batch);
      expect(result.success).toBe(false);
    });

    it('should handle duplicate node IDs', () => {
      const batch: OperationBatch = {
        ops: [
          {
            op: 'add_node',
            node: {
              id: 'node1',
              name: 'Test Node 1',
              type: 'n8n-nodes-base.httpRequest',
              typeVersion: 1,
              position: [100, 100],
              parameters: {}
            }
          },
          {
            op: 'add_node',
            node: {
              id: 'node1',
              name: 'Test Node 2',
              type: 'n8n-nodes-base.httpRequest',
              typeVersion: 1,
              position: [200, 200],
              parameters: {}
            }
          }
        ],
        version: 'v1'
      };

      const result = graphManager.applyBatch('test', batch);
      expect(result.success).toBe(false);
    });

    it('should handle very large parameters object', () => {
      const largeParams: Record<string, any> = {};
      for (let i = 0; i < 1000; i++) {
        largeParams[`param${i}`] = `value${i}`.repeat(100);
      }

      const batch: OperationBatch = {
        ops: [{
          op: 'add_node',
          node: {
            id: 'node1',
            name: 'Test Node',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 1,
            position: [100, 100],
            parameters: largeParams
          }
        }],
        version: 'v1'
      };

      const result = graphManager.applyBatch('test', batch);
      expect(result.success).toBe(true);
    });

    it('should handle circular references in parameters', () => {
      const circularParams: Record<string, any> = { test: 'value' };
      circularParams.self = circularParams;

      const batch: OperationBatch = {
        ops: [{
          op: 'add_node',
          node: {
            id: 'node1',
            name: 'Test Node',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 1,
            position: [100, 100],
            parameters: circularParams
          }
        }],
        version: 'v1'
      };

      const result = graphManager.applyBatch('test', batch);
      expect(result.success).toBe(false);
    });
  });

  describe('Connection Operations - Edge Cases', () => {
    beforeEach(() => {
      graphManager.createWorkflow('test', 'Test Workflow');
      // Add two nodes first
      const addNodesBatch: OperationBatch = {
        ops: [
          {
            op: 'add_node',
            node: {
              id: 'node1',
              name: 'Node 1',
              type: 'n8n-nodes-base.httpRequest',
              typeVersion: 1,
              position: [100, 100],
              parameters: {}
            }
          },
          {
            op: 'add_node',
            node: {
              id: 'node2',
              name: 'Node 2',
              type: 'n8n-nodes-base.httpRequest',
              typeVersion: 1,
              position: [200, 200],
              parameters: {}
            }
          }
        ],
        version: 'v1'
      };
      graphManager.applyBatch('test', addNodesBatch);
    });

    it('should handle connection to non-existent node', () => {
      const batch: OperationBatch = {
        ops: [{
          op: 'connect',
          from: 'node1',
          to: 'nonexistent'
        }],
        version: 'v1'
      };

      const result = graphManager.applyBatch('test', batch);
      expect(result.success).toBe(false);
    });

    it('should handle connection from non-existent node', () => {
      const batch: OperationBatch = {
        ops: [{
          op: 'connect',
          from: 'nonexistent',
          to: 'node2'
        }],
        version: 'v1'
      };

      const result = graphManager.applyBatch('test', batch);
      expect(result.success).toBe(false);
    });

    it('should handle self-connection', () => {
      const batch: OperationBatch = {
        ops: [{
          op: 'connect',
          from: 'node1',
          to: 'node1'
        }],
        version: 'v1'
      };

      const result = graphManager.applyBatch('test', batch);
      expect(result.success).toBe(false);
    });

    it('should handle duplicate connections', () => {
      const batch: OperationBatch = {
        ops: [
          {
            op: 'connect',
            from: 'node1',
            to: 'node2'
          },
          {
            op: 'connect',
            from: 'node1',
            to: 'node2'
          }
        ],
        version: 'v1'
      };

      const result = graphManager.applyBatch('test', batch);
      expect(result.success).toBe(false);
    });

    it('should handle invalid connection index', () => {
      const batch: OperationBatch = {
        ops: [{
          op: 'connect',
          from: 'node1',
          to: 'node2',
          index: -1
        }],
        version: 'v1'
      };

      const result = graphManager.applyBatch('test', batch);
      expect(result.success).toBe(false);
    });

    it('should handle very large connection index', () => {
      const batch: OperationBatch = {
        ops: [{
          op: 'connect',
          from: 'node1',
          to: 'node2',
          index: Number.MAX_SAFE_INTEGER
        }],
        version: 'v1'
      };

      const result = graphManager.applyBatch('test', batch);
      expect(result.success).toBe(false);
    });
  });

  describe('Delete Operations - Edge Cases', () => {
    beforeEach(() => {
      graphManager.createWorkflow('test', 'Test Workflow');
      const addNodeBatch: OperationBatch = {
        ops: [{
          op: 'add_node',
          node: {
            id: 'node1',
            name: 'Node 1',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 1,
            position: [100, 100],
            parameters: {}
          }
        }],
        version: 'v1'
      };
      graphManager.applyBatch('test', addNodeBatch);
    });

    it('should handle deletion of non-existent node', () => {
      const batch: OperationBatch = {
        ops: [{
          op: 'delete',
          name: 'nonexistent'
        }],
        version: 'v1'
      };

      const result = graphManager.applyBatch('test', batch);
      expect(result.success).toBe(false);
    });

    it('should handle deletion of empty node name', () => {
      const batch: OperationBatch = {
        ops: [{
          op: 'delete',
          name: ''
        }],
        version: 'v1'
      };

      const result = graphManager.applyBatch('test', batch);
      expect(result.success).toBe(false);
    });

    it('should handle deletion of null node name', () => {
      const batch: OperationBatch = {
        ops: [{
          op: 'delete',
          name: null as any
        }],
        version: 'v1'
      };

      const result = graphManager.applyBatch('test', batch);
      expect(result.success).toBe(false);
    });
  });

  describe('Undo/Redo Operations - Edge Cases', () => {
    beforeEach(() => {
      graphManager.createWorkflow('test', 'Test Workflow');
    });

    it('should handle undo on empty workflow', () => {
      const result = graphManager.undo('test', 'nonexistent');
      expect(result.success).toBe(false);
    });

    it('should handle undo with invalid undo ID', () => {
      const result = graphManager.undo('test', 'invalid-id');
      expect(result.success).toBe(false);
    });

    it('should handle undo with null undo ID', () => {
      const result = graphManager.undo('test', null as any);
      expect(result.success).toBe(false);
    });

    it('should handle redo on empty workflow', () => {
      const result = graphManager.redo('test');
      expect(result.success).toBe(false);
    });

    it('should handle redo when no operations to redo', () => {
      // Add a node
      const addBatch: OperationBatch = {
        ops: [{
          op: 'add_node',
          node: {
            id: 'node1',
            name: 'Node 1',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 1,
            position: [100, 100],
            parameters: {}
          }
        }],
        version: 'v1'
      };
      graphManager.applyBatch('test', addBatch);

      // Undo it
      const undoResult = graphManager.undo('test', 'latest');
      expect(undoResult.success).toBe(true);

      // Redo it
      const redoResult = graphManager.redo('test');
      expect(redoResult.success).toBe(true);

      // Try to redo again (should fail)
      const redoResult2 = graphManager.redo('test');
      expect(redoResult2.success).toBe(false);
    });
  });

  describe('Validation - Edge Cases', () => {
    beforeEach(() => {
      graphManager.createWorkflow('test', 'Test Workflow');
    });

    it('should handle validation of non-existent workflow', () => {
      const result = graphManager.validate('nonexistent');
      expect(result.valid).toBe(false);
    });

    it('should handle validation of empty workflow', () => {
      const result = graphManager.validate('test');
      expect(result.valid).toBe(true);
    });

    it('should handle validation with autofix', () => {
      const result = graphManager.validate('test', { autofix: true });
      expect(result.valid).toBe(true);
    });
  });

  describe('Simulation - Edge Cases', () => {
    beforeEach(() => {
      graphManager.createWorkflow('test', 'Test Workflow');
    });

    it('should handle simulation of non-existent workflow', () => {
      const result = graphManager.simulate('nonexistent');
      expect(result.success).toBe(false);
    });

    it('should handle simulation of empty workflow', () => {
      const result = graphManager.simulate('test');
      expect(result.success).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    it('should handle large number of operations efficiently', () => {
      graphManager.createWorkflow('perf-test', 'Performance Test Workflow');
      
      const start = Date.now();
      
      // Add 1000 nodes
      const ops = Array.from({ length: 1000 }, (_, i) => ({
        op: 'add_node' as const,
        node: {
          id: `node${i}`,
          name: `Node ${i}`,
          type: 'n8n-nodes-base.httpRequest',
          typeVersion: 1,
          position: [i * 10, i * 10],
          parameters: {}
        }
      }));

      const batch: OperationBatch = { ops, version: 'v1' };
      const result = graphManager.applyBatch('perf-test', batch);
      
      const end = Date.now();
      
      expect(result.success).toBe(true);
      expect(end - start).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle deep undo stack efficiently', () => {
      graphManager.createWorkflow('undo-test', 'Undo Test Workflow');
      
      const start = Date.now();
      
      // Perform 100 operations
      for (let i = 0; i < 100; i++) {
        const batch: OperationBatch = {
          ops: [{
            op: 'add_node',
            node: {
              id: `node${i}`,
              name: `Node ${i}`,
              type: 'n8n-nodes-base.httpRequest',
              typeVersion: 1,
              position: [i * 10, i * 10],
              parameters: {}
            }
          }],
          version: 'v1'
        };
        graphManager.applyBatch('undo-test', batch);
      }
      
      // Undo all operations
      for (let i = 0; i < 100; i++) {
        graphManager.undo('undo-test', 'latest');
      }
      
      const end = Date.now();
      
      expect(end - start).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory with many operations', () => {
      graphManager.createWorkflow('memory-test', 'Memory Test Workflow');
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        const batch: OperationBatch = {
          ops: [{
            op: 'add_node',
            node: {
              id: `node${i}`,
              name: `Node ${i}`,
              type: 'n8n-nodes-base.httpRequest',
              typeVersion: 1,
              position: [i * 10, i * 10],
              parameters: {}
            }
          }],
          version: 'v1'
        };
        graphManager.applyBatch('memory-test', batch);
        
        // Undo every 10th operation
        if (i % 10 === 0) {
          graphManager.undo('memory-test', 'latest');
        }
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });
});