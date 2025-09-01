import { metricsRegistry } from './metrics-system.js';
export class MetricsDashboard {
    historicalData = [];
    maxHistorySize = 1000;
    /**
     * Get current dashboard metrics
     */
    getCurrentMetrics() {
        const allMetrics = metricsRegistry.getAllMetrics();
        const metrics = {
            overview: this.getOverviewMetrics(allMetrics),
            ai: this.getAIMetrics(allMetrics),
            performance: this.getPerformanceMetrics(allMetrics),
            operations: this.getOperationsMetrics(allMetrics),
            rag: this.getRAGMetrics(allMetrics),
            cache: this.getCacheMetrics(allMetrics),
        };
        // Store in history
        this.historicalData.push({
            timestamp: Date.now(),
            metrics: JSON.parse(JSON.stringify(metrics)), // Deep clone
        });
        // Trim history
        if (this.historicalData.length > this.maxHistorySize) {
            this.historicalData = this.historicalData.slice(-this.maxHistorySize);
        }
        return metrics;
    }
    /**
     * Get historical metrics
     */
    getHistoricalMetrics(startTime, endTime) {
        return this.historicalData.filter(item => {
            if (startTime && item.timestamp < startTime)
                return false;
            if (endTime && item.timestamp > endTime)
                return false;
            return true;
        });
    }
    /**
     * Get metrics for specific time range
     */
    getMetricsForRange(range) {
        const now = Date.now();
        const ranges = {
            '1h': 60 * 60 * 1000,
            '6h': 6 * 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000,
        };
        const rangeMs = ranges[range];
        const startTime = now - rangeMs;
        const current = this.getCurrentMetrics();
        const historical = this.getHistoricalMetrics(startTime, now);
        // Calculate comparison with previous period
        const previousStartTime = startTime - rangeMs;
        const previousEndTime = startTime;
        const previousPeriod = this.getHistoricalMetrics(previousStartTime, previousEndTime);
        let comparison;
        if (previousPeriod.length > 0) {
            const prevAvgRequests = previousPeriod.reduce((sum, item) => sum + item.metrics.overview.totalRequests, 0) / previousPeriod.length;
            const prevAvgErrorRate = previousPeriod.reduce((sum, item) => sum + item.metrics.overview.errorRate, 0) / previousPeriod.length;
            const prevAvgResponseTime = previousPeriod.reduce((sum, item) => sum + item.metrics.overview.avgResponseTime, 0) / previousPeriod.length;
            comparison = {
                requestsChange: ((current.overview.totalRequests - prevAvgRequests) / prevAvgRequests) * 100,
                errorRateChange: current.overview.errorRate - prevAvgErrorRate,
                responseTimeChange: ((current.overview.avgResponseTime - prevAvgResponseTime) / prevAvgResponseTime) * 100,
            };
        }
        return { current, historical, comparison };
    }
    getOverviewMetrics(allMetrics) {
        const httpRequests = this.findMetric(allMetrics, 'n8n_ai_http_requests_total');
        const httpDuration = this.findMetric(allMetrics, 'n8n_ai_http_request_duration_seconds');
        const uptime = this.findMetric(allMetrics, 'n8n_ai_uptime_seconds');
        const workflowSize = this.findMetric(allMetrics, 'n8n_ai_workflow_size');
        const totalRequests = this.sumValues(httpRequests);
        const totalErrors = this.sumValues(httpRequests, { status: '5xx' });
        const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
        return {
            uptime: uptime?.values[0]?.value || 0,
            totalRequests,
            errorRate,
            avgResponseTime: this.getAverageFromHistogram(httpDuration),
            activeWorkflows: workflowSize?.values.length || 0,
        };
    }
    getAIMetrics(allMetrics) {
        const planningRequests = this.findMetric(allMetrics, 'n8n_ai_planning_requests_total');
        const planningDuration = this.findMetric(allMetrics, 'n8n_ai_planning_duration_seconds');
        const tokenUsage = this.findMetric(allMetrics, 'n8n_ai_token_usage_total');
        const totalPlanning = this.sumValues(planningRequests);
        const successfulPlanning = this.sumValues(planningRequests, { status: 'success' });
        const tokensByProvider = {};
        if (tokenUsage) {
            for (const value of tokenUsage.values) {
                const provider = value.labels.provider || 'unknown';
                tokensByProvider[provider] = (tokensByProvider[provider] || 0) + value.value;
            }
        }
        const complexityBreakdown = {
            simple: this.sumValues(planningRequests, { complexity: 'simple' }),
            medium: this.sumValues(planningRequests, { complexity: 'medium' }),
            complex: this.sumValues(planningRequests, { complexity: 'complex' }),
        };
        return {
            totalPlanningRequests: totalPlanning,
            successRate: totalPlanning > 0 ? (successfulPlanning / totalPlanning) * 100 : 0,
            avgPlanningTime: this.getAverageFromHistogram(planningDuration),
            tokenUsage: {
                total: this.sumValues(tokenUsage),
                byProvider: tokensByProvider,
            },
            complexity: complexityBreakdown,
        };
    }
    getPerformanceMetrics(allMetrics) {
        const httpDuration = this.findMetric(allMetrics, 'n8n_ai_http_request_duration_seconds');
        const memoryUsage = this.findMetric(allMetrics, 'n8n_ai_memory_usage_bytes');
        const cpuUsage = this.findMetric(allMetrics, 'n8n_ai_cpu_usage_percent');
        const percentiles = this.getPercentilesFromHistogram(httpDuration);
        const requestsPerSecond = this.calculateRequestsPerSecond();
        return {
            requestsPerSecond,
            p50ResponseTime: percentiles.p50 * 1000, // Convert to ms
            p95ResponseTime: percentiles.p95 * 1000,
            p99ResponseTime: percentiles.p99 * 1000,
            memoryUsage: {
                heap: this.findValueByLabel(memoryUsage, { type: 'heap' }) || 0,
                rss: this.findValueByLabel(memoryUsage, { type: 'rss' }) || 0,
            },
            cpuUsage: cpuUsage?.values[0]?.value || 0,
        };
    }
    getOperationsMetrics(allMetrics) {
        const graphOps = this.findMetric(allMetrics, 'n8n_ai_graph_operations_total');
        const validationReqs = this.findMetric(allMetrics, 'n8n_ai_validation_requests_total');
        const validationErrors = this.findMetric(allMetrics, 'n8n_ai_validation_errors_total');
        const graphOpsByType = {};
        if (graphOps) {
            for (const value of graphOps.values) {
                const op = value.labels.operation || 'unknown';
                graphOpsByType[op] = (graphOpsByType[op] || 0) + value.value;
            }
        }
        const errorTypeBreakdown = {};
        if (validationErrors) {
            for (const value of validationErrors.values) {
                const errorType = value.labels.error_type || 'unknown';
                errorTypeBreakdown[errorType] = (errorTypeBreakdown[errorType] || 0) + value.value;
            }
        }
        return {
            graphOperations: {
                total: this.sumValues(graphOps),
                byType: graphOpsByType,
            },
            validations: {
                total: this.sumValues(validationReqs),
                withErrors: this.sumValues(validationReqs, { status: 'errors_found' }),
                errorTypes: errorTypeBreakdown,
            },
        };
    }
    getRAGMetrics(allMetrics) {
        const searches = this.findMetric(allMetrics, 'n8n_ai_rag_search_requests_total');
        const searchDuration = this.findMetric(allMetrics, 'n8n_ai_rag_search_duration_seconds');
        const searchResults = this.findMetric(allMetrics, 'n8n_ai_rag_search_results_count');
        const documentCount = this.findMetric(allMetrics, 'n8n_ai_rag_document_count');
        return {
            searches: this.sumValues(searches),
            avgSearchTime: this.getAverageFromHistogram(searchDuration) * 1000, // Convert to ms
            avgResultCount: this.getAverageFromHistogram(searchResults),
            documentCount: this.sumValues(documentCount),
        };
    }
    getCacheMetrics(allMetrics) {
        const hits = this.findMetric(allMetrics, 'n8n_ai_cache_hits_total');
        const misses = this.findMetric(allMetrics, 'n8n_ai_cache_misses_total');
        const size = this.findMetric(allMetrics, 'n8n_ai_cache_size_bytes');
        const totalHits = this.sumValues(hits);
        const totalMisses = this.sumValues(misses);
        const totalRequests = totalHits + totalMisses;
        const sizeByType = {};
        if (size) {
            for (const value of size.values) {
                const cacheType = value.labels.cache_type || 'unknown';
                sizeByType[cacheType] = value.value;
            }
        }
        return {
            hitRate: totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0,
            size: sizeByType,
        };
    }
    // Helper methods
    findMetric(allMetrics, name) {
        return allMetrics.find(m => m.name === name);
    }
    sumValues(metric, labelFilter) {
        if (!metric || !metric.values)
            return 0;
        return metric.values
            .filter((v) => {
            if (!labelFilter)
                return true;
            return Object.entries(labelFilter).every(([key, value]) => v.labels[key] === value);
        })
            .reduce((sum, v) => sum + v.value, 0);
    }
    findValueByLabel(metric, labels) {
        if (!metric || !metric.values)
            return null;
        const value = metric.values.find((v) => Object.entries(labels).every(([key, value]) => v.labels[key] === value));
        return value ? value.value : null;
    }
    getAverageFromHistogram(metric) {
        if (!metric || !metric.metadata)
            return 0;
        const metadata = metric.metadata;
        return metadata.sum && metadata.count ? metadata.sum / metadata.count : 0;
    }
    getPercentilesFromHistogram(metric) {
        if (!metric || !metric.metadata || !metric.metadata.percentiles) {
            return { p50: 0, p95: 0, p99: 0 };
        }
        return metric.metadata.percentiles;
    }
    calculateRequestsPerSecond() {
        if (this.historicalData.length < 2)
            return 0;
        const recentData = this.historicalData.slice(-10); // Last 10 data points
        if (recentData.length < 2)
            return 0;
        const firstPoint = recentData[0];
        const lastPoint = recentData[recentData.length - 1];
        const timeDiffSeconds = (lastPoint.timestamp - firstPoint.timestamp) / 1000;
        const requestDiff = lastPoint.metrics.overview.totalRequests - firstPoint.metrics.overview.totalRequests;
        return timeDiffSeconds > 0 ? requestDiff / timeDiffSeconds : 0;
    }
}
// Global dashboard instance
export const metricsDashboard = new MetricsDashboard();
