import { z } from 'zod';
import crypto from 'crypto';
import type { OperationBatch } from '@n8n-ai/schemas';

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
    violations: Array<{ policy: string; violation: string; details?: any }>
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
    violations: Array<{ policy: string; violation: string; details?: any }>
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
  
  private hashObject(obj: any): string {
    const json = JSON.stringify(obj, Object.keys(obj).sort());
    return this.hashString(json);
  }
}

// Database-backed audit logger (for production)
export class DatabaseAuditLogger implements IAuditLogger {
  constructor(private dbConnection: any) {
    // TODO: Implement with actual database connection
  }
  
  async logOperation(
    batch: OperationBatch,
    context: AuditContext,
    result: { status: 'success' | 'failed' | 'rejected'; error?: string }
  ): Promise<void> {
    // TODO: Insert into database
    throw new Error('Database audit logger not implemented');
  }
  
  async logPolicyViolation(
    batch: OperationBatch,
    context: AuditContext,
    violations: Array<{ policy: string; violation: string; details?: any }>
  ): Promise<void> {
    // TODO: Insert into database
    throw new Error('Database audit logger not implemented');
  }
  
  async query(filters: AuditQueryFilters): Promise<AuditLogEntry[]> {
    // TODO: Query from database
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
export function extractCostFromAIResponse(response: any): {
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
        prompt: response.usage.prompt_tokens || 0,
        completion: response.usage.completion_tokens || 0,
        total: response.usage.total_tokens || 0,
      },
      estimatedCost: response.usage.total_tokens, // Simple token count as cost
    };
  }
  
  // Add other provider formats as needed
  
  return {};
}