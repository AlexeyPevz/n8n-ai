import { describe, it, expect } from 'vitest';
import {
  NodeSchema,
  GraphSchema,
  OperationBatchSchema,
  OperationAddNode,
  OperationConnect,
  OperationAnnotate,
  LintSchema
} from './index';

describe('NodeSchema', () => {
  it('should validate correct node', () => {
    const validNode = {
      id: 'http-1',
      name: 'HTTP Request',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4,
      position: [100, 200],
      parameters: {
        method: 'GET',
        url: 'https://example.com'
      }
    };
    expect(NodeSchema.parse(validNode)).toEqual(validNode);
  });

  it('should reject node without required fields', () => {
    const invalidNode = {
      name: 'HTTP Request',
      type: 'n8n-nodes-base.httpRequest'
    };
    expect(() => NodeSchema.parse(invalidNode)).toThrow();
  });

  it('should reject node with invalid position', () => {
    const invalidNode = {
      id: 'http-1',
      name: 'HTTP Request',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4,
      position: [100], // должно быть 2 элемента
      parameters: {}
    };
    expect(() => NodeSchema.parse(invalidNode)).toThrow();
  });
});

describe('OperationBatchSchema', () => {
  it('should validate correct batch with multiple operations', () => {
    const validBatch = {
      version: 'v1',
      ops: [
        {
          op: 'add_node',
          node: {
            id: 'http-1',
            name: 'Fetch Data',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 4,
            position: [600, 300],
            parameters: { method: 'GET', url: 'https://api.example.com' }
          }
        },
        {
          op: 'connect',
          from: 'Manual Trigger',
          to: 'Fetch Data',
          index: 0
        },
        {
          op: 'annotate',
          name: 'Fetch Data',
          text: 'Получение данных из API'
        }
      ]
    };
    expect(OperationBatchSchema.parse(validBatch)).toEqual(validBatch);
  });

  it('should reject batch with invalid operation type', () => {
    const invalidBatch = {
      ops: [
        {
          op: 'invalid_op',
          data: 'something'
        }
      ]
    };
    expect(() => OperationBatchSchema.parse(invalidBatch)).toThrow();
  });

  it('should use default version if not provided', () => {
    const batchWithoutVersion = {
      ops: []
    };
    const parsed = OperationBatchSchema.parse(batchWithoutVersion);
    expect(parsed.version).toBe('v1');
  });
});

describe('GraphSchema', () => {
  it('should validate correct graph', () => {
    const validGraph = {
      nodes: [
        {
          id: 'trigger-1',
          name: 'Manual Trigger',
          type: 'n8n-nodes-base.manualTrigger',
          typeVersion: 1,
          position: [100, 200],
          parameters: {}
        },
        {
          id: 'http-1',
          name: 'HTTP Request',
          type: 'n8n-nodes-base.httpRequest',
          typeVersion: 4,
          position: [300, 200],
          parameters: { method: 'GET' }
        }
      ],
      connections: [
        {
          from: 'trigger-1',
          to: 'http-1'
        }
      ]
    };
    expect(GraphSchema.parse(validGraph)).toEqual(validGraph);
  });
});

describe('LintSchema', () => {
  it('should validate all lint levels', () => {
    const lints = [
      { code: 'missing_trigger', level: 'info', message: 'No trigger found' },
      { code: 'unused_node', level: 'warn', message: 'Node not connected', node: 'http-1' },
      { code: 'invalid_params', level: 'error', message: 'Required parameter missing' }
    ];
    
    lints.forEach(lint => {
      expect(LintSchema.parse(lint)).toEqual(lint);
    });
  });

  it('should reject invalid lint level', () => {
    const invalidLint = {
      code: 'test',
      level: 'critical', // не существует
      message: 'Test'
    };
    expect(() => LintSchema.parse(invalidLint)).toThrow();
  });
});

describe('Real-world scenarios', () => {
  it('should validate operation batch from example file', () => {
    const exampleBatch = {
      version: "v1",
      ops: [
        {
          op: "add_node",
          node: {
            id: "http-1",
            name: "Fetch",
            type: "n8n-nodes-base.httpRequest",
            typeVersion: 4,
            position: [600, 300],
            parameters: {
              method: "GET",
              url: "https://jsonplaceholder.typicode.com/todos/1"
            }
          }
        },
        { op: "connect", from: "Manual Trigger", to: "Fetch", index: 0 },
        { op: "annotate", name: "Fetch", text: "GET because endpoint is read-only" }
      ]
    };
    
    const parsed = OperationBatchSchema.parse(exampleBatch);
    expect(parsed.ops).toHaveLength(3);
    expect(parsed.ops[0].op).toBe('add_node');
    expect(parsed.ops[1].op).toBe('connect');
    expect(parsed.ops[2].op).toBe('annotate');
  });
});