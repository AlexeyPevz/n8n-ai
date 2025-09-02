import { z } from 'zod';
// Schema for workflow dependencies
export const WorkflowDependencySchema = z.object({
    workflowId: z.string(),
    dependencies: z.array(z.object({
        type: z.enum(['execute_workflow', 'http_webhook', 'trigger_webhook', 'manual']),
        source: z.object({
            nodeId: z.string(),
            nodeName: z.string(),
            nodeType: z.string(),
        }),
        target: z.object({
            workflowId: z.string().optional(),
            webhookPath: z.string().optional(),
            httpUrl: z.string().optional(),
            probability: z.number().min(0).max(1).optional(), // For heuristic matches
        }),
        metadata: z.record(z.any()).optional(),
    })),
    indexedAt: z.string().datetime(),
});
/**
 * Indexes workflow dependencies and cross-workflow references
 */
export class DependencyIndexer {
    webhookIndex = new Map(); // path -> workflowIds
    constructor() { }
    /**
     * Build webhook index from all workflows
     */
    buildWebhookIndex(workflows) {
        this.webhookIndex.clear();
        for (const workflow of workflows) {
            for (const node of workflow.nodes) {
                if (this.isWebhookNode(node)) {
                    const path = this.extractWebhookPath(node);
                    if (path) {
                        if (!this.webhookIndex.has(path)) {
                            this.webhookIndex.set(path, new Set());
                        }
                        this.webhookIndex.get(path).add(workflow.id);
                    }
                }
            }
        }
    }
    /**
     * Index dependencies for a single workflow
     */
    indexWorkflow(workflow, allWorkflows) {
        const dependencies = [];
        for (const node of workflow.nodes) {
            // 1. Execute Workflow nodes (95% coverage target)
            if (this.isExecuteWorkflowNode(node)) {
                const targetWorkflowId = node.parameters?.workflowId;
                if (targetWorkflowId) {
                    dependencies.push({
                        type: 'execute_workflow',
                        source: {
                            nodeId: node.id,
                            nodeName: node.name,
                            nodeType: node.type,
                        },
                        target: {
                            workflowId: targetWorkflowId,
                        },
                    });
                }
            }
            // 2. HTTP Request nodes that might call webhooks (70% coverage target)
            else if (this.isHttpNode(node)) {
                const url = this.extractHttpUrl(node);
                if (url) {
                    const webhookMatch = this.matchHttpToWebhook(url);
                    if (webhookMatch) {
                        dependencies.push({
                            type: 'http_webhook',
                            source: {
                                nodeId: node.id,
                                nodeName: node.name,
                                nodeType: node.type,
                            },
                            target: {
                                webhookPath: webhookMatch.path,
                                httpUrl: url,
                                probability: webhookMatch.probability,
                            },
                            metadata: {
                                matchReason: webhookMatch.reason,
                            },
                        });
                    }
                }
            }
            // 3. Webhook trigger nodes (for incoming connections)
            else if (this.isWebhookNode(node)) {
                const path = this.extractWebhookPath(node);
                if (path) {
                    dependencies.push({
                        type: 'trigger_webhook',
                        source: {
                            nodeId: node.id,
                            nodeName: node.name,
                            nodeType: node.type,
                        },
                        target: {
                            webhookPath: path,
                        },
                    });
                }
            }
            // 4. Manual trigger nodes
            else if (this.isManualTriggerNode(node)) {
                dependencies.push({
                    type: 'manual',
                    source: {
                        nodeId: node.id,
                        nodeName: node.name,
                        nodeType: node.type,
                    },
                    target: {},
                });
            }
        }
        return {
            workflowId: workflow.id,
            dependencies,
            indexedAt: new Date().toISOString(),
        };
    }
    /**
     * Build full dependency map for all workflows
     */
    buildDependencyMap(workflows) {
        // First build webhook index
        this.buildWebhookIndex(workflows);
        const dependencyMap = new Map();
        for (const workflow of workflows) {
            const deps = this.indexWorkflow(workflow, workflows);
            dependencyMap.set(workflow.id, deps);
        }
        // Post-process to resolve HTTP->Webhook connections
        this.resolveHttpWebhookConnections(dependencyMap);
        return dependencyMap;
    }
    /**
     * Find workflows that depend on a given workflow
     */
    findDependents(workflowId, dependencyMap) {
        const dependents = [];
        for (const [depWorkflowId, deps] of dependencyMap) {
            for (const dep of deps.dependencies) {
                if (dep.type === 'execute_workflow' && dep.target.workflowId === workflowId) {
                    dependents.push(depWorkflowId);
                    break;
                }
            }
        }
        return dependents;
    }
    /**
     * Find workflows that this workflow depends on
     */
    findDependencies(workflowId, dependencyMap) {
        const deps = dependencyMap.get(workflowId);
        if (!deps)
            return [];
        const dependencies = [];
        for (const dep of deps.dependencies) {
            if (dep.type === 'execute_workflow' && dep.target.workflowId) {
                dependencies.push(dep.target.workflowId);
            }
        }
        return [...new Set(dependencies)]; // Remove duplicates
    }
    // Helper methods
    isExecuteWorkflowNode(node) {
        return node.type === 'n8n-nodes-base.executeWorkflow';
    }
    isHttpNode(node) {
        return node.type === 'n8n-nodes-base.httpRequest';
    }
    isWebhookNode(node) {
        return node.type === 'n8n-nodes-base.webhook';
    }
    isManualTriggerNode(node) {
        return node.type === 'n8n-nodes-base.manualTrigger';
    }
    extractWebhookPath(node) {
        const path = node.parameters?.path;
        if (typeof path === 'string' && path.startsWith('/')) {
            return path;
        }
        return null;
    }
    extractHttpUrl(node) {
        const url = node.parameters?.url;
        return typeof url === 'string' ? url : null;
    }
    /**
     * Heuristic matching of HTTP URLs to webhook paths
     * Returns match with probability score
     */
    matchHttpToWebhook(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            // High confidence matches (>= 0.9)
            // 1. Exact webhook path match
            if (this.webhookIndex.has(pathname)) {
                return {
                    path: pathname,
                    probability: 0.95,
                    reason: 'exact_path_match',
                };
            }
            // 2. n8n webhook URL pattern
            const n8nWebhookPattern = /^\/webhook\/([a-zA-Z0-9-_]+)$/;
            const n8nMatch = pathname.match(n8nWebhookPattern);
            if (n8nMatch) {
                return {
                    path: pathname,
                    probability: 0.9,
                    reason: 'n8n_webhook_pattern',
                };
            }
            // Medium confidence matches (0.7 - 0.89)
            // 3. Localhost/internal URL with webhook-like path
            const isInternal = urlObj.hostname === 'localhost' ||
                urlObj.hostname === '127.0.0.1' ||
                urlObj.hostname.endsWith('.local') ||
                urlObj.hostname.includes('n8n');
            if (isInternal && pathname.includes('webhook')) {
                return {
                    path: pathname,
                    probability: 0.8,
                    reason: 'internal_webhook_url',
                };
            }
            // 4. Check if path exists in webhook index with fuzzy match
            for (const [webhookPath] of this.webhookIndex) {
                if (this.fuzzyMatchPath(pathname, webhookPath)) {
                    return {
                        path: webhookPath,
                        probability: 0.75,
                        reason: 'fuzzy_path_match',
                    };
                }
            }
            // Low confidence matches (< 0.7) - might add more heuristics
        }
        catch (e) {
            // Invalid URL
        }
        return null;
    }
    /**
     * Fuzzy match two paths
     */
    fuzzyMatchPath(path1, path2) {
        // Remove leading/trailing slashes and normalize
        const normalize = (p) => p.replace(/^\/|\/$/g, '').toLowerCase();
        const p1 = normalize(path1);
        const p2 = normalize(path2);
        // Exact match after normalization
        if (p1 === p2)
            return true;
        // One contains the other
        if (p1.includes(p2) || p2.includes(p1))
            return true;
        // Same segments in different order
        const segments1 = p1.split('/');
        const segments2 = p2.split('/');
        if (segments1.length === segments2.length) {
            const sorted1 = [...segments1].sort().join('/');
            const sorted2 = [...segments2].sort().join('/');
            if (sorted1 === sorted2)
                return true;
        }
        return false;
    }
    /**
     * Resolve HTTP->Webhook connections using the webhook index
     */
    resolveHttpWebhookConnections(dependencyMap) {
        for (const deps of dependencyMap.values()) {
            for (const dep of deps.dependencies) {
                if (dep.type === 'http_webhook' && dep.target.webhookPath) {
                    // Find workflows that have this webhook path
                    const workflowIds = this.webhookIndex.get(dep.target.webhookPath);
                    if (workflowIds && workflowIds.size === 1) {
                        // Single match - high confidence
                        dep.target.workflowId = Array.from(workflowIds)[0];
                        // keep original probability as per tests
                    }
                    else if (workflowIds && workflowIds.size > 1) {
                        // Multiple matches - need disambiguation
                        dep.metadata = {
                            ...dep.metadata,
                            possibleTargets: Array.from(workflowIds),
                            disambiguationNeeded: true,
                        };
                    }
                }
            }
        }
    }
    /**
     * Calculate coverage metrics for the indexer
     */
    calculateCoverage(dependencyMap) {
        let totalExecuteNodes = 0;
        let coveredExecuteNodes = 0;
        let totalHttpNodes = 0;
        let coveredHttpNodes = 0;
        let totalNodes = 0;
        let coveredNodes = 0;
        for (const deps of dependencyMap.values()) {
            for (const dep of deps.dependencies) {
                totalNodes++;
                if (dep.type === 'execute_workflow') {
                    totalExecuteNodes++;
                    if (dep.target.workflowId) {
                        coveredExecuteNodes++;
                        coveredNodes++;
                    }
                }
                else if (dep.type === 'http_webhook') {
                    totalHttpNodes++;
                    if (dep.target.probability && dep.target.probability >= 0.7) {
                        coveredHttpNodes++;
                        coveredNodes++;
                    }
                }
                else {
                    // Other types are always "covered"
                    coveredNodes++;
                }
            }
        }
        return {
            executeWorkflowCoverage: totalExecuteNodes > 0 ? coveredExecuteNodes / totalExecuteNodes : 1,
            httpWebhookCoverage: totalHttpNodes > 0 ? coveredHttpNodes / totalHttpNodes : 1,
            totalNodes,
            coveredNodes,
        };
    }
}
