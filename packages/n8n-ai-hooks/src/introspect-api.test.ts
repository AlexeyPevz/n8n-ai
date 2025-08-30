import { describe, it, expect, beforeEach } from 'vitest';
import { IntrospectAPI } from '../introspect-api';

describe('IntrospectAPI', () => {
  let api: IntrospectAPI;

  beforeEach(() => {
    api = new IntrospectAPI();
  });

  describe('getNodeTypes', () => {
    it('should return array of node types', () => {
      const nodes = api.getNodeTypes();
      expect(Array.isArray(nodes)).toBe(true);
      expect(nodes.length).toBeGreaterThan(0);
    });

    it('should have required fields for each node', () => {
      const nodes = api.getNodeTypes();
      const firstNode = nodes[0];
      
      expect(firstNode).toHaveProperty('name');
      expect(firstNode).toHaveProperty('type');
      expect(firstNode).toHaveProperty('typeVersion');
      expect(firstNode).toHaveProperty('description');
      expect(firstNode).toHaveProperty('defaults');
      expect(firstNode).toHaveProperty('inputs');
      expect(firstNode).toHaveProperty('outputs');
      expect(firstNode).toHaveProperty('properties');
    });
  });

  describe('getNodeType', () => {
    it('should return specific node type', () => {
      const httpNode = api.getNodeType('n8n-nodes-base.httpRequest');
      expect(httpNode).toBeDefined();
      expect(httpNode?.name).toBe('HTTP Request');
    });

    it('should return undefined for unknown node', () => {
      const unknownNode = api.getNodeType('unknown.node');
      expect(unknownNode).toBeUndefined();
    });
  });

  describe('resolveLoadOptions', () => {
    it('should return empty array for nodes without loadOptions', () => {
      const result = api.resolveLoadOptions('n8n-nodes-base.set', 'someProperty');
      expect(result).toEqual([]);
    });

    it('should handle HTTP method options', () => {
      const methods = api.resolveLoadOptions('n8n-nodes-base.httpRequest', 'method');
      expect(methods).toContainEqual({ name: 'GET', value: 'GET' });
      expect(methods).toContainEqual({ name: 'POST', value: 'POST' });
    });
  });

  describe('caching', () => {
    it('should return cached results with ETag', () => {
      const result1 = api.resolveLoadOptionsCached('n8n-nodes-base.httpRequest', 'method');
      const result2 = api.resolveLoadOptionsCached('n8n-nodes-base.httpRequest', 'method');
      
      expect(result1.etag).toBe(result2.etag);
      expect(result1.options).toEqual(result2.options);
    });
  });
});