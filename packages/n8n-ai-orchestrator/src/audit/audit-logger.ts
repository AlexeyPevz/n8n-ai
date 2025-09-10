import { z } from 'zod';
import crypto from 'crypto';
import type { OperationBatch } from '@n8n-ai/schemas';
import { EventEmitter } from 'node:events';

// Audit log entry schema
export const AuditLogEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  
  // User context
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  
  // Workflow context
  workflowId: z.string(),
  workflowName: z.string().optional(),
  
  // AI context
  prompt: z.string().optional(),
  promptHash: z.string(),
  model: z.string().optional(),
  provider: z.string().optional(),
  
  // Operation details
  operationBatch: z.any(), // OperationBatch
  operationCount: z.number(),
  operationTypes: z.array(z.string()),
  diffHash: z.string(),
  
  // Cost tracking
  estimatedCost: z.number().optional(),
  actualCost: z.number().optional(),
  costUnit: z.enum(['tokens', 'dollars', 'credits']).optional(),
  tokenUsage: z.object({
    prompt: z.number(),
    completion: z.number(),
    total: z.number(),
  }).optional(),
  
  // Execution details
  executionTime: z.number(), // milliseconds
  status: z.enum(['success', 'failed', 'rejected']),
  error: z.string().optional(),
  
  // Policy evaluation
  policiesEvaluated: z.array(z.string()).optional(),
  policyViolations: z.array(z.object({
    policy: z.string(),
    violation: z.string(),
    details: z.any().optional(),
  })).optional(),
  
  // Metadata
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
});

export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;

// Audit context for building log entries
export interface AuditContext {
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  workflowId: string;
  workflowName?: string;
  prompt?: string;
  model?: string;
  provider?: string;
  estimatedCost?: number;
  costUnit?: 'tokens' | 'dollars' | 'credits';
  tags?: string[];
  metadata?: Record<string, any>;
}

// Audit logger interface
export interface IAuditLogger {
  logOperation(
    batch: OperationBatch,
    context: AuditContext,
    result: { status: 'success' | 'failed' | 'rejected'; error?: string }
  ): Promise<void>;
  
  logPolicyViolation(
    batch: OperationBatch,
    context: AuditContext,
    violations: Array<{ policy: string; violation: string; details?: Record<string, unknown> }>
  ): Promise<void>;
  
  query(filters: AuditQueryFilters): Promise<AuditLogEntry[]>;
}

// Query filters
export interface AuditQueryFilters {
  userId?: string;
  workflowId?: string;
  startDate?: Date;
  endDate?: Date;
  status?: 'success' | 'failed' | 'rejected';
  model?: string;
  limit?: number;
  offset?: number;
}

// In-memory audit logger (for development)
export class InMemoryAuditLogger implements IAuditLogger {
  private logs: AuditLogEntry[] = [];
  
  async logOperation(
    batch: OperationBatch,
    context: AuditContext,
    result: { status: 'success' | 'failed' | 'rejected'; error?: string }
  ): Promise<void> {
    const startTime = Date.now();
    
    const entry: AuditLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      
      // User context
      userId: context.userId,
      sessionId: context.sessionId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      
      // Workflow context
      workflowId: context.workflowId,
      workflowName: context.workflowName,
      
      // AI context
      prompt: context.prompt,
      promptHash: this.hashString(context.prompt || ''),
      model: context.model,
      provider: context.provider,
      
      // Operation details
      operationBatch: batch,
      operationCount: batch.ops.length,
      operationTypes: [...new Set(batch.ops.map(op => op.op))],
      diffHash: this.hashObject(batch),
      
      // Cost tracking
      estimatedCost: context.estimatedCost,
      costUnit: context.costUnit,
      
      // Execution details
      executionTime: Date.now() - startTime,
      status: result.status,
      error: result.error,
      
      // Metadata
      tags: context.tags,
      metadata: context.metadata,
    };
    
    this.logs.push(entry);
    
    // Keep only last 10000 entries in memory
    if (this.logs.length > 10000) {
      this.logs = this.logs.slice(-10000);
    }
  }
  
  async logPolicyViolation(
    batch: OperationBatch,
    context: AuditContext,
    violations: Array<{ policy: string; violation: string; details?: Record<string, unknown> }>
  ): Promise<void> {
    await this.logOperation(batch, context, {
      status: 'rejected',
      error: `Policy violations: ${violations.map(v => v.violation).join(', ')}`,
    });
    
    // Update the last entry with violation details
    const lastEntry = this.logs[this.logs.length - 1];
    if (lastEntry) {
      lastEntry.policyViolations = violations;
      lastEntry.policiesEvaluated = violations.map(v => v.policy);
    }
  }
  
  async query(filters: AuditQueryFilters): Promise<AuditLogEntry[]> {
    let results = [...this.logs];
    
    // Apply filters
    if (filters.userId) {
      results = results.filter(log => log.userId === filters.userId);
    }
    
    if (filters.workflowId) {
      results = results.filter(log => log.workflowId === filters.workflowId);
    }
    
    if (filters.startDate) {
      const startTime = filters.startDate.getTime();
      results = results.filter(log => new Date(log.timestamp).getTime() >= startTime);
    }
    
    if (filters.endDate) {
      const endTime = filters.endDate.getTime();
      results = results.filter(log => new Date(log.timestamp).getTime() <= endTime);
    }
    
    if (filters.status) {
      results = results.filter(log => log.status === filters.status);
    }
    
    if (filters.model) {
      results = results.filter(log => log.model === filters.model);
    }
    
    // Sort by timestamp descending
    results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    
    // Apply pagination
    const offset = filters.offset || 0;
    const limit = filters.limit || 100;
    
    return results.slice(offset, offset + limit);
  }
  
  private hashString(str: string): string {
    return crypto.createHash('sha256').update(str).digest('hex');
  }
  
  private hashObject(obj: Record<string, unknown>): string {
    const json = JSON.stringify(obj, Object.keys(obj).sort());
    return this.hashString(json);
  }
}

