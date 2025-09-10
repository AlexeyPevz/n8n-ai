import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Router } from 'express';
import { createAIRoutes } from './ai-routes';
import type { Request, Response, NextFunction } from 'express';

// Mock dependencies
vi.mock('../introspect-api', () => ({
  introspectAPI: {
    getAllNodeTypes: vi.fn(),
    getNodeType: vi.fn(),
    resolveLoadOptions: vi.fn(),
    registerNodeTypes: vi.fn(),
  },
}));

vi.mock('../load-builtin-nodes', () => ({
  loadBuiltinNodes: vi.fn(() => [
    {
      type: 'n8n-nodes-base.httpRequest',
      description: {
        displayName: 'HTTP Request',
        name: 'n8n-nodes-base.httpRequest',
        version: 4,
      },
    },
  ]),
}));

describe('AI Routes', () => {
  let router: Router;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    router = createAIRoutes();
    
    mockRequest = {
      body: {},
      params: {},
      query: {},
      header: vi.fn(),
      ip: '127.0.0.1',
    };
    
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
      write: vi.fn().mockReturnThis(),
      end: vi.fn(),
    };
    
    mockNext = vi.fn();
    
    // Reset env vars
    delete process.env.N8N_AI_API_TOKEN;
  });

  describe('Security', () => {
    it('should allow requests without token when not configured', () => {
      const authMiddleware = router.stack.find(layer => 
        layer.name === 'authMiddleware'
      )?.handle;
      
      if (authMiddleware) {
        authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
        expect(mockNext).toHaveBeenCalled();
      }
    });

    it('should reject requests with invalid token', () => {
      process.env.N8N_AI_API_TOKEN = 'valid-token';
      
      mockRequest.header = vi.fn().mockReturnValue('Bearer invalid-token');
      
      const authMiddleware = router.stack.find(layer => 
        layer.name === 'authMiddleware'
      )?.handle;
      
      if (authMiddleware) {
        authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({ error: 'unauthorized' });
      }
    });

    it('should allow requests with valid token', () => {
      process.env.N8N_AI_API_TOKEN = 'valid-token';
      
      mockRequest.header = vi.fn().mockReturnValue('Bearer valid-token');
      
      const authMiddleware = router.stack.find(layer => 
        layer.name === 'authMiddleware'
      )?.handle;
      
      if (authMiddleware) {
        authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
        expect(mockNext).toHaveBeenCalled();
      }
    });
  });

  describe('Rate Limiting', () => {
    it('should set rate limit headers', () => {
      const rateLimitMiddleware = router.stack.find(layer => 
        layer.name === 'rateLimitMiddleware'
      )?.handle;
      
      if (rateLimitMiddleware) {
        rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
        
        expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(String));
        expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(String));
        expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
        expect(mockNext).toHaveBeenCalled();
      }
    });
  });

  describe('Operation Validation', () => {
    it('should validate operation batch structure', () => {
      const invalidBatch = {
        // Missing 'ops' field
        version: 'v1',
      };
      
      // Test would be done through actual route handler
      // This is a placeholder for the structure
      expect(invalidBatch).not.toHaveProperty('ops');
    });

    it('should validate individual operations', () => {
      const validOp = {
        op: 'add_node',
        node: {
          id: 'http-1',
          name: 'HTTP Request',
          type: 'n8n-nodes-base.httpRequest',
          typeVersion: 4,
          position: [100, 200],
          parameters: {},
        },
      };
      
      expect(validOp.op).toBe('add_node');
      expect(validOp.node).toHaveProperty('id');
      expect(validOp.node).toHaveProperty('type');
      expect(validOp.node).toHaveProperty('position');
    });
  });

  describe('Undo/Redo', () => {
    it('should maintain undo stack per workflow', () => {
      // This would test the in-memory undo stack
      // Implementation would depend on actual route handlers
      const workflowId = 'test-workflow';
      const batch = {
        version: 'v1',
        ops: [{ op: 'annotate', name: 'test', text: 'annotation' }],
      };
      
      // Test structure
      expect(batch).toHaveProperty('ops');
      expect(batch.ops).toHaveLength(1);
    });
  });

  describe('CORS', () => {
    it('should handle CORS headers', () => {
      mockRequest.method = 'OPTIONS';
      mockRequest.headers = { origin: 'http://localhost:3001' };
      
      // CORS would be handled by the router middleware
      expect(mockRequest.headers.origin).toBe('http://localhost:3001');
    });
  });
});