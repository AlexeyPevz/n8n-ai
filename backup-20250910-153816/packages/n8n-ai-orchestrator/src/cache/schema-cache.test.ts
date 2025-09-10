import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SchemaCache } from './schema-cache.js';

describe('SchemaCache', () => {
  let cache: SchemaCache;

  beforeEach(() => {
    cache = new SchemaCache(3, 1000); // max 3 items, 1 second TTL
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic operations', () => {
    it('should store and retrieve node descriptions', () => {
      const nodeDesc = {
        name: 'HTTP Request',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 1,
        description: 'Makes HTTP requests',
        properties: [],
      };

      cache.set('httpRequest', nodeDesc);
      const retrieved = cache.get('httpRequest');

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('HTTP Request');
    });

    it('should track hit/miss statistics', () => {
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);

      cache.get('nonexistent');
      expect(cache.getStats().misses).toBe(1);

      cache.set('test', { name: 'Test', type: 'test', typeVersion: 1, properties: [] });
      cache.get('test');
      expect(cache.getStats().hits).toBe(1);
    });

    it('should invalidate based on hash changes', () => {
      const node1 = { name: 'Test', type: 'test', typeVersion: 1, properties: [] };
      const node2 = { name: 'Test', type: 'test', typeVersion: 2, properties: [] };

      cache.set('test', node1);
      expect(cache.has('test')).toBe(true);

      // Invalidate with different hash
      cache.invalidate('test', 'different-hash');
      expect(cache.has('test')).toBe(false);
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used items when full', () => {
      // Fill cache
      cache.set('node1', { name: 'Node1', type: 'type1', typeVersion: 1, properties: [] });
      cache.set('node2', { name: 'Node2', type: 'type2', typeVersion: 1, properties: [] });
      cache.set('node3', { name: 'Node3', type: 'type3', typeVersion: 1, properties: [] });

      // Access node1 to make it recently used
      cache.get('node1');

      // Add new node - should evict node2 (least recently used)
      cache.set('node4', { name: 'Node4', type: 'type4', typeVersion: 1, properties: [] });

      expect(cache.has('node1')).toBe(true);
      expect(cache.has('node2')).toBe(false); // evicted
      expect(cache.has('node3')).toBe(true);
      expect(cache.has('node4')).toBe(true);
      expect(cache.getStats().evictions).toBe(1);
    });
  });

  describe('TTL expiration', () => {
    it('should expire items after TTL', () => {
      cache.set('expiring', { name: 'Expiring', type: 'type', typeVersion: 1, properties: [] });
      
      expect(cache.has('expiring')).toBe(true);
      
      // Advance time past TTL
      vi.advanceTimersByTime(1100);
      
      expect(cache.has('expiring')).toBe(false);
      expect(cache.get('expiring')).toBeUndefined();
    });

    it('should not expire items before TTL', () => {
      cache.set('notExpiring', { name: 'NotExpiring', type: 'type', typeVersion: 1, properties: [] });
      
      // Advance time but not past TTL
      vi.advanceTimersByTime(900);
      
      expect(cache.has('notExpiring')).toBe(true);
      expect(cache.get('notExpiring')).toBeDefined();
    });
  });

  describe('pre-warming', () => {
    it('should pre-warm cache with specified nodes', async () => {
      const mockIntrospect = vi.fn().mockImplementation((nodeType: string) => 
        Promise.resolve({
          name: nodeType,
          type: `n8n-nodes-base.${nodeType}`,
          typeVersion: 1,
          properties: [],
        })
      );

      await cache.warmCache(mockIntrospect, ['httpRequest', 'webhook']);

      expect(mockIntrospect).toHaveBeenCalledTimes(2);
      expect(cache.has('n8n-nodes-base.httpRequest')).toBe(true);
      expect(cache.has('n8n-nodes-base.webhook')).toBe(true);
    });

    it('should handle errors during pre-warming', async () => {
      const mockIntrospect = vi.fn().mockRejectedValue(new Error('Failed to introspect'));
      
      // Should not throw
      await cache.warmCache(mockIntrospect, ['httpRequest']);
      
      expect(cache.has('n8n-nodes-base.httpRequest')).toBe(false);
    });
  });

  describe('cache clearing', () => {
    it('should clear all entries and reset stats', () => {
      cache.set('node1', { name: 'Node1', type: 'type1', typeVersion: 1, properties: [] });
      cache.set('node2', { name: 'Node2', type: 'type2', typeVersion: 1, properties: [] });
      cache.get('node1'); // Create a hit

      expect(cache.getStats().size).toBe(2);
      expect(cache.getStats().hits).toBe(1);

      cache.clear();

      expect(cache.getStats().size).toBe(0);
      expect(cache.getStats().hits).toBe(0);
      expect(cache.getStats().misses).toBe(0);
      expect(cache.has('node1')).toBe(false);
      expect(cache.has('node2')).toBe(false);
    });
  });

  describe('hit rate calculation', () => {
    it('should calculate hit rate correctly', () => {
      expect(cache.getHitRate()).toBe(0); // No requests yet

      cache.get('miss1');
      cache.get('miss2');
      expect(cache.getHitRate()).toBe(0); // 0 hits, 2 misses

      cache.set('hit1', { name: 'Hit1', type: 'type', typeVersion: 1, properties: [] });
      cache.get('hit1');
      cache.get('hit1');
      
      // 2 hits, 2 misses = 50% hit rate
      expect(cache.getHitRate()).toBe(0.5);
    });
  });
});