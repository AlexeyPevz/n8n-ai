import { paginatedRoute, streamLargeDataset } from './pagination-middleware.js';
import { WorkflowNodePaginator, WorkflowConnectionPaginator, OperationBatchPaginator, LargeWorkflowManager } from './workflow-paginator.js';
import { appMetrics } from '../monitoring/app-metrics.js';
// Sample data structure for API documentation
const sampleNodes = process.env.NODE_ENV === 'development' ? Array.from({ length: 1000 }, (_, i) => ({
    id: `node-${i}`,
    name: `Node ${i}`,
    type: ['n8n-nodes-base.httpRequest', 'n8n-nodes-base.set', 'n8n-nodes-base.if'][i % 3],
    typeVersion: 1,
    position: [100 + (i % 10) * 150, 100 + Math.floor(i / 10) * 150],
    parameters: {},
    createdAt: new Date(Date.now() - i * 60000),
    executionTime: Math.random() * 1000,
    errorCount: Math.random() > 0.9 ? Math.floor(Math.random() * 5) : 0,
})) : [];
const sampleConnections = process.env.NODE_ENV === 'development' ? Array.from({ length: 500 }, (_, i) => ({
    from: `node-${i}`,
    to: `node-${i + 1}`,
})) : [];
const sampleBatches = process.env.NODE_ENV === 'development' ? Array.from({ length: 200 }, (_, i) => ({
    id: `batch-${i}`,
    version: 'v1',
    ops: [],
    workflowId: `workflow-${Math.floor(i / 10)}`,
    userId: `user-${i % 5}`,
    timestamp: new Date(Date.now() - i * 3600000),
    executionTime: Math.random() * 500,
})) : [];
export async function registerPaginationRoutes(server) {
    const largeWorkflowManager = new LargeWorkflowManager();
    // Get workflow nodes with pagination
    server.get('/workflows/:workflowId/nodes', paginatedRoute(async (request, reply) => {
        const { workflowId } = request.params;
        // Track metrics
        const timer = appMetrics.graph.operationDuration.startTimer({ operation: 'list_nodes' });
        try {
            // In real implementation, fetch from database
            const paginator = new WorkflowNodePaginator(sampleNodes);
            const result = paginator.getNodes(request.pagination);
            timer();
            return {
                data: result.data,
                total: result.meta.total,
            };
        }
        catch (error) {
            timer();
            throw error;
        }
    }));
    // Get nodes by type
    server.get('/workflows/:workflowId/nodes/by-type/:nodeType', paginatedRoute(async (request, reply) => {
        const { workflowId, nodeType } = request.params;
        const paginator = new WorkflowNodePaginator(sampleNodes);
        const result = paginator.getNodesByType(nodeType, request.pagination);
        return {
            data: result.data,
            total: result.meta.total,
        };
    }));
    // Get nodes with errors
    server.get('/workflows/:workflowId/nodes/errors', paginatedRoute(async (request, reply) => {
        const { workflowId } = request.params;
        const paginator = new WorkflowNodePaginator(sampleNodes);
        const result = paginator.getNodesWithErrors(request.pagination);
        return {
            data: result.data,
            total: result.meta.total,
        };
    }));
    // Get slow nodes
    server.get('/workflows/:workflowId/nodes/slow', paginatedRoute(async (request, reply) => {
        const { workflowId } = request.params;
        const { threshold = '1000' } = request.query;
        const paginator = new WorkflowNodePaginator(sampleNodes);
        const result = paginator.getSlowNodes(parseInt(threshold), request.pagination);
        return {
            data: result.data,
            total: result.meta.total,
        };
    }));
    // Get workflow connections
    server.get('/workflows/:workflowId/connections', paginatedRoute(async (request, reply) => {
        const { workflowId } = request.params;
        const paginator = new WorkflowConnectionPaginator(sampleConnections);
        const result = paginator.getConnections(request.pagination);
        return {
            data: result.data,
            total: result.meta.total,
        };
    }));
    // Get operation batches
    server.get('/operations/batches', paginatedRoute(async (request, reply) => {
        const paginator = new OperationBatchPaginator(sampleBatches);
        const result = paginator.getBatches(request.pagination);
        return {
            data: result.data,
            total: result.meta.total,
        };
    }));
    // Get batches for specific workflow
    server.get('/workflows/:workflowId/operations', paginatedRoute(async (request, reply) => {
        const { workflowId } = request.params;
        const paginator = new OperationBatchPaginator(sampleBatches);
        const result = paginator.getWorkflowBatches(workflowId, request.pagination);
        return {
            data: result.data,
            total: result.meta.total,
        };
    }));
    // Stream large workflow data
    server.get('/workflows/:workflowId/stream', async (request, reply) => {
        const { workflowId } = request.params;
        const { format = 'ndjson' } = request.query;
        // Create async generator for streaming
        async function* nodeGenerator() {
            const nodes = await largeWorkflowManager.streamWorkflowNodes(workflowId);
            for await (const node of nodes) {
                yield node;
            }
        }
        if (format === 'csv') {
            // CSV format
            await streamLargeDataset(reply, nodeGenerator(), {
                contentType: 'text/csv',
                separator: '\n',
                transform: (node) => `${node.id},${node.name},${node.type},${node.position[0]},${node.position[1]}`,
            });
        }
        else {
            // NDJSON format (default)
            await streamLargeDataset(reply, nodeGenerator());
        }
    });
    // Analyze large workflow
    server.post('/workflows/:workflowId/analyze', async (request, reply) => {
        const { workflowId } = request.params;
        const results = await largeWorkflowManager.analyzeWorkflow(workflowId, [
            {
                name: 'nodeTypes',
                analyze: (nodes) => {
                    const types = {};
                    nodes.forEach(node => {
                        types[node.type] = (types[node.type] || 0) + 1;
                    });
                    return types;
                },
                reduce: (results) => {
                    const combined = {};
                    results.forEach(r => {
                        Object.entries(r).forEach(([type, count]) => {
                            combined[type] = (combined[type] || 0) + count;
                        });
                    });
                    return combined;
                },
            },
            {
                name: 'performance',
                analyze: (nodes) => {
                    const times = nodes
                        .filter(n => n.executionTime)
                        .map(n => n.executionTime);
                    if (times.length === 0)
                        return null;
                    return {
                        avg: times.reduce((a, b) => a + b, 0) / times.length,
                        max: Math.max(...times),
                        min: Math.min(...times),
                    };
                },
                reduce: (results) => {
                    const validResults = results.filter(r => r !== null);
                    if (validResults.length === 0)
                        return null;
                    return {
                        avg: validResults.reduce((a, b) => a + b.avg, 0) / validResults.length,
                        max: Math.max(...validResults.map(r => r.max)),
                        min: Math.min(...validResults.map(r => r.min)),
                    };
                },
            },
        ]);
        return results;
    });
    // Batch apply operations
    server.post('/workflows/:workflowId/batch-apply', async (request, reply) => {
        const { workflowId } = request.params;
        const operations = request.body;
        // Track progress
        const progressKey = `batch-${Date.now()}`;
        const progress = {};
        const result = await largeWorkflowManager.applyBatchOperations(workflowId, operations, {
            chunkSize: 50,
            validateChunk: true,
            onProgress: (p) => {
                progress[progressKey] = p;
                // Could emit SSE event here
            },
        });
        return {
            ...result,
            progressKey,
        };
    });
    // Get batch progress
    server.get('/batch-progress/:progressKey', async (request, reply) => {
        const { progressKey } = request.params;
        // In real implementation, fetch from cache/database
        return { progress: 100, completed: true };
    });
}
// Pagination examples endpoint
export async function registerPaginationExamples(server) {
    server.get('/pagination/examples', async (request, reply) => {
        return {
            examples: [
                {
                    description: 'Basic pagination',
                    url: '/workflows/workflow-1/nodes?page=1&limit=20',
                },
                {
                    description: 'Cursor-based pagination',
                    url: '/workflows/workflow-1/nodes?cursor=eyJpZCI6Im5vZGUtMTAiLCJ0aW1lc3RhbXAiOjE2MzkyNDE2MDB9',
                },
                {
                    description: 'Sorted pagination',
                    url: '/workflows/workflow-1/nodes?sortBy=executionTime&sortOrder=desc',
                },
                {
                    description: 'Filtered pagination',
                    url: '/workflows/workflow-1/nodes?filter={"type":"n8n-nodes-base.httpRequest"}',
                },
                {
                    description: 'Complex filter',
                    url: '/workflows/workflow-1/nodes?filter={"executionTime":{"$gt":500},"errorCount":{"$gt":0}}',
                },
                {
                    description: 'Stream large dataset',
                    url: '/workflows/workflow-1/stream?format=ndjson',
                },
            ],
        };
    });
}
