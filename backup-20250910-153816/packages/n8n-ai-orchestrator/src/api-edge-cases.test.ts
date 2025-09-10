/**
 * Edge Cases and Negative Tests for API Endpoints
 * Tests boundary conditions, error cases, and malformed requests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from './test-server.js';

describe('API Endpoints - Edge Cases & Negative Tests', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    server = await buildServer();
  });

  describe('Health Endpoint - Edge Cases', () => {
    it('should handle health check with malformed headers', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/ai/health',
        headers: {
          'Content-Type': 'application/json',
          'X-Malformed-Header': 'value\x00with\x01null\x02bytes',
          'X-Very-Long-Header': 'A'.repeat(10000),
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveProperty('status', 'ok');
    });

    it('should handle health check with invalid HTTP method', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/ai/health',
        payload: { test: 'data' }
      });

      expect(response.statusCode).toBe(404);
    });

    it('should handle health check with query parameters', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/ai/health?debug=true&verbose=1&test=malicious<script>alert("xss")</script>'
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveProperty('status', 'ok');
    });
  });

  describe('Plan Endpoint - Edge Cases', () => {
    it('should handle empty request body', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/plan',
        payload: {}
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle null request body', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/plan',
        payload: null
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle malformed JSON', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/plan',
        payload: '{"prompt": "test", "invalid": json}',
        headers: { 'Content-Type': 'application/json' }
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle very large prompt', async () => {
      const largePrompt = 'A'.repeat(100000);
      const response = await server.inject({
        method: 'POST',
        url: '/plan',
        payload: { prompt: largePrompt }
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle prompt with special characters', async () => {
      const specialPrompt = 'Create workflow with 测试数据 and émojis 🚀 and "quotes" and \'apostrophes\'';
      const response = await server.inject({
        method: 'POST',
        url: '/plan',
        payload: { prompt: specialPrompt }
      });

      expect(response.statusCode).toBe(200);
    });

    it('should handle prompt with SQL injection attempts', async () => {
      const maliciousPrompt = 'Create workflow that does \'; DROP TABLE users; --';
      const response = await server.inject({
        method: 'POST',
        url: '/plan',
        payload: { prompt: maliciousPrompt }
      });

      expect(response.statusCode).toBe(200);
    });

    it('should handle prompt with XSS attempts', async () => {
      const maliciousPrompt = 'Create workflow with <script>alert("xss")</script>';
      const response = await server.inject({
        method: 'POST',
        url: '/plan',
        payload: { prompt: maliciousPrompt }
      });

      expect(response.statusCode).toBe(200);
    });

    it('should handle prompt with null bytes', async () => {
      const maliciousPrompt = 'Create workflow\x00with null bytes';
      const response = await server.inject({
        method: 'POST',
        url: '/plan',
        payload: { prompt: maliciousPrompt }
      });

      expect(response.statusCode).toBe(200);
    });

    it('should handle prompt with control characters', async () => {
      const maliciousPrompt = 'Create workflow\x01\x02\x03with control chars';
      const response = await server.inject({
        method: 'POST',
        url: '/plan',
        payload: { prompt: maliciousPrompt }
      });

      expect(response.statusCode).toBe(200);
    });

    it('should handle missing prompt field', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/plan',
        payload: { message: 'test' }
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle extra fields in request', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/plan',
        payload: { 
          prompt: 'Create workflow',
          extraField: 'should be ignored',
          anotherField: { nested: 'object' }
        }
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Graph Operations - Edge Cases', () => {
    const workflowId = 'test-workflow';

    it('should handle invalid workflow ID', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/graph//batch',
        payload: { ops: [], version: 'v1' }
      });

      expect(response.statusCode).toBe(404);
    });

    it('should handle workflow ID with special characters', async () => {
      const specialId = 'workflow-123_test@domain.com';
      const response = await server.inject({
        method: 'POST',
        url: `/graph/${encodeURIComponent(specialId)}/batch`,
        payload: { ops: [], version: 'v1' }
      });

      expect(response.statusCode).toBe(200);
    });

    it('should handle very long workflow ID', async () => {
      const longId = 'a'.repeat(1000);
      const response = await server.inject({
        method: 'POST',
        url: `/graph/${longId}/batch`,
        payload: { ops: [], version: 'v1' }
      });

      expect(response.statusCode).toBe(200);
    });

    it('should handle empty operation batch', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/graph/${workflowId}/batch`,
        payload: { ops: [], version: 'v1' }
      });

      expect(response.statusCode).toBe(200);
    });

    it('should handle invalid operation batch', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/graph/${workflowId}/batch`,
        payload: { ops: 'invalid', version: 'v1' }
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle missing version field', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/graph/${workflowId}/batch`,
        payload: { ops: [] }
      });

      expect(response.statusCode).toBe(200);
    });

    it('should handle invalid version', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/graph/${workflowId}/batch`,
        payload: { ops: [], version: 'invalid' }
      });

      expect(response.statusCode).toBe(200);
    });

    it('should handle very large operation batch', async () => {
      const largeOps = Array.from({ length: 1000 }, (_, i) => ({
        op: 'add_node',
        node: {
          id: `node${i}`,
          name: `Node ${i}`,
          type: 'n8n-nodes-base.httpRequest',
          typeVersion: 1,
          position: [i * 10, i * 10],
          parameters: {}
        }
      }));

      const response = await server.inject({
        method: 'POST',
        url: `/graph/${workflowId}/batch`,
        payload: { ops: largeOps, version: 'v1' }
      });

      expect(response.statusCode).toBe(200);
    });

    it('should handle malformed node operations', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/graph/${workflowId}/batch`,
        payload: {
          ops: [
            { op: 'add_node' }, // Missing node
            { op: 'invalid_op' }, // Invalid operation
            { op: 'add_node', node: {} }, // Empty node
            { op: 'add_node', node: { id: 'test' } }, // Incomplete node
          ],
          version: 'v1'
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Validation Endpoint - Edge Cases', () => {
    const workflowId = 'test-workflow';

    it('should handle validation with autofix parameter', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/graph/${workflowId}/validate?autofix=1`,
        payload: {}
      });

      expect(response.statusCode).toBe(200);
    });

    it('should handle validation with invalid autofix parameter', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/graph/${workflowId}/validate?autofix=invalid`,
        payload: {}
      });

      expect(response.statusCode).toBe(200);
    });

    it('should handle validation with extra query parameters', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/graph/${workflowId}/validate?autofix=1&debug=true&verbose=1&test=malicious`,
        payload: {}
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Simulation Endpoint - Edge Cases', () => {
    const workflowId = 'test-workflow';

    it('should handle simulation with extra payload', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/graph/${workflowId}/simulate`,
        payload: { extra: 'data', should: 'be ignored' }
      });

      expect(response.statusCode).toBe(200);
    });

    it('should handle simulation with malformed payload', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/graph/${workflowId}/simulate`,
        payload: 'invalid json'
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Undo/Redo Endpoints - Edge Cases', () => {
    const workflowId = 'test-workflow';

    it('should handle undo with invalid undo ID', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/graph/${workflowId}/undo`,
        payload: { undoId: 'invalid-id' }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveProperty('ok', false);
    });

    it('should handle undo with null undo ID', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/graph/${workflowId}/undo`,
        payload: { undoId: null }
      });

      expect(response.statusCode).toBe(200);
    });

    it('should handle undo with very long undo ID', async () => {
      const longId = 'a'.repeat(1000);
      const response = await server.inject({
        method: 'POST',
        url: `/graph/${workflowId}/undo`,
        payload: { undoId: longId }
      });

      expect(response.statusCode).toBe(200);
    });

    it('should handle redo when no operations to redo', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/graph/${workflowId}/redo`,
        payload: {}
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveProperty('ok', false);
    });
  });

  describe('Metrics Endpoint - Edge Cases', () => {
    it('should handle metrics with query parameters', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/ai/metrics?format=json&include=all&test=malicious'
      });

      expect(response.statusCode).toBe(200);
    });

    it('should handle metrics with malformed headers', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/ai/metrics',
        headers: {
          'Accept': 'application/json\x00malicious',
          'X-Test': 'value\x01with\x02control\x03chars'
        }
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Rate Limiting - Edge Cases', () => {
    it('should handle rapid requests', async () => {
      const promises = Array.from({ length: 100 }, () =>
        server.inject({
          method: 'GET',
          url: '/api/v1/ai/health'
        })
      );

      const responses = await Promise.all(promises);
      const successCount = responses.filter(r => r.statusCode === 200).length;
      const rateLimitedCount = responses.filter(r => r.statusCode === 429).length;

      expect(successCount).toBeGreaterThan(0);
      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    it('should handle requests with different IPs', async () => {
      const promises = Array.from({ length: 50 }, (_, i) =>
        server.inject({
          method: 'GET',
          url: '/api/v1/ai/health',
          headers: {
            'X-Forwarded-For': `192.168.1.${i % 255}`
          }
        })
      );

      const responses = await Promise.all(promises);
      const successCount = responses.filter(r => r.statusCode === 200).length;

      expect(successCount).toBe(50);
    });
  });

  describe('Error Handling - Edge Cases', () => {
    it('should handle requests with malformed URLs', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/ai/health%00malicious'
      });

      expect(response.statusCode).toBe(404);
    });

    it('should handle requests with very long URLs', async () => {
      const longPath = '/api/v1/ai/health' + '?param=' + 'A'.repeat(10000);
      const response = await server.inject({
        method: 'GET',
        url: longPath
      });

      expect(response.statusCode).toBe(200);
    });

    it('should handle requests with invalid HTTP methods', async () => {
      const response = await server.inject({
        method: 'INVALID',
        url: '/api/v1/ai/health'
      });

      expect(response.statusCode).toBe(404);
    });

    it('should handle requests with malformed headers', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/ai/health',
        headers: {
          'Content-Length': 'invalid',
          'Content-Type': 'application/json\x00malicious',
          'Authorization': 'Bearer \x01\x02\x03token'
        }
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent requests efficiently', async () => {
      const start = Date.now();
      
      const promises = Array.from({ length: 100 }, () =>
        server.inject({
          method: 'GET',
          url: '/api/v1/ai/health'
        })
      );

      const responses = await Promise.all(promises);
      const end = Date.now();

      const successCount = responses.filter(r => r.statusCode === 200).length;
      expect(successCount).toBeGreaterThan(90); // At least 90% should succeed
      expect(end - start).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle large payloads efficiently', async () => {
      const largePayload = {
        prompt: 'A'.repeat(10000),
        extra: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          data: 'B'.repeat(100)
        }))
      };

      const start = Date.now();
      const response = await server.inject({
        method: 'POST',
        url: '/plan',
        payload: largePayload
      });
      const end = Date.now();

      expect(response.statusCode).toBe(400); // Should reject large payloads
      expect(end - start).toBeLessThan(1000); // Should reject quickly
    });
  });
});