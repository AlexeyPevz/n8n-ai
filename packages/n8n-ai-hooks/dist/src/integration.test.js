import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createAIRoutes } from './ai-routes';
import { introspectAPI } from './introspect-api';
import { loadBuiltinNodes } from './load-builtin-nodes';
describe('n8n-ai-hooks Integration', () => {
    let app;
    let server;
    const port = 3456;
    const baseUrl = `http://localhost:${port}/api/v1/ai`;
    beforeAll(async () => {
        // Initialize the introspect API with builtin nodes
        const builtinNodes = loadBuiltinNodes();
        introspectAPI.registerNodeTypes(builtinNodes);
        // Create Express app
        app = express();
        app.use(express.json());
        app.use('/api/v1/ai', createAIRoutes());
        // Start server
        await new Promise((resolve) => {
            server = app.listen(port, () => resolve());
        });
    });
    afterAll(async () => {
        // Close server
        await new Promise((resolve) => {
            server.close(() => resolve());
        });
    });
    describe('Health Check', () => {
        it('should return healthy status', async () => {
            const response = await fetch(`${baseUrl}/health`);
            expect(response.ok).toBe(true);
            const data = await response.json();
            expect(data.status).toBe('healthy');
            expect(data.timestamp).toBeDefined();
        });
    });
    describe('Introspect API', () => {
        it('should list all available nodes', async () => {
            const response = await fetch(`${baseUrl}/introspect/nodes`);
            expect(response.ok).toBe(true);
            const nodes = await response.json();
            expect(Array.isArray(nodes)).toBe(true);
            expect(nodes.length).toBeGreaterThan(0);
            // Check for common nodes
            const nodeTypes = nodes.map((n) => n.type);
            expect(nodeTypes).toContain('n8n-nodes-base.httpRequest');
            expect(nodeTypes).toContain('n8n-nodes-base.webhook');
        });
        it('should get specific node details', async () => {
            const response = await fetch(`${baseUrl}/introspect/node/n8n-nodes-base.httpRequest`);
            expect(response.ok).toBe(true);
            const node = await response.json();
            expect(node.name).toBe('HTTP Request');
            expect(node.type).toBe('n8n-nodes-base.httpRequest');
            expect(node.properties).toBeDefined();
            expect(Array.isArray(node.properties)).toBe(true);
        });
        it('should return 404 for unknown node', async () => {
            const response = await fetch(`${baseUrl}/introspect/node/unknown.node`);
            expect(response.status).toBe(404);
        });
    });
    describe('Graph Mutation API', () => {
        it('should apply operation batch', async () => {
            const batch = {
                version: 'v1',
                ops: [
                    {
                        op: 'add_node',
                        node: {
                            id: 'http-1',
                            name: 'HTTP Request',
                            type: 'n8n-nodes-base.httpRequest',
                            typeVersion: 4,
                            position: [600, 300],
                            parameters: {
                                method: 'GET',
                                url: 'https://api.example.com',
                            },
                        },
                    },
                ],
            };
            const response = await fetch(`${baseUrl}/graph/test-workflow/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(batch),
            });
            expect(response.ok).toBe(true);
            const result = await response.json();
            expect(result.ok).toBe(true);
            expect(result.undoId).toBeDefined();
        });
        it('should reject invalid operation batch', async () => {
            const invalidBatch = {
                // Missing 'ops' field
                version: 'v1',
            };
            const response = await fetch(`${baseUrl}/graph/test-workflow/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(invalidBatch),
            });
            expect(response.status).toBe(400);
            const error = await response.json();
            expect(error.error).toBeDefined();
        });
        it('should support undo operation', async () => {
            // First apply an operation
            const batch = {
                version: 'v1',
                ops: [{ op: 'annotate', name: 'test', text: 'annotation' }],
            };
            const applyResponse = await fetch(`${baseUrl}/graph/test-workflow-2/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(batch),
            });
            const { undoId } = await applyResponse.json();
            // Then undo it
            const undoResponse = await fetch(`${baseUrl}/graph/test-workflow-2/undo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ undoId }),
            });
            expect(undoResponse.ok).toBe(true);
            const undoResult = await undoResponse.json();
            expect(undoResult.ok).toBe(true);
        });
    });
    describe('Validation API', () => {
        it('should validate workflow', async () => {
            const response = await fetch(`${baseUrl}/graph/test-workflow/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            expect(response.ok).toBe(true);
            const result = await response.json();
            expect(result).toHaveProperty('lints');
            expect(Array.isArray(result.lints)).toBe(true);
        });
    });
    describe('Rate Limiting', () => {
        it('should include rate limit headers', async () => {
            const response = await fetch(`${baseUrl}/health`);
            expect(response.headers.get('X-RateLimit-Limit')).toBeDefined();
            expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined();
            expect(response.headers.get('X-RateLimit-Reset')).toBeDefined();
        });
    });
    describe('CORS', () => {
        it('should handle preflight requests', async () => {
            const response = await fetch(`${baseUrl}/health`, {
                method: 'OPTIONS',
                headers: {
                    'Origin': 'http://localhost:3001',
                    'Access-Control-Request-Method': 'GET',
                },
            });
            expect(response.ok).toBe(true);
        });
    });
});
