import { ArrayPaginator } from './pagination-system.js';
/**
 * Paginator for workflow nodes
 */
export class WorkflowNodePaginator {
    nodes;
    paginator;
    constructor(nodes) {
        this.nodes = nodes;
        this.paginator = new ArrayPaginator(nodes, (node) => node.id, (node) => node.createdAt || new Date());
    }
    /**
     * Get paginated nodes
     */
    getNodes(options) {
        return this.paginator.paginate(options);
    }
    /**
     * Get nodes by type with pagination
     */
    getNodesByType(nodeType, options) {
        const filtered = this.nodes.filter(node => node.type === nodeType);
        const paginator = new ArrayPaginator(filtered, (node) => node.id, (node) => node.createdAt || new Date());
        return paginator.paginate(options);
    }
    /**
     * Get nodes with errors
     */
    getNodesWithErrors(options) {
        const filtered = this.nodes.filter(node => node.errorCount && node.errorCount > 0);
        const paginator = new ArrayPaginator(filtered, (node) => node.id, (node) => node.errorCount || 0);
        return paginator.paginate({
            ...options,
            sortBy: options.sortBy || 'errorCount',
            sortOrder: options.sortOrder || 'desc',
        });
    }
    /**
     * Get slow nodes (execution time above threshold)
     */
    getSlowNodes(thresholdMs, options) {
        const filtered = this.nodes.filter(node => node.executionTime && node.executionTime > thresholdMs);
        const paginator = new ArrayPaginator(filtered, (node) => node.id, (node) => node.executionTime || 0);
        return paginator.paginate({
            ...options,
            sortBy: options.sortBy || 'executionTime',
            sortOrder: options.sortOrder || 'desc',
        });
    }
}
/**
 * Paginator for workflow connections
 */
export class WorkflowConnectionPaginator {
    connections;
    paginator;
    constructor(connections) {
        this.connections = connections;
        this.paginator = new ArrayPaginator(connections, (conn) => `${conn.from}-${conn.to}`, (conn) => conn.from);
    }
    /**
     * Get paginated connections
     */
    getConnections(options) {
        return this.paginator.paginate(options);
    }
    /**
     * Get connections for a specific node
     */
    getNodeConnections(nodeId, options) {
        const filtered = this.connections.filter(conn => conn.from === nodeId || conn.to === nodeId);
        const paginator = new ArrayPaginator(filtered, (conn) => `${conn.from}-${conn.to}`, (conn) => conn.from);
        return paginator.paginate(options);
    }
}
/**
 * Paginator for operation batches
 */
export class OperationBatchPaginator {
    batches;
    paginator;
    constructor(batches) {
        this.batches = batches;
        this.paginator = new ArrayPaginator(batches, (batch) => batch.id, (batch) => batch.timestamp);
    }
    /**
     * Get paginated operation batches
     */
    getBatches(options) {
        return this.paginator.paginate(options);
    }
    /**
     * Get batches for a specific workflow
     */
    getWorkflowBatches(workflowId, options) {
        const filtered = this.batches.filter(batch => batch.workflowId === workflowId);
        const paginator = new ArrayPaginator(filtered, (batch) => batch.id, (batch) => batch.timestamp);
        return paginator.paginate(options);
    }
    /**
     * Get batches by user
     */
    getUserBatches(userId, options) {
        const filtered = this.batches.filter(batch => batch.userId === userId);
        const paginator = new ArrayPaginator(filtered, (batch) => batch.id, (batch) => batch.timestamp);
        return paginator.paginate(options);
    }
}
/**
 * Manager for large workflow operations
 */
export class LargeWorkflowManager {
    CHUNK_SIZE = 50;
    MAX_NODES_IN_MEMORY = 1000;
    /**
     * Process large workflow in chunks
     */
    async processLargeWorkflow(workflowId, nodeCount, processor) {
        const results = [];
        const totalChunks = Math.ceil(nodeCount / this.CHUNK_SIZE);
        for (let i = 0; i < totalChunks; i++) {
            const chunk = await this.loadWorkflowChunk(workflowId, i);
            const result = await processor(chunk, i);
            results.push(result);
            // Allow garbage collection between chunks
            if (i % 10 === 0) {
                await new Promise(resolve => setImmediate(resolve));
            }
        }
        return results;
    }
    /**
     * Stream workflow nodes
     */
    async *streamWorkflowNodes(workflowId, options) {
        let page = 1;
        let hasMore = true;
        while (hasMore) {
            const chunk = await this.loadWorkflowPage(workflowId, page, this.CHUNK_SIZE);
            for (const node of chunk.nodes) {
                if (!options?.filter || options.filter(node)) {
                    yield options?.transform ? options.transform(node) : node;
                }
            }
            hasMore = chunk.hasMore;
            page++;
        }
    }
    /**
     * Batch operations for large workflows
     */
    async applyBatchOperations(workflowId, operations, options) {
        const chunkSize = options?.chunkSize || this.CHUNK_SIZE;
        const totalOps = operations.ops.length;
        const results = {
            successful: 0,
            failed: 0,
            errors: [],
        };
        for (let i = 0; i < totalOps; i += chunkSize) {
            const chunk = operations.ops.slice(i, i + chunkSize);
            try {
                if (options?.validateChunk) {
                    await this.validateOperationChunk(chunk);
                }
                await this.applyOperationChunk(workflowId, chunk);
                results.successful += chunk.length;
            }
            catch (error) {
                results.failed += chunk.length;
                chunk.forEach(op => {
                    results.errors.push({
                        operation: op,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                });
            }
            if (options?.onProgress) {
                const progress = Math.min(100, ((i + chunk.length) / totalOps) * 100);
                options.onProgress(progress);
            }
        }
        return results;
    }
    /**
     * Memory-efficient workflow analysis
     */
    async analyzeWorkflow(workflowId, analyzers) {
        const results = {};
        // Initialize result arrays
        analyzers.forEach(analyzer => {
            results[analyzer.name] = [];
        });
        // Process in chunks
        await this.processLargeWorkflow(workflowId, await this.getNodeCount(workflowId), async (nodes) => {
            for (const analyzer of analyzers) {
                const result = await analyzer.analyze(nodes);
                results[analyzer.name].push(result);
            }
        });
        // Reduce results
        const finalResults = {};
        for (const analyzer of analyzers) {
            if (analyzer.reduce) {
                finalResults[analyzer.name] = analyzer.reduce(results[analyzer.name]);
            }
            else {
                finalResults[analyzer.name] = results[analyzer.name];
            }
        }
        return finalResults;
    }
    // Mock implementations - in real system these would connect to database
    async loadWorkflowChunk(workflowId, chunkIndex) {
        // Simulate loading from database
        await new Promise(resolve => setTimeout(resolve, 10));
        return [];
    }
    async loadWorkflowPage(workflowId, page, limit) {
        // Simulate loading from database
        await new Promise(resolve => setTimeout(resolve, 10));
        return { nodes: [], hasMore: false };
    }
    async validateOperationChunk(operations) {
        // Simulate validation
        await new Promise(resolve => setTimeout(resolve, 5));
    }
    async applyOperationChunk(workflowId, operations) {
        // Simulate applying operations
        await new Promise(resolve => setTimeout(resolve, 20));
    }
    async getNodeCount(workflowId) {
        // Simulate getting count from database
        return 100;
    }
}
