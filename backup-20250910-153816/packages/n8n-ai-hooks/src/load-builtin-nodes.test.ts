import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadBuiltinNodes } from './load-builtin-nodes';

// Mock the module resolution
vi.mock('node:module', () => ({
  createRequire: vi.fn(() => ({
    resolve: vi.fn((name: string) => {
      if (name === 'n8n-nodes-base') {
        return '/mocked/path/to/n8n-nodes-base';
      }
      throw new Error(`Cannot find module '${name}'`);
    }),
  })),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn((path: string) => {
    return path.includes('known-nodes.json');
  }),
  readFileSync: vi.fn((path: string) => {
    if (path.includes('known-nodes.json')) {
      return JSON.stringify({
        nodes: {
          'n8n-nodes-base.httpRequest': {
            className: 'HttpRequest',
            sourcePath: 'nodes/HttpRequest/HttpRequest.node.ts',
          },
          'n8n-nodes-base.webhook': {
            className: 'Webhook',
            sourcePath: 'nodes/Webhook/Webhook.node.ts',
          },
          'n8n-nodes-base.set': {
            className: 'Set',
            sourcePath: 'nodes/Set/Set.node.ts',
          },
        },
      });
    }
    throw new Error('File not found');
  }),
}));

describe('loadBuiltinNodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load known nodes from JSON file', () => {
    const nodes = loadBuiltinNodes();
    
    expect(nodes).toBeDefined();
    expect(Array.isArray(nodes)).toBe(true);
    expect(nodes.length).toBeGreaterThan(0);
  });

  it('should parse node types correctly', () => {
    const nodes = loadBuiltinNodes();
    
    const httpNode = nodes.find(n => n.name === 'n8n-nodes-base.httpRequest');
    expect(httpNode).toBeDefined();
    expect(httpNode?.description).toBeDefined();
  });

  it('should handle missing known-nodes.json gracefully', async () => {
    const fs = await import('node:fs');
    (fs as any).existsSync.mockReturnValue(false);
    
    const nodes = loadBuiltinNodes();
    expect(nodes).toEqual([]);
  });

  it('should handle JSON parse errors', async () => {
    const fs = await import('node:fs');
    (fs as any).readFileSync.mockReturnValue('invalid json');
    
    const nodes = loadBuiltinNodes();
    expect(nodes).toEqual([]);
  });

  it('should include all essential node types', () => {
    const nodes = loadBuiltinNodes();
    const nodeNames = nodes.map(n => n.name);
    
    const essentialNodes = [
      'n8n-nodes-base.httpRequest',
      'n8n-nodes-base.webhook',
      'n8n-nodes-base.set',
    ];
    
    essentialNodes.forEach(nodeType => {
      expect(nodeNames).toContain(nodeType);
    });
  });
});