import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { registerGitRoutes } from './git-routes.js';
import { GitIntegration } from '../git/git-integration.js';

vi.mock('../git/git-integration.js');

describe('Git Routes', () => {
  let app: any;
  let mockGitIntegration: any;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    
    mockGitIntegration = {
      commitWorkflow: vi.fn(),
      createPullRequest: vi.fn(),
      generateDiff: vi.fn(),
      ensureRepository: vi.fn(),
    };

    vi.mocked(GitIntegration).mockImplementation(() => mockGitIntegration);

    await registerGitRoutes(app);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/git/commit', () => {
    it('should commit workflow changes', async () => {
      mockGitIntegration.commitWorkflow.mockResolvedValue({
        success: true,
        commitHash: 'abc123',
        branch: 'main',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/git/commit',
        payload: {
          workflow: {
            id: 'test-workflow',
            name: 'Test Workflow',
            nodes: [],
            connections: {},
          },
          message: 'Update workflow',
          metadata: {
            prompt: 'Add HTTP request',
            model: 'gpt-4',
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result).toMatchObject({
        success: true,
        commitHash: 'abc123',
        branch: 'main',
      });
      expect(mockGitIntegration.commitWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'test-workflow' }),
        'Update workflow',
        expect.objectContaining({ prompt: 'Add HTTP request' })
      );
    });

    it('should handle commit failures', async () => {
      mockGitIntegration.commitWorkflow.mockRejectedValue(
        new Error('Git commit failed')
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/git/commit',
        payload: {
          workflow: { id: 'test', name: 'Test', nodes: [], connections: {} },
          message: 'Test commit',
        },
      });

      expect(response.statusCode).toBe(500);
      const result = JSON.parse(response.body);
      expect(result.error).toContain('Git commit failed');
    });

    it('should validate required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/git/commit',
        payload: {
          workflow: { id: 'test' }, // Missing required fields
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/git/pull-request', () => {
    it('should create pull request', async () => {
      mockGitIntegration.createPullRequest.mockResolvedValue({
        success: true,
        prUrl: 'https://github.com/test/repo/pull/123',
        prNumber: 123,
      });

      mockGitIntegration.generateDiff.mockResolvedValue(
        'Added Nodes:\n- HTTP Request\n\nNew Connections:\n- Webhook → HTTP Request'
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/git/pull-request',
        payload: {
          title: 'AI: Update workflow',
          body: 'Updated based on prompt',
          branch: 'ai/update-workflow',
          workflowBefore: { nodes: [], connections: {} },
          workflowAfter: { 
            nodes: [{ id: '1', type: 'httpRequest' }], 
            connections: {} 
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result).toMatchObject({
        success: true,
        prUrl: 'https://github.com/test/repo/pull/123',
      });
    });

    it('should handle PR creation without GitHub integration', async () => {
      mockGitIntegration.createPullRequest.mockResolvedValue({
        success: false,
        message: 'Manual PR creation required',
        branch: 'ai/update-workflow',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/git/pull-request',
        payload: {
          title: 'Test PR',
          body: 'Test body',
          branch: 'test-branch',
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Manual PR creation required');
    });
  });

  describe('GET /api/v1/git/status', () => {
    it('should return git integration status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/git/status',
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result).toMatchObject({
        enabled: true,
        hasGitHub: expect.any(Boolean),
        branch: expect.any(String),
      });
    });
  });

  describe('POST /api/v1/git/diff', () => {
    it('should generate workflow diff', async () => {
      mockGitIntegration.generateDiff.mockResolvedValue(
        '## Workflow Changes\n\nAdded Nodes:\n- HTTP Request (http1)\n\nRemoved Nodes:\n- None'
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/git/diff',
        payload: {
          before: { nodes: [], connections: {} },
          after: { 
            nodes: [{ id: 'http1', type: 'httpRequest', name: 'HTTP Request' }], 
            connections: {} 
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result.diff).toContain('Added Nodes');
      expect(result.diff).toContain('HTTP Request');
    });
  });
});