// Database-backed audit logger (for production)
export class DatabaseAuditLogger implements IAuditLogger {
  constructor(private dbConnection: unknown) {
    // Database connection implementation
  }
  
  async logOperation(
    batch: OperationBatch,
    context: AuditContext,
    result: { status: 'success' | 'failed' | 'rejected'; error?: string }
  ): Promise<void> {
    // Insert into database
    throw new Error('Database audit logger not implemented');
  }
  
  async logPolicyViolation(
    batch: OperationBatch,
    context: AuditContext,
    violations: Array<{ policy: string; violation: string; details?: Record<string, unknown> }>
  ): Promise<void> {
    // Insert into database
    throw new Error('Database audit logger not implemented');
  }
  
  async query(filters: AuditQueryFilters): Promise<AuditLogEntry[]> {
    // Query from database
    throw new Error('Database audit logger not implemented');
  }
}

// Global audit logger instance
let auditLogger: IAuditLogger | null = null;

export function initializeAuditLogger(logger?: IAuditLogger): void {
  auditLogger = logger || new InMemoryAuditLogger();
}

export function getAuditLogger(): IAuditLogger {
  if (!auditLogger) {
    initializeAuditLogger();
  }
  return auditLogger!;
}

// Helper function to extract cost from AI response
export function extractCostFromAIResponse(response: Record<string, unknown>): {
  estimatedCost?: number;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
} {
  // OpenAI format
  if (response?.usage) {
    return {
      tokenUsage: {
        prompt: (response.usage as { prompt_tokens?: number }).prompt_tokens || 0,
        completion: (response.usage as { completion_tokens?: number }).completion_tokens || 0,
        total: (response.usage as { total_tokens?: number }).total_tokens || 0,
      },
      estimatedCost: (response.usage as { total_tokens?: number }).total_tokens || 0, // Simple token count as cost
    };
  }
  
  // Add other provider formats as needed
  
  return {};
}

export type AuditEvent = {
  id?: string;
  timestamp: Date;
  type: 'workflow_execution' | 'ai_prompt' | 'policy_violation' | 'git_operation';
  userId?: string;
  workflowId?: string;
  workflowName?: string;
  action?: string;
  status?: 'success' | 'failed' | 'rejected';
  metadata?: Record<string, unknown>;
  // ai details
  prompt?: string;
  promptHash?: string;
  model?: string;
  aiCost?: {
    promptTokens?: number;
    completionTokens?: number;
    totalCost?: number;
  };
  // policy details
  policyViolations?: Array<{ policy: string; violation: string; details?: Record<string, unknown> }>;
  // git details
  gitDetails?: {
    commitHash?: string;
    branch?: string;
    message?: string;
  };
};

export type AuditQuery = {
  userId?: string;
  workflowId?: string;
  type?: AuditEvent['type'];
  status?: AuditEvent['status'];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
};

export interface AuditStorage {
  save(event: AuditEvent): Promise<boolean>;
  query(filters: AuditQuery): Promise<AuditEvent[]>;
  count(filters: AuditQuery): Promise<number>;
  getStats?(filters: { startDate?: Date; endDate?: Date }): Promise<any>;
  deleteOlderThan?(date: Date): Promise<number>;
}

export class AuditLogger extends EventEmitter {
  private storage: AuditStorage;
  private enableConsole: boolean;
  private enableMetrics: boolean;
  private retentionDays?: number;

  constructor(opts: { storage: AuditStorage; enableConsole?: boolean; enableMetrics?: boolean; retentionDays?: number }) {
    super();
    this.storage = opts.storage;
    this.enableConsole = !!opts.enableConsole;
    this.enableMetrics = !!opts.enableMetrics;
    this.retentionDays = opts.retentionDays;
  }

  async log(event: AuditEvent): Promise<void> {
    const enriched: AuditEvent = { id: crypto.randomUUID(), ...event };
    // Emit immediately for real-time listeners
    this.emit('audit:logged', enriched);
    this.emit('log', enriched);
    await this.storage.save(enriched);
    if (this.enableConsole) {
      // minimal console log
      // eslint-disable-next-line no-console
      console.info('[audit]', enriched.type, enriched.status ?? '', enriched.userId ?? '', enriched.workflowId ?? '');
    }
  }

