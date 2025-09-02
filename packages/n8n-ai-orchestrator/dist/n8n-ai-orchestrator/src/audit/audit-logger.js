import { z } from 'zod';
import crypto from 'crypto';
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
// In-memory audit logger (for development)
export class InMemoryAuditLogger {
    logs = [];
    async logOperation(batch, context, result) {
        const startTime = Date.now();
        const entry = {
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
    async logPolicyViolation(batch, context, violations) {
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
    async query(filters) {
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
    hashString(str) {
        return crypto.createHash('sha256').update(str).digest('hex');
    }
    hashObject(obj) {
        const json = JSON.stringify(obj, Object.keys(obj).sort());
        return this.hashString(json);
    }
}
// Database-backed audit logger (for production)
export class DatabaseAuditLogger {
    dbConnection;
    constructor(dbConnection) {
        this.dbConnection = dbConnection;
        // TODO: Implement with actual database connection
    }
    async logOperation(batch, context, result) {
        // TODO: Insert into database
        throw new Error('Database audit logger not implemented');
    }
    async logPolicyViolation(batch, context, violations) {
        // TODO: Insert into database
        throw new Error('Database audit logger not implemented');
    }
    async query(filters) {
        // TODO: Query from database
        throw new Error('Database audit logger not implemented');
    }
}
// Global audit logger instance
let auditLogger = null;
export function initializeAuditLogger(logger) {
    auditLogger = logger || new InMemoryAuditLogger();
}
export function getAuditLogger() {
    if (!auditLogger) {
        initializeAuditLogger();
    }
    return auditLogger;
}
// Helper function to extract cost from AI response
export function extractCostFromAIResponse(response) {
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
export class AuditLogger extends EventEmitter {
    storage;
    enableConsole;
    enableMetrics;
    retentionDays;
    constructor(opts) {
        super();
        this.storage = opts.storage;
        this.enableConsole = !!opts.enableConsole;
        this.enableMetrics = !!opts.enableMetrics;
        this.retentionDays = opts.retentionDays;
    }
    async log(event) {
        const enriched = { id: crypto.randomUUID(), ...event };
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
    async logAIPrompt(input) {
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
    async logPolicyViolation(input) {
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
    async logGitOperation(input) {
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
    async query(q) {
        return this.storage.query(q);
    }
    async getAIUsageStats(p) {
        if (this.storage.getStats)
            return this.storage.getStats(p);
        // Fallback: compute from queried events
        const events = await this.storage.query({ startDate: p.startDate, endDate: p.endDate, type: 'ai_prompt' });
        const byModel = {};
        let totalPrompts = 0;
        let totalTokens = 0;
        let totalCost = 0;
        for (const e of events) {
            totalPrompts++;
            const model = e.model || 'unknown';
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
    async getPolicyViolationSummary(p) {
        const events = await this.storage.query({ startDate: p.startDate, endDate: p.endDate, type: 'policy_violation' });
        const summary = {};
        for (const e of events) {
            for (const v of e.policyViolations ?? []) {
                summary[v.policy] = (summary[v.policy] || 0) + 1;
            }
        }
        return summary;
    }
    async generateComplianceReport(p) {
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
    async exportLogs(p) {
        const logs = await this.storage.query({ startDate: p.startDate, endDate: p.endDate });
        if (p.format === 'json')
            return JSON.stringify(logs);
        // csv
        const header = 'id,timestamp,type,userId,action,status';
        const rows = logs.map(l => [l.id, l.timestamp.toISOString?.() ?? String(l.timestamp), l.type, l.userId ?? '', l.action ?? '', l.status ?? ''].join(','));
        return [header, ...rows].join('\n');
    }
    async cleanupOldLogs() {
        if (!this.retentionDays || !this.storage.deleteOlderThan)
            return;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - this.retentionDays);
        await this.storage.deleteOlderThan(cutoff);
    }
}
