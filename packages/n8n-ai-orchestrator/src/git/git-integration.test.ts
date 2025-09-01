import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GitIntegration } from './git-integration.js';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
  promises: {
    writeFile: vi.fn(),
    readFile: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
  },
}));

describe('GitIntegration', () => {
  let gitIntegration: GitIntegration;
  const mockConfig = {
    repoPath: '/tmp/test-repo',
    branch: 'main',
    remote: 'origin',
    authorName: 'Test Bot',
    authorEmail: 'bot@test.com',
    useGitHub: true,
    githubToken: 'test-token',
  };

  beforeEach(() => {
    gitIntegration = new GitIntegration(mockConfig);
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize repository if not exists', async () => {
      const mockExec = vi.mocked(exec);
      mockExec.mockImplementation((cmd, opts, callback) => {
        if (callback) callback(null, '', '');
      });

      vi.mocked(fs.access).mockRejectedValue(new Error('Not found'));

      await gitIntegration.ensureRepository();

      expect(mockExec).toHaveBeenCalledWith(
        'git init',
        expect.objectContaining({ cwd: mockConfig.repoPath }),
        expect.any(Function)
      );
    });

    it('should not reinitialize existing repository', async () => {
      const mockExec = vi.mocked(exec);
      vi.mocked(fs.access).mockResolvedValue(undefined);

      await gitIntegration.ensureRepository();

      expect(mockExec).not.toHaveBeenCalledWith(
        'git init',
        expect.any(Object),
        expect.any(Function)
      );
    });
  });

  describe('workflow commits', () => {
    it('should commit workflow changes', async () => {
      const mockExec = vi.mocked(exec);
      mockExec.mockImplementation((cmd, opts, callback) => {
        if (callback) callback(null, '', '');
      });

      const workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        nodes: [],
        connections: {},
      };

      const result = await gitIntegration.commitWorkflow(
        workflow,
        'Updated workflow via AI',
        { promptUsed: 'test prompt' }
      );

      expect(vi.mocked(fs.writeFile)).toHaveBeenCalledWith(
        path.join(mockConfig.repoPath, 'workflows', 'test-workflow.json'),
        JSON.stringify(workflow, null, 2)
      );

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('git add'),
        expect.any(Object),
        expect.any(Function)
      );

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('git commit'),
        expect.any(Object),
        expect.any(Function)
      );

      expect(result).toMatchObject({
        success: true,
        commitHash: expect.any(String),
      });
    });

    it('should handle commit failures', async () => {
      const mockExec = vi.mocked(exec);
      mockExec.mockImplementation((cmd, opts, callback) => {
        if (cmd.includes('commit') && callback) {
          callback(new Error('Commit failed'), '', '');
        } else if (callback) {
          callback(null, '', '');
        }
      });

      const workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        nodes: [],
        connections: {},
      };

      await expect(
        gitIntegration.commitWorkflow(workflow, 'Test commit')
      ).rejects.toThrow('Commit failed');
    });
  });

  describe('pull request creation', () => {
    it('should create pull request with GitHub CLI', async () => {
      const mockExec = vi.mocked(exec);
      mockExec.mockImplementation((cmd, opts, callback) => {
        if (cmd.includes('gh pr create') && callback) {
          callback(null, 'https://github.com/test/repo/pull/123', '');
        } else if (callback) {
          callback(null, '', '');
        }
      });

      const result = await gitIntegration.createPullRequest({
        title: 'AI: Update workflow',
        body: 'Updated workflow based on prompt',
        branch: 'ai/update-workflow',
      });

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('gh pr create'),
        expect.any(Object),
        expect.any(Function)
      );

      expect(result).toMatchObject({
        success: true,
        prUrl: 'https://github.com/test/repo/pull/123',
      });
    });

    it('should handle PR creation without GitHub CLI', async () => {
      const git = new GitIntegration({ ...mockConfig, useGitHub: false });
      
      const result = await git.createPullRequest({
        title: 'Test PR',
        body: 'Test body',
        branch: 'test-branch',
      });

      expect(result).toMatchObject({
        success: false,
        message: expect.stringContaining('Manual PR creation required'),
      });
    });
  });

  describe('commit message generation', () => {
    it('should generate descriptive commit messages', () => {
      const operations = {
        version: 'v1',
        ops: [
          { op: 'add_node', nodeType: 'n8n-nodes-base.httpRequest' },
          { op: 'connect', source: 'node1', target: 'node2' },
        ],
      };

      const message = gitIntegration.generateCommitMessage(
        'Test Workflow',
        operations,
        'Create HTTP request workflow'
      );

      expect(message).toContain('AI: Update Test Workflow');
      expect(message).toContain('Prompt: Create HTTP request workflow');
      expect(message).toContain('- Add node: n8n-nodes-base.httpRequest');
      expect(message).toContain('- Connect: node1 → node2');
    });

    it('should handle empty operations', () => {
      const operations = { version: 'v1', ops: [] };

      const message = gitIntegration.generateCommitMessage(
        'Test Workflow',
        operations,
        'No changes'
      );

      expect(message).toContain('AI: Update Test Workflow');
      expect(message).toContain('No operations performed');
    });
  });

  describe('branch management', () => {
    it('should create unique branch names', async () => {
      const mockExec = vi.mocked(exec);
      mockExec.mockImplementation((cmd, opts, callback) => {
        if (callback) callback(null, '', '');
      });

      const branchName = await gitIntegration.createBranch('test-workflow');

      expect(branchName).toMatch(/^ai\/test-workflow-\d+$/);
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining(`git checkout -b ${branchName}`),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should switch back to main branch after operations', async () => {
      const mockExec = vi.mocked(exec);
      mockExec.mockImplementation((cmd, opts, callback) => {
        if (callback) callback(null, '', '');
      });

      await gitIntegration.switchToMainBranch();

      expect(mockExec).toHaveBeenCalledWith(
        `git checkout ${mockConfig.branch}`,
        expect.any(Object),
        expect.any(Function)
      );
    });
  });

  describe('diff generation', () => {
    it('should generate visual diff for PR', async () => {
      const oldWorkflow = {
        nodes: [{ id: '1', type: 'webhook', name: 'Webhook' }],
        connections: {},
      };

      const newWorkflow = {
        nodes: [
          { id: '1', type: 'webhook', name: 'Webhook' },
          { id: '2', type: 'httpRequest', name: 'HTTP Request' },
        ],
        connections: {
          '1': { main: [[{ node: '2', type: 'main', index: 0 }]] },
        },
      };

      const diff = await gitIntegration.generateDiff(oldWorkflow, newWorkflow);

      expect(diff).toContain('Added Nodes:');
      expect(diff).toContain('HTTP Request');
      expect(diff).toContain('New Connections:');
      expect(diff).toContain('Webhook → HTTP Request');
    });
  });
});