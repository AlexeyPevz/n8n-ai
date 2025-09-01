import { DependencyIndexer } from './dependency-indexer.js';
export class WorkflowMapService {
    indexer;
    introspectAPI;
    dependencyCache = new Map();
    lastIndexTime = null;
    constructor(introspectAPI) {
        this.indexer = new DependencyIndexer();
        this.introspectAPI = introspectAPI;
    }
    /**
     * Get workflow map for specified workflows or all workflows
     */
    async getWorkflowMap(options = {}) {
        const { workflowIds, includeExternal = false, depth = 2 } = options;
        // Ensure index is fresh
        if (!this.lastIndexTime || this.isCacheStale()) {
            await this.refreshIndex();
        }
        const nodes = [];
        const edges = [];
        const processedWorkflows = new Set();
        const workflowsToProcess = new Set(workflowIds || Array.from(this.dependencyCache.keys()));
        // Process workflows up to specified depth
        let currentDepth = 0;
        while (workflowsToProcess.size > 0 && currentDepth < depth) {
            const currentBatch = Array.from(workflowsToProcess);
            workflowsToProcess.clear();
            for (const workflowId of currentBatch) {
                if (processedWorkflows.has(workflowId))
                    continue;
                const deps = this.dependencyCache.get(workflowId);
                if (!deps)
                    continue;
                processedWorkflows.add(workflowId);
                // Add workflow node
                const workflowInfo = await this.getWorkflowInfo(workflowId);
                if (workflowInfo) {
                    nodes.push({
                        id: workflowId,
                        name: workflowInfo.name,
                        type: 'workflow',
                        metadata: {
                            nodeCount: workflowInfo.nodeCount,
                            active: workflowInfo.active,
                        },
                    });
                }
                // Process dependencies
                for (const dep of deps.dependencies) {
                    if (dep.type === 'execute_workflow' && dep.target.workflowId) {
                        edges.push({
                            source: workflowId,
                            target: dep.target.workflowId,
                            type: 'execute_workflow',
                        });
                        // Add to next batch if not at max depth
                        if (currentDepth < depth - 1) {
                            workflowsToProcess.add(dep.target.workflowId);
                        }
                    }
                    else if (dep.type === 'http_webhook') {
                        // Create webhook node if needed
                        const webhookNodeId = `webhook:${dep.target.webhookPath}`;
                        if (!nodes.find(n => n.id === webhookNodeId)) {
                            nodes.push({
                                id: webhookNodeId,
                                name: dep.target.webhookPath || 'Unknown Webhook',
                                type: 'webhook',
                                metadata: {
                                    url: dep.target.httpUrl,
                                },
                            });
                        }
                        edges.push({
                            source: workflowId,
                            target: webhookNodeId,
                            type: 'http_webhook',
                            probability: dep.target.probability,
                            metadata: dep.metadata,
                        });
                        // If webhook resolves to a workflow, add that edge too
                        if (dep.target.workflowId) {
                            edges.push({
                                source: webhookNodeId,
                                target: dep.target.workflowId,
                                type: 'trigger_webhook',
                            });
                            if (currentDepth < depth - 1) {
                                workflowsToProcess.add(dep.target.workflowId);
                            }
                        }
                    }
                    else if (dep.type === 'trigger_webhook') {
                        const webhookNodeId = `webhook:${dep.target.webhookPath}`;
                        if (!nodes.find(n => n.id === webhookNodeId)) {
                            nodes.push({
                                id: webhookNodeId,
                                name: dep.target.webhookPath || 'Unknown Webhook',
                                type: 'webhook',
                            });
                        }
                    }
                }
            }
            currentDepth++;
        }
        // Add external nodes if requested
        if (includeExternal) {
            this.addExternalNodes(nodes, edges, processedWorkflows);
        }
        // Calculate statistics
        const coverage = this.indexer.calculateCoverage(this.dependencyCache);
        return {
            nodes,
            edges,
            stats: {
                totalWorkflows: processedWorkflows.size,
                totalConnections: edges.length,
                executeWorkflowCoverage: coverage.executeWorkflowCoverage,
                httpWebhookCoverage: coverage.httpWebhookCoverage,
            },
            generatedAt: new Date().toISOString(),
        };
    }
    /**
     * Get dependencies for a specific workflow
     */
    async getWorkflowDependencies(workflowId, options) {
        const { direction, depth } = options;
        // Ensure index is fresh
        if (!this.lastIndexTime || this.isCacheStale()) {
            await this.refreshIndex();
        }
        // Check workflow exists
        if (!this.dependencyCache.has(workflowId)) {
            throw new Error(`Workflow ${workflowId} not found`);
        }
        const workflowIds = new Set([workflowId]);
        // Find related workflows based on direction
        if (direction === 'dependencies' || direction === 'both') {
            this.findDependenciesRecursive(workflowId, workflowIds, depth);
        }
        if (direction === 'dependents' || direction === 'both') {
            this.findDependentsRecursive(workflowId, workflowIds, depth);
        }
        // Generate map for found workflows
        return this.getWorkflowMap({
            workflowIds: Array.from(workflowIds),
            includeExternal: false,
            depth: 1, // We already collected the right workflows
        });
    }
    /**
     * Refresh the dependency index
     */
    async refreshIndex(workflowIds) {
        // Get workflows from n8n
        const workflows = await this.fetchWorkflows(workflowIds);
        // Build dependency map
        const depMap = this.indexer.buildDependencyMap(workflows);
        // Update cache
        this.dependencyCache.clear();
        for (const [id, deps] of depMap) {
            this.dependencyCache.set(id, deps);
        }
        this.lastIndexTime = new Date();
        return { indexedWorkflows: workflows.length };
    }
    /**
     * Get statistics about the workflow map
     */
    async getStatistics() {
        if (!this.lastIndexTime || this.isCacheStale()) {
            await this.refreshIndex();
        }
        const coverage = this.indexer.calculateCoverage(this.dependencyCache);
        // Find top dependencies (most depended-on workflows)
        const dependentCounts = new Map();
        for (const [workflowId] of this.dependencyCache) {
            const dependents = this.indexer.findDependents(workflowId, this.dependencyCache);
            dependentCounts.set(workflowId, dependents.length);
        }
        const topDependencies = Array.from(dependentCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .filter(([_, count]) => count > 0)
            .map(async ([workflowId, count]) => {
            const info = await this.getWorkflowInfo(workflowId);
            return {
                workflowId,
                workflowName: info?.name || 'Unknown',
                dependentCount: count,
            };
        });
        // Find orphaned workflows (no dependencies or dependents)
        const orphaned = [];
        for (const [workflowId, deps] of this.dependencyCache) {
            const hasDependencies = deps.dependencies.some(d => d.type === 'execute_workflow' && d.target.workflowId);
            const hasDependents = this.indexer.findDependents(workflowId, this.dependencyCache).length > 0;
            if (!hasDependencies && !hasDependents && deps.dependencies.length > 0) {
                const info = await this.getWorkflowInfo(workflowId);
                orphaned.push({
                    workflowId,
                    workflowName: info?.name || 'Unknown',
                });
            }
        }
        return {
            totalWorkflows: this.dependencyCache.size,
            totalConnections: Array.from(this.dependencyCache.values())
                .reduce((sum, deps) => sum + deps.dependencies.length, 0),
            coverage: {
                executeWorkflow: coverage.executeWorkflowCoverage,
                httpWebhook: coverage.httpWebhookCoverage,
                overall: coverage.totalNodes > 0 ? coverage.coveredNodes / coverage.totalNodes : 0,
            },
            topDependencies: await Promise.all(topDependencies),
            orphanedWorkflows: orphaned.slice(0, 20),
            lastIndexed: this.lastIndexTime?.toISOString() || null,
        };
    }
    // Private helper methods
    async fetchWorkflows(workflowIds) {
        // Implementation would connect to n8n API in production
        // Currently returns empty data until n8n connection is configured
        return [
            {
                id: 'wf1',
                name: 'Main ETL Pipeline',
                nodes: [
                    {
                        id: 'manual',
                        name: 'Manual Trigger',
                        type: 'n8n-nodes-base.manualTrigger',
                        position: [250, 300],
                    },
                    {
                        id: 'exec1',
                        name: 'Extract Data',
                        type: 'n8n-nodes-base.executeWorkflow',
                        parameters: { workflowId: 'wf2' },
                        position: [450, 300],
                    },
                    {
                        id: 'exec2',
                        name: 'Transform Data',
                        type: 'n8n-nodes-base.executeWorkflow',
                        parameters: { workflowId: 'wf3' },
                        position: [650, 300],
                    },
                    {
                        id: 'webhook',
                        name: 'Send Complete Signal',
                        type: 'n8n-nodes-base.httpRequest',
                        parameters: { url: 'http://localhost:5678/webhook/etl-complete' },
                        position: [850, 300],
                    },
                ],
                connections: {},
            },
            {
                id: 'wf2',
                name: 'Data Extractor',
                nodes: [
                    {
                        id: 'webhook',
                        name: 'Webhook',
                        type: 'n8n-nodes-base.webhook',
                        parameters: { path: '/webhook/extract' },
                        position: [250, 300],
                    },
                ],
                connections: {},
            },
            {
                id: 'wf3',
                name: 'Data Transformer',
                nodes: [
                    {
                        id: 'webhook',
                        name: 'Webhook',
                        type: 'n8n-nodes-base.webhook',
                        parameters: { path: '/webhook/transform' },
                        position: [250, 300],
                    },
                ],
                connections: {},
            },
            {
                id: 'wf4',
                name: 'Completion Handler',
                nodes: [
                    {
                        id: 'webhook',
                        name: 'ETL Complete Webhook',
                        type: 'n8n-nodes-base.webhook',
                        parameters: { path: '/webhook/etl-complete' },
                        position: [250, 300],
                    },
                ],
                connections: {},
            },
        ].filter(wf => !workflowIds || workflowIds.includes(wf.id));
    }
    async getWorkflowInfo(workflowId) {
        // Mock implementation
        const mockData = {
            wf1: { name: 'Main ETL Pipeline', nodeCount: 4, active: true },
            wf2: { name: 'Data Extractor', nodeCount: 1, active: true },
            wf3: { name: 'Data Transformer', nodeCount: 1, active: true },
            wf4: { name: 'Completion Handler', nodeCount: 1, active: false },
        };
        return mockData[workflowId] || { name: workflowId, nodeCount: 0, active: false };
    }
    isCacheStale() {
        if (!this.lastIndexTime)
            return true;
        // Consider cache stale after 5 minutes
        const staleTime = 5 * 60 * 1000;
        return Date.now() - this.lastIndexTime.getTime() > staleTime;
    }
    findDependenciesRecursive(workflowId, collected, maxDepth, currentDepth = 0) {
        if (currentDepth >= maxDepth)
            return;
        const dependencies = this.indexer.findDependencies(workflowId, this.dependencyCache);
        for (const depId of dependencies) {
            if (!collected.has(depId)) {
                collected.add(depId);
                this.findDependenciesRecursive(depId, collected, maxDepth, currentDepth + 1);
            }
        }
    }
    findDependentsRecursive(workflowId, collected, maxDepth, currentDepth = 0) {
        if (currentDepth >= maxDepth)
            return;
        const dependents = this.indexer.findDependents(workflowId, this.dependencyCache);
        for (const depId of dependents) {
            if (!collected.has(depId)) {
                collected.add(depId);
                this.findDependentsRecursive(depId, collected, maxDepth, currentDepth + 1);
            }
        }
    }
    addExternalNodes(nodes, edges, processedWorkflows) {
        // Add nodes for workflows referenced but not processed
        for (const edge of edges) {
            if (edge.type === 'execute_workflow' && !processedWorkflows.has(edge.target)) {
                if (!nodes.find(n => n.id === edge.target)) {
                    nodes.push({
                        id: edge.target,
                        name: `External: ${edge.target}`,
                        type: 'external',
                        metadata: { external: true },
                    });
                }
            }
        }
    }
}