  async logAIPrompt(input: { userId?: string; workflowId?: string; prompt: string; model?: string; provider?: string; operations: OperationBatch; promptTokens?: number; completionTokens?: number; totalCost?: number; }): Promise<void> {
    const promptHash = crypto.createHash('sha256').update(input.prompt).digest('hex');
    await this.log({
      timestamp: new Date(),
      type: 'ai_prompt',
      userId: input.userId,
      workflowId: input.workflowId,
      prompt: input.prompt,
      promptHash,
      model: input.model,
      metadata: { provider: input.provider, operations: input.operations },
      aiCost: { promptTokens: input.promptTokens, completionTokens: input.completionTokens, totalCost: input.totalCost },
      status: 'success',
    });
  }

  async logPolicyViolation(input: { userId?: string; workflowId?: string; policyName: string; violation: string; details?: Record<string, unknown>; }): Promise<void> {
    await this.log({
      timestamp: new Date(),
      type: 'policy_violation',
      userId: input.userId,
      workflowId: input.workflowId,
      action: 'policy_check',
      status: 'failed',
      policyViolations: [{ policy: input.policyName, violation: input.violation, details: input.details }],
    });
  }

  async logGitOperation(input: { userId?: string; workflowId?: string; workflowName?: string; operation: 'commit' | 'pr' | 'branch' | string; commitHash?: string; branch?: string; message?: string; }): Promise<void> {
    await this.log({
      timestamp: new Date(),
      type: 'git_operation',
      userId: input.userId,
      workflowId: input.workflowId,
      workflowName: input.workflowName,
      action: input.operation,
      status: 'success',
      gitDetails: { commitHash: input.commitHash, branch: input.branch, message: input.message },
    });
  }

  async query(q: AuditQuery): Promise<AuditEvent[]> {
    return this.storage.query(q);
  }

  async getAIUsageStats(p: { startDate?: Date; endDate?: Date }): Promise<any> {
    if (this.storage.getStats) return this.storage.getStats(p);
    // Fallback: compute from queried events
    const events = await this.storage.query({ startDate: p.startDate, endDate: p.endDate, type: 'ai_prompt' });
    const byModel: Record<string, { count: number; tokens: number; cost: number }> = {};
    let totalPrompts = 0;
    let totalTokens = 0;
    let totalCost = 0;
    for (const e of events) {
      totalPrompts++;
      const model = (e.model as string) || 'unknown';
      const tokens = (e.aiCost?.promptTokens ?? 0) + (e.aiCost?.completionTokens ?? 0);
      const cost = e.aiCost?.totalCost ?? 0;
      totalTokens += tokens;
      totalCost += cost;
      byModel[model] = byModel[model] || { count: 0, tokens: 0, cost: 0 };
      byModel[model].count++;
      byModel[model].tokens += tokens;
      byModel[model].cost += cost;
    }
    return { totalPrompts, totalTokens, totalCost, byModel };
  }

  async getPolicyViolationSummary(p: { startDate?: Date; endDate?: Date }): Promise<Record<string, number>> {
    const events = await this.storage.query({ startDate: p.startDate, endDate: p.endDate, type: 'policy_violation' });
    const summary: Record<string, number> = {};
    for (const e of events) {
      for (const v of e.policyViolations ?? []) {
        summary[v.policy] = (summary[v.policy] || 0) + 1;
      }
    }
    return summary;
  }

  async generateComplianceReport(p: { startDate?: Date; endDate?: Date }): Promise<{ period: { start: Date; end: Date }; summary: { totalEvents: number; successRate: number; policyViolations: number } }> {
    const logs = await this.storage.query({ startDate: p.startDate, endDate: p.endDate });
    const totalEvents = logs.length;
    const successes = logs.filter(l => l.type === 'workflow_execution' && l.status === 'success').length;
    const policyViolations = logs.filter(l => l.type === 'policy_violation').length;
    const successRate = totalEvents ? successes / totalEvents : 0;
    return {
      period: { start: p.startDate ?? new Date(0), end: p.endDate ?? new Date() },
      summary: { totalEvents, successRate, policyViolations },
    };
  }

  async exportLogs(p: { format: 'csv' | 'json'; startDate?: Date; endDate?: Date }): Promise<string> {
    const logs = await this.storage.query({ startDate: p.startDate, endDate: p.endDate });
    if (p.format === 'json') return JSON.stringify(logs);
    // csv
    const header = 'id,timestamp,type,userId,action,status';
    const rows = logs.map(l => [l.id, l.timestamp.toISOString?.() ?? String(l.timestamp), l.type, l.userId ?? '', l.action ?? '', l.status ?? ''].join(','));
    return [header, ...rows].join('\n');
  }

  async cleanupOldLogs(): Promise<void> {
    if (!this.retentionDays || !this.storage.deleteOlderThan) return;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.retentionDays);
    await this.storage.deleteOlderThan(cutoff);
  }
}