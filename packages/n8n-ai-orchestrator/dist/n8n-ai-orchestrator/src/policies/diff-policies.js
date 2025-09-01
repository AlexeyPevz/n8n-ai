import { z } from 'zod';
// Policy violation types
export class PolicyViolationError extends Error {
    policyName;
    violation;
    details;
    constructor(policyName, violation, details) {
        super(`Policy violation: ${policyName} - ${violation}`);
        this.policyName = policyName;
        this.violation = violation;
        this.details = details;
        this.name = 'PolicyViolationError';
    }
}
// Policy configuration schemas
export const NodeWhitelistPolicySchema = z.object({
    type: z.literal('node_whitelist'),
    enabled: z.boolean().default(true),
    whitelist: z.array(z.string()),
    allowUnknown: z.boolean().default(false),
});
export const OperationLimitPolicySchema = z.object({
    type: z.literal('operation_limit'),
    enabled: z.boolean().default(true),
    maxOperations: z.number().int().positive(),
    maxNodesPerBatch: z.number().int().positive().optional(),
    maxConnectionsPerBatch: z.number().int().positive().optional(),
});
export const NodeTypeLimitPolicySchema = z.object({
    type: z.literal('node_type_limit'),
    enabled: z.boolean().default(true),
    limits: z.record(z.string(), z.number().int().nonnegative()),
});
export const ParameterPolicySchema = z.object({
    type: z.literal('parameter_policy'),
    enabled: z.boolean().default(true),
    rules: z.array(z.object({
        nodeType: z.string(),
        parameter: z.string(),
        policy: z.enum(['forbidden', 'required', 'pattern']),
        pattern: z.string().optional(),
        message: z.string().optional(),
    })),
});
export const CostLimitPolicySchema = z.object({
    type: z.literal('cost_limit'),
    enabled: z.boolean().default(true),
    maxEstimatedCost: z.number().positive(),
    costUnit: z.enum(['tokens', 'dollars', 'credits']).default('tokens'),
});
export const WorkflowComplexityPolicySchema = z.object({
    type: z.literal('workflow_complexity'),
    enabled: z.boolean().default(true),
    maxNodes: z.number().int().positive(),
    maxDepth: z.number().int().positive(),
    maxConnections: z.number().int().positive(),
});
export const DiffPolicySchema = z.union([
    NodeWhitelistPolicySchema,
    OperationLimitPolicySchema,
    NodeTypeLimitPolicySchema,
    ParameterPolicySchema,
    CostLimitPolicySchema,
    WorkflowComplexityPolicySchema,
]);
export class NodeWhitelistPolicy {
    config;
    constructor(config) {
        this.config = config;
    }
    check(batch, context) {
        if (!this.config.enabled)
            return;
        for (const op of batch.ops) {
            if (op.op === 'add_node') {
                const nodeType = op.node.type;
                if (!this.config.whitelist.includes(nodeType)) {
                    if (!this.config.allowUnknown) {
                        throw new PolicyViolationError('node_whitelist', `Node type '${nodeType}' is not whitelisted`, { nodeType, whitelist: this.config.whitelist });
                    }
                }
            }
        }
    }
}
export class OperationLimitPolicy {
    config;
    constructor(config) {
        this.config = config;
    }
    check(batch, context) {
        if (!this.config.enabled)
            return;
        if (batch.ops.length > this.config.maxOperations) {
            throw new PolicyViolationError('operation_limit', `Batch contains ${batch.ops.length} operations, exceeding limit of ${this.config.maxOperations}`, { operationCount: batch.ops.length, limit: this.config.maxOperations });
        }
        if (this.config.maxNodesPerBatch) {
            const nodeOps = batch.ops.filter(op => op.op === 'add_node').length;
            if (nodeOps > this.config.maxNodesPerBatch) {
                throw new PolicyViolationError('operation_limit', `Batch adds ${nodeOps} nodes, exceeding limit of ${this.config.maxNodesPerBatch}`, { nodeCount: nodeOps, limit: this.config.maxNodesPerBatch });
            }
        }
        if (this.config.maxConnectionsPerBatch) {
            const connectionOps = batch.ops.filter(op => op.op === 'connect').length;
            if (connectionOps > this.config.maxConnectionsPerBatch) {
                throw new PolicyViolationError('operation_limit', `Batch creates ${connectionOps} connections, exceeding limit of ${this.config.maxConnectionsPerBatch}`, { connectionCount: connectionOps, limit: this.config.maxConnectionsPerBatch });
            }
        }
    }
}
export class NodeTypeLimitPolicy {
    config;
    constructor(config) {
        this.config = config;
    }
    check(batch, context) {
        if (!this.config.enabled)
            return;
        // Count existing nodes by type
        const existingCounts = {};
        if (context.currentWorkflow?.nodes) {
            for (const node of context.currentWorkflow.nodes) {
                existingCounts[node.type] = (existingCounts[node.type] || 0) + 1;
            }
        }
        // Count new nodes being added
        const newCounts = {};
        for (const op of batch.ops) {
            if (op.op === 'add_node') {
                newCounts[op.node.type] = (newCounts[op.node.type] || 0) + 1;
            }
        }
        // Check limits
        for (const [nodeType, limit] of Object.entries(this.config.limits)) {
            const existing = existingCounts[nodeType] || 0;
            const adding = newCounts[nodeType] || 0;
            const total = existing + adding;
            if (total > limit) {
                throw new PolicyViolationError('node_type_limit', `Total ${nodeType} nodes would be ${total}, exceeding limit of ${limit}`, { nodeType, existing, adding, total, limit });
            }
        }
    }
}
export class ParameterPolicy {
    config;
    constructor(config) {
        this.config = config;
    }
    check(batch, context) {
        if (!this.config.enabled)
            return;
        for (const op of batch.ops) {
            if (op.op === 'add_node' || op.op === 'set_params') {
                const nodeType = op.op === 'add_node' ? op.node.type : this.getNodeType(op.nodeId, context);
                const params = op.op === 'add_node' ? op.node.parameters : op.params;
                for (const rule of this.config.rules) {
                    if (rule.nodeType === nodeType || rule.nodeType === '*') {
                        this.checkRule(rule, params, nodeType);
                    }
                }
            }
        }
    }
    getNodeType(nodeId, context) {
        // TODO: Look up node type from context
        return 'unknown';
    }
    checkRule(rule, params, nodeType) {
        const value = params?.[rule.parameter];
        switch (rule.policy) {
            case 'forbidden':
                if (value !== undefined) {
                    throw new PolicyViolationError('parameter_policy', rule.message || `Parameter '${rule.parameter}' is forbidden for ${nodeType}`, { nodeType, parameter: rule.parameter, value });
                }
                break;
            case 'required':
                if (value === undefined) {
                    throw new PolicyViolationError('parameter_policy', rule.message || `Parameter '${rule.parameter}' is required for ${nodeType}`, { nodeType, parameter: rule.parameter });
                }
                break;
            case 'pattern':
                if (value !== undefined && rule.pattern) {
                    const regex = new RegExp(rule.pattern);
                    if (!regex.test(String(value))) {
                        throw new PolicyViolationError('parameter_policy', rule.message || `Parameter '${rule.parameter}' does not match required pattern`, { nodeType, parameter: rule.parameter, value, pattern: rule.pattern });
                    }
                }
                break;
        }
    }
}
export class CostLimitPolicy {
    config;
    constructor(config) {
        this.config = config;
    }
    check(batch, context) {
        if (!this.config.enabled)
            return;
        if (context.estimatedCost !== undefined) {
            if (context.estimatedCost > this.config.maxEstimatedCost) {
                throw new PolicyViolationError('cost_limit', `Estimated cost ${context.estimatedCost} ${this.config.costUnit} exceeds limit of ${this.config.maxEstimatedCost}`, {
                    estimatedCost: context.estimatedCost,
                    limit: this.config.maxEstimatedCost,
                    unit: this.config.costUnit
                });
            }
        }
    }
}
export class WorkflowComplexityPolicy {
    config;
    constructor(config) {
        this.config = config;
    }
    check(batch, context) {
        if (!this.config.enabled)
            return;
        // Calculate resulting workflow complexity
        let nodeCount = context.currentWorkflow?.nodes?.length || 0;
        let connectionCount = context.currentWorkflow?.connections?.length || 0;
        for (const op of batch.ops) {
            if (op.op === 'add_node')
                nodeCount++;
            if (op.op === 'connect')
                connectionCount++;
            if (op.op === 'delete') {
                // Rough estimate - would need more context for accurate count
                nodeCount--;
            }
        }
        if (nodeCount > this.config.maxNodes) {
            throw new PolicyViolationError('workflow_complexity', `Workflow would have ${nodeCount} nodes, exceeding limit of ${this.config.maxNodes}`, { nodeCount, limit: this.config.maxNodes });
        }
        if (connectionCount > this.config.maxConnections) {
            throw new PolicyViolationError('workflow_complexity', `Workflow would have ${connectionCount} connections, exceeding limit of ${this.config.maxConnections}`, { connectionCount, limit: this.config.maxConnections });
        }
        // TODO: Calculate depth
    }
}
// Policy manager
export class DiffPolicyManager {
    policies = [];
    constructor(configs) {
        for (const config of configs) {
            this.policies.push(this.createPolicy(config));
        }
    }
    createPolicy(config) {
        switch (config.type) {
            case 'node_whitelist':
                return new NodeWhitelistPolicy(config);
            case 'operation_limit':
                return new OperationLimitPolicy(config);
            case 'node_type_limit':
                return new NodeTypeLimitPolicy(config);
            case 'parameter_policy':
                return new ParameterPolicy(config);
            case 'cost_limit':
                return new CostLimitPolicy(config);
            case 'workflow_complexity':
                return new WorkflowComplexityPolicy(config);
            default:
                throw new Error(`Unknown policy type: ${config.type}`);
        }
    }
    checkBatch(batch, context) {
        for (const policy of this.policies) {
            policy.check(batch, context);
        }
    }
    async checkBatchAsync(batch, context) {
        // Allow for async policy checks in the future
        this.checkBatch(batch, context);
    }
}
