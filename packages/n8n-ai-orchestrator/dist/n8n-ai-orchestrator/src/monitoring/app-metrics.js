import { metricsRegistry } from './metrics-system.js';
// Re-export metricsRegistry for other modules
export { metricsRegistry };
// HTTP metrics
export const httpRequestsTotal = metricsRegistry.counter('n8n_ai_http_requests_total', 'Total number of HTTP requests', ['method', 'path', 'status']);
export const httpRequestDuration = metricsRegistry.histogram('n8n_ai_http_request_duration_seconds', 'HTTP request duration in seconds', ['method', 'path', 'status'], [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5]);
// AI Planning metrics
export const aiPlanningRequests = metricsRegistry.counter('n8n_ai_planning_requests_total', 'Total number of AI planning requests', ['complexity', 'status', 'provider']);
export const aiPlanningDuration = metricsRegistry.histogram('n8n_ai_planning_duration_seconds', 'AI planning request duration in seconds', ['complexity', 'provider']);
export const aiTokenUsage = metricsRegistry.counter('n8n_ai_token_usage_total', 'Total number of AI tokens used', ['provider', 'type'] // type: prompt, completion
);
export const aiPlanningErrors = metricsRegistry.counter('n8n_ai_planning_errors_total', 'Total number of AI planning errors', ['provider', 'error_type']);
// Graph operations metrics
export const graphOperations = metricsRegistry.counter('n8n_ai_graph_operations_total', 'Total number of graph operations', ['operation', 'status']);
export const graphOperationDuration = metricsRegistry.histogram('n8n_ai_graph_operation_duration_seconds', 'Graph operation duration in seconds', ['operation']);
export const workflowSize = metricsRegistry.gauge('n8n_ai_workflow_size', 'Current workflow size (number of nodes)', ['workflow_id']);
// Validation metrics
export const validationRequests = metricsRegistry.counter('n8n_ai_validation_requests_total', 'Total number of validation requests', ['status']);
export const validationErrors = metricsRegistry.counter('n8n_ai_validation_errors_total', 'Total number of validation errors found', ['error_type', 'severity']);
export const validationDuration = metricsRegistry.histogram('n8n_ai_validation_duration_seconds', 'Validation duration in seconds');
// RAG metrics
export const ragSearchRequests = metricsRegistry.counter('n8n_ai_rag_search_requests_total', 'Total number of RAG search requests', ['status']);
export const ragSearchDuration = metricsRegistry.histogram('n8n_ai_rag_search_duration_seconds', 'RAG search duration in seconds');
export const ragDocumentCount = metricsRegistry.gauge('n8n_ai_rag_document_count', 'Number of documents in RAG system', ['type', 'source']);
export const ragSearchResults = metricsRegistry.histogram('n8n_ai_rag_search_results_count', 'Number of results returned by RAG search', [], [0, 1, 2, 3, 5, 10, 20]);
// Cache metrics
export const cacheHits = metricsRegistry.counter('n8n_ai_cache_hits_total', 'Total number of cache hits', ['cache_type']);
export const cacheMisses = metricsRegistry.counter('n8n_ai_cache_misses_total', 'Total number of cache misses', ['cache_type']);
export const cacheSize = metricsRegistry.gauge('n8n_ai_cache_size_bytes', 'Current cache size in bytes', ['cache_type']);
// System metrics
export const systemMemoryUsage = metricsRegistry.gauge('n8n_ai_memory_usage_bytes', 'Memory usage in bytes', ['type'] // heap, rss, external
);
export const systemCpuUsage = metricsRegistry.gauge('n8n_ai_cpu_usage_percent', 'CPU usage percentage');
export const systemUptime = metricsRegistry.gauge('n8n_ai_uptime_seconds', 'System uptime in seconds');
// Error metrics
export const unhandledErrors = metricsRegistry.counter('n8n_ai_unhandled_errors_total', 'Total number of unhandled errors', ['error_type']);
// Audit metrics
export const auditEvents = metricsRegistry.counter('n8n_ai_audit_events_total', 'Total number of audit events', ['event_type', 'user_id']);
// Helper function to collect system metrics
export function collectSystemMetrics() {
    const memoryUsage = process.memoryUsage();
    systemMemoryUsage.set(memoryUsage.heapUsed, { type: 'heap' });
    systemMemoryUsage.set(memoryUsage.rss, { type: 'rss' });
    systemMemoryUsage.set(memoryUsage.external, { type: 'external' });
    systemUptime.set(process.uptime());
    // CPU usage (simplified - in production use proper CPU monitoring)
    const cpuUsage = process.cpuUsage();
    const totalCpu = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
    const cpuPercent = (totalCpu / process.uptime()) * 100;
    systemCpuUsage.set(cpuPercent);
}
// Start collecting system metrics every 10 seconds
setInterval(collectSystemMetrics, 10000);
collectSystemMetrics(); // Initial collection
// Export all metrics for easy access
export const appMetrics = {
    http: {
        requestsTotal: httpRequestsTotal,
        requestDuration: httpRequestDuration,
    },
    ai: {
        planningRequests: aiPlanningRequests,
        planningDuration: aiPlanningDuration,
        tokenUsage: aiTokenUsage,
        planningErrors: aiPlanningErrors,
    },
    graph: {
        operations: graphOperations,
        operationDuration: graphOperationDuration,
        workflowSize,
    },
    validation: {
        requests: validationRequests,
        errors: validationErrors,
        duration: validationDuration,
    },
    rag: {
        searchRequests: ragSearchRequests,
        searchDuration: ragSearchDuration,
        documentCount: ragDocumentCount,
        searchResults: ragSearchResults,
    },
    cache: {
        hits: cacheHits,
        misses: cacheMisses,
        size: cacheSize,
    },
    system: {
        memoryUsage: systemMemoryUsage,
        cpuUsage: systemCpuUsage,
        uptime: systemUptime,
    },
    errors: {
        unhandled: unhandledErrors,
    },
    audit: {
        events: auditEvents,
    },
};
