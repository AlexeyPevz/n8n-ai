import { appMetrics } from './app-metrics.js';
/**
 * Fastify plugin for automatic metrics collection
 */
export async function metricsPlugin(fastify, options) {
    // Add metrics context to request
    fastify.decorateRequest('metrics', null);
    // Pre-handler to start timing
    fastify.addHook('onRequest', async (request, reply) => {
        const metricsContext = {
            startTime: process.hrtime.bigint(),
            path: normalizePath(request.url),
            method: request.method,
        };
        request.metrics = metricsContext;
    });
    // Post-handler to record metrics
    fastify.addHook('onResponse', async (request, reply) => {
        const metricsContext = request.metrics;
        if (!metricsContext)
            return;
        const duration = Number(process.hrtime.bigint() - metricsContext.startTime) / 1e9; // Convert to seconds
        const statusCode = reply.statusCode.toString();
        const statusClass = statusCode[0] + 'xx';
        // Record metrics
        appMetrics.http.requestsTotal.inc({
            method: metricsContext.method,
            path: metricsContext.path,
            status: statusClass,
        });
        appMetrics.http.requestDuration.observe(duration, {
            method: metricsContext.method,
            path: metricsContext.path,
            status: statusClass,
        });
    });
    // Error handler
    fastify.setErrorHandler(async (error, request, reply) => {
        const metricsContext = request.metrics;
        // Record error metrics
        appMetrics.errors.unhandled.inc({
            error_type: error.name || 'UnknownError',
        });
        if (metricsContext) {
            appMetrics.http.requestsTotal.inc({
                method: metricsContext.method,
                path: metricsContext.path,
                status: '5xx',
            });
        }
        // Send error response
        reply.status(500).send({
            error: 'Internal Server Error',
            message: error.message,
        });
    });
}
/**
 * Normalize URL path for metrics
 */
function normalizePath(url) {
    // Remove query parameters
    const path = url.split('?')[0];
    // Replace IDs and dynamic segments
    return path
        .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id') // UUIDs
        .replace(/\/\d+/g, '/:id') // Numeric IDs
        .replace(/\/[a-zA-Z0-9_-]+\/batch$/, '/:id/batch') // Workflow IDs
        .replace(/\/graph\/[^\/]+/, '/graph/:id'); // Graph IDs
}
/**
 * Decorator for measuring async function execution
 */
export function measureAsync(metricName, labels) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            const timer = appMetrics.ai.planningDuration.startTimer(labels);
            try {
                const result = await originalMethod.apply(this, args);
                timer();
                return result;
            }
            catch (error) {
                timer();
                throw error;
            }
        };
        return descriptor;
    };
}
/**
 * Measure AI operations
 */
export function measureAIOperation(operation, complexity, provider) {
    const startTime = process.hrtime.bigint();
    return {
        success: (tokenUsage) => {
            const duration = Number(process.hrtime.bigint() - startTime) / 1e9;
            appMetrics.ai.planningRequests.inc({
                complexity: complexity || 'unknown',
                status: 'success',
                provider: provider || 'unknown',
            });
            appMetrics.ai.planningDuration.observe(duration, {
                complexity: complexity || 'unknown',
                provider: provider || 'unknown',
            });
            if (tokenUsage) {
                appMetrics.ai.tokenUsage.inc({ provider: provider || 'unknown', type: 'prompt' }, tokenUsage.prompt);
                appMetrics.ai.tokenUsage.inc({ provider: provider || 'unknown', type: 'completion' }, tokenUsage.completion);
            }
        },
        error: (error) => {
            const duration = Number(process.hrtime.bigint() - startTime) / 1e9;
            appMetrics.ai.planningRequests.inc({
                complexity: complexity || 'unknown',
                status: 'error',
                provider: provider || 'unknown',
            });
            appMetrics.ai.planningDuration.observe(duration, {
                complexity: complexity || 'unknown',
                provider: provider || 'unknown',
            });
            appMetrics.ai.planningErrors.inc({
                provider: provider || 'unknown',
                error_type: error.name || 'UnknownError',
            });
        },
    };
}
/**
 * Measure graph operations
 */
export function measureGraphOperation(operation) {
    const startTime = process.hrtime.bigint();
    return {
        success: () => {
            const duration = Number(process.hrtime.bigint() - startTime) / 1e9;
            appMetrics.graph.operations.inc({
                operation,
                status: 'success',
            });
            appMetrics.graph.operationDuration.observe(duration, { operation });
        },
        error: () => {
            const duration = Number(process.hrtime.bigint() - startTime) / 1e9;
            appMetrics.graph.operations.inc({
                operation,
                status: 'error',
            });
            appMetrics.graph.operationDuration.observe(duration, { operation });
        },
    };
}
/**
 * Measure validation operations
 */
export function measureValidation() {
    const startTime = process.hrtime.bigint();
    return {
        complete: (errorCount, errors) => {
            const duration = Number(process.hrtime.bigint() - startTime) / 1e9;
            appMetrics.validation.requests.inc({
                status: errorCount > 0 ? 'errors_found' : 'success',
            });
            appMetrics.validation.duration.observe(duration);
            if (errors) {
                for (const error of errors) {
                    appMetrics.validation.errors.inc({
                        error_type: error.type,
                        severity: error.severity,
                    });
                }
            }
        },
    };
}
/**
 * Measure RAG operations
 */
export function measureRAGSearch() {
    const startTime = process.hrtime.bigint();
    return {
        complete: (resultCount) => {
            const duration = Number(process.hrtime.bigint() - startTime) / 1e9;
            appMetrics.rag.searchRequests.inc({ status: 'success' });
            appMetrics.rag.searchDuration.observe(duration);
            appMetrics.rag.searchResults.observe(resultCount);
        },
        error: () => {
            const duration = Number(process.hrtime.bigint() - startTime) / 1e9;
            appMetrics.rag.searchRequests.inc({ status: 'error' });
            appMetrics.rag.searchDuration.observe(duration);
        },
    };
}
/**
 * Measure cache operations
 */
export function measureCache(cacheType) {
    return {
        hit: () => {
            appMetrics.cache.hits.inc({ cache_type: cacheType });
        },
        miss: () => {
            appMetrics.cache.misses.inc({ cache_type: cacheType });
        },
        updateSize: (bytes) => {
            appMetrics.cache.size.set(bytes, { cache_type: cacheType });
        },
    };
}
/**
 * Record audit event
 */
export function recordAuditEvent(eventType, userId) {
    appMetrics.audit.events.inc({
        event_type: eventType,
        user_id: userId || 'anonymous',
    });
}
