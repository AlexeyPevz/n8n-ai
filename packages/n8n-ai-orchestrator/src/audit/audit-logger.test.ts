import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditLogger, AuditEvent, AuditQuery } from './audit-logger.js';
import type { OperationBatch } from '@n8n-ai/schemas';

describe('AuditLogger', () => {
  let auditLogger: AuditLogger;
  let mockStorage: any;

  beforeEach(() => {
    mockStorage = {
      save: vi.fn().mockResolvedValue(true),
      query: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      getStats: vi.fn().mockResolvedValue({}),
    };
    
    auditLogger = new AuditLogger({
      storage: mockStorage,
      enableConsole: false,
      enableMetrics: false,
    });
  });

  describe('logging events', () => {
    it('should log workflow execution events', async () => {
      const event: AuditEvent = {
        timestamp: new Date(),
        type: 'workflow_execution',
        userId: 'user123',
        workflowId: 'workflow456',
        workflowName: 'Test Workflow',
        action: 'apply',
        status: 'success',
        metadata: {
          nodeCount: 5,
          executionTime: 1234,
        },
      };

      await auditLogger.log(event);

      expect(mockStorage.save).toHaveBeenCalledWith(expect.objectContaining({
        ...event,
        id: expect.any(String),
      }));
    });

    it('should log AI prompt events with hash', async () => {
      const operations: OperationBatch = {
        version: 'v1',
        ops: [
          { op: 'add_node', nodeType: 'n8n-nodes-base.httpRequest', position: [0, 0] },
        ],
      };

      await auditLogger.logAIPrompt({
        userId: 'user123',
        workflowId: 'workflow456',
        prompt: 'Create HTTP request to fetch users',
        model: 'gpt-4',
        provider: 'openai',
        operations,
        promptTokens: 50,
        completionTokens: 150,
        totalCost: 0.006,
      });

      expect(mockStorage.save).toHaveBeenCalledWith(expect.objectContaining({
        type: 'ai_prompt',
        prompt: 'Create HTTP request to fetch users',
        promptHash: expect.stringMatching(/^[a-f0-9]{64}$/), // SHA256 hash
        model: 'gpt-4',
        aiCost: {
          promptTokens: 50,
          completionTokens: 150,
          totalCost: 0.006,
        },
      }));
    });

    it('should log policy violations', async () => {
      await auditLogger.logPolicyViolation({
        userId: 'user123',
        workflowId: 'workflow456',
        policyName: 'node_whitelist',
        violation: 'Attempted to use forbidden node type',
        details: {
          nodeType: 'n8n-nodes-base.executeCommand',
          allowedNodes: ['httpRequest', 'webhook', 'set'],
        },
      });

      expect(mockStorage.save).toHaveBeenCalledWith(expect.objectContaining({
        type: 'policy_violation',
        action: 'policy_check',
        status: 'failed',
        policyViolations: [{
          policy: 'node_whitelist',
          violation: 'Attempted to use forbidden node type',
          details: expect.any(Object),
        }],
      }));
    });

    it('should log git operations', async () => {
      await auditLogger.logGitOperation({
        userId: 'user123',
        workflowId: 'workflow456',
        workflowName: 'Test Workflow',
        operation: 'commit',
        commitHash: 'abc123def456',
        branch: 'feature/ai-update',
        message: 'AI: Update workflow based on prompt',
      });

      expect(mockStorage.save).toHaveBeenCalledWith(expect.objectContaining({
        type: 'git_operation',
        action: 'commit',
        gitDetails: {
          commitHash: 'abc123def456',
          branch: 'feature/ai-update',
          message: 'AI: Update workflow based on prompt',
        },
      }));
    });
  });

  describe('querying audit logs', () => {
    it('should query logs by user', async () => {
      const mockLogs = [
        { id: '1', userId: 'user123', type: 'workflow_execution' },
        { id: '2', userId: 'user123', type: 'ai_prompt' },
      ];
      mockStorage.query.mockResolvedValue(mockLogs);

      const result = await auditLogger.query({
        userId: 'user123',
      });

      expect(mockStorage.query).toHaveBeenCalledWith({
        userId: 'user123',
      });
      expect(result).toEqual(mockLogs);
    });

    it('should query logs by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      await auditLogger.query({
        startDate,
        endDate,
      });

      expect(mockStorage.query).toHaveBeenCalledWith({
        startDate,
        endDate,
      });
    });

    it('should query logs with complex filters', async () => {
      await auditLogger.query({
        userId: 'user123',
        workflowId: 'workflow456',
        type: 'ai_prompt',
        status: 'success',
        limit: 50,
        offset: 100,
      });

      expect(mockStorage.query).toHaveBeenCalledWith({
        userId: 'user123',
        workflowId: 'workflow456',
        type: 'ai_prompt',
        status: 'success',
        limit: 50,
        offset: 100,
      });
    });
  });

  describe('audit statistics', () => {
    it('should calculate AI usage stats', async () => {
      const mockStats = {
        totalPrompts: 150,
        totalTokens: 45000,
        totalCost: 1.35,
        byModel: {
          'gpt-4': { count: 50, tokens: 30000, cost: 1.2 },
          'gpt-3.5-turbo': { count: 100, tokens: 15000, cost: 0.15 },
        },
        byUser: {
          'user123': { count: 80, tokens: 25000, cost: 0.8 },
          'user456': { count: 70, tokens: 20000, cost: 0.55 },
        },
      };

      mockStorage.getStats.mockResolvedValue(mockStats);

      const stats = await auditLogger.getAIUsageStats({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      });

      expect(stats).toEqual(mockStats);
    });

    it('should get policy violation summary', async () => {
      const violations = [
        {
          policyViolations: [{
            policy: 'node_whitelist',
            violation: 'Forbidden node',
          }],
        },
        {
          policyViolations: [{
            policy: 'node_whitelist',
            violation: 'Forbidden node',
          }],
        },
        {
          policyViolations: [{
            policy: 'cost_limit',
            violation: 'Exceeded limit',
          }],
        },
      ];

      mockStorage.query.mockResolvedValue(violations);

      const summary = await auditLogger.getPolicyViolationSummary({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      });

      expect(summary).toEqual({
        'node_whitelist': 2,
        'cost_limit': 1,
      });
    });
  });

  describe('compliance and reporting', () => {
    it('should generate compliance report', async () => {
      mockStorage.query.mockResolvedValue([
        { type: 'workflow_execution', status: 'success' },
        { type: 'workflow_execution', status: 'success' },
        { type: 'workflow_execution', status: 'failed' },
        { type: 'policy_violation' },
      ]);

      mockStorage.count.mockResolvedValue(4);

      const report = await auditLogger.generateComplianceReport({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      });

      expect(report).toMatchObject({
        period: {
          start: expect.any(Date),
          end: expect.any(Date),
        },
        summary: {
          totalEvents: 4,
          successRate: 0.5, // 2 success out of 4 total
          policyViolations: 1,
        },
      });
    });

    it('should export audit logs', async () => {
      const mockLogs = [
        {
          id: '1',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          type: 'workflow_execution',
          userId: 'user123',
          action: 'apply',
          status: 'success',
        },
      ];

      mockStorage.query.mockResolvedValue(mockLogs);

      const exported = await auditLogger.exportLogs({
        format: 'csv',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      });

      expect(exported).toContain('id,timestamp,type,userId,action,status');
      expect(exported).toContain('1,2024-01-15T10:00:00.000Z,workflow_execution,user123,apply,success');
    });
  });

  describe('retention and cleanup', () => {
    it('should delete old logs based on retention policy', async () => {
      const mockDeleteOld = vi.fn().mockResolvedValue(100);
      mockStorage.deleteOlderThan = mockDeleteOld;

      const auditLoggerWithRetention = new AuditLogger({
        storage: mockStorage,
        retentionDays: 90,
      });

      await auditLoggerWithRetention.cleanupOldLogs();

      expect(mockDeleteOld).toHaveBeenCalledWith(expect.any(Date));
      
      // Check that date is approximately 90 days ago
      const calledDate = mockDeleteOld.mock.calls[0][0];
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - 90);
      
      expect(calledDate.getTime()).toBeCloseTo(expectedDate.getTime(), -10000); // Within 10 seconds
    });
  });

  describe('real-time monitoring', () => {
    it('should emit events for monitoring', () => {
      const listener = vi.fn();
      auditLogger.on('audit:logged', listener);

      const event: AuditEvent = {
        timestamp: new Date(),
        type: 'workflow_execution',
        userId: 'user123',
        workflowId: 'workflow456',
        action: 'apply',
        status: 'success',
      };

      auditLogger.log(event);

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        ...event,
        id: expect.any(String),
      }));
    });
  });
});