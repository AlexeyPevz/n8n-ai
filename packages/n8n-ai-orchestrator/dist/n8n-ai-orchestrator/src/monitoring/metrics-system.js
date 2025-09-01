import { EventEmitter } from 'events';
export class Metric {
    options;
    values = new Map();
    history = [];
    eventEmitter = new EventEmitter();
    constructor(options) {
        this.options = options;
    }
    // Counter methods
    inc(labels, value = 1) {
        if (this.options.type !== 'counter') {
            throw new Error(`inc() can only be used with counter metrics`);
        }
        const key = this.getLabelKey(labels);
        const current = this.values.get(key) || { value: 0, labels };
        current.value += value;
        current.timestamp = Date.now();
        this.values.set(key, current);
        this.history.push({ ...current });
        this.eventEmitter.emit('update', current);
    }
    // Gauge methods
    set(value, labels) {
        if (this.options.type !== 'gauge') {
            throw new Error(`set() can only be used with gauge metrics`);
        }
        const key = this.getLabelKey(labels);
        const metric = { value, labels, timestamp: Date.now() };
        this.values.set(key, metric);
        this.history.push({ ...metric });
        this.eventEmitter.emit('update', metric);
    }
    // Histogram methods
    observe(value, labels) {
        if (this.options.type !== 'histogram' && this.options.type !== 'summary') {
            throw new Error(`observe() can only be used with histogram or summary metrics`);
        }
        const key = this.getLabelKey(labels);
        const metric = { value, labels, timestamp: Date.now() };
        this.history.push({ ...metric });
        this.eventEmitter.emit('update', metric);
    }
    // Timer helper
    startTimer(labels) {
        const start = process.hrtime.bigint();
        return () => {
            const end = process.hrtime.bigint();
            const duration = Number(end - start) / 1e6; // Convert to milliseconds
            this.observe(duration, labels);
        };
    }
    // Get current values
    getSnapshot() {
        const snapshot = {
            name: this.options.name,
            help: this.options.help,
            type: this.options.type,
            values: [],
        };
        if (this.options.type === 'counter' || this.options.type === 'gauge') {
            snapshot.values = Array.from(this.values.values()).map(v => ({
                value: v.value,
                labels: v.labels || {},
                timestamp: v.timestamp || Date.now(),
            }));
        }
        else if (this.options.type === 'histogram' || this.options.type === 'summary') {
            // Group by label combinations
            const groups = new Map();
            for (const value of this.history) {
                const key = this.getLabelKey(value.labels);
                if (!groups.has(key)) {
                    groups.set(key, []);
                }
                groups.get(key).push(value);
            }
            // Calculate statistics for each group
            for (const [key, values] of groups) {
                const sorted = values.map(v => v.value).sort((a, b) => a - b);
                const sum = sorted.reduce((a, b) => a + b, 0);
                const labels = values[0].labels || {};
                snapshot.values.push({
                    value: sum / sorted.length, // Average
                    labels,
                    timestamp: Date.now(),
                });
                snapshot.metadata = {
                    count: sorted.length,
                    sum,
                    min: sorted[0],
                    max: sorted[sorted.length - 1],
                    buckets: this.options.buckets,
                    percentiles: this.calculatePercentiles(sorted),
                };
            }
        }
        return snapshot;
    }
    // Subscribe to updates
    on(event, listener) {
        this.eventEmitter.on(event, listener);
    }
    // Reset metric
    reset() {
        this.values.clear();
        this.history = [];
    }
    getLabelKey(labels) {
        if (!labels || Object.keys(labels).length === 0) {
            return 'default';
        }
        return Object.entries(labels)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}="${v}"`)
            .join(',');
    }
    calculatePercentiles(sorted) {
        const percentiles = this.options.percentiles || [0.5, 0.9, 0.95, 0.99];
        const result = {};
        for (const p of percentiles) {
            const index = Math.floor(sorted.length * p);
            result[`p${p * 100}`] = sorted[index] || 0;
        }
        return result;
    }
}
export class MetricsRegistry {
    metrics = new Map();
    defaultLabels = {};
    setDefaultLabels(labels) {
        this.defaultLabels = { ...labels };
    }
    register(options) {
        if (this.metrics.has(options.name)) {
            throw new Error(`Metric ${options.name} is already registered`);
        }
        const metric = new Metric(options);
        this.metrics.set(options.name, metric);
        return metric;
    }
    get(name) {
        return this.metrics.get(name);
    }
    counter(name, help, labelNames) {
        return this.register({
            name,
            help,
            type: 'counter',
            labelNames,
        });
    }
    gauge(name, help, labelNames) {
        return this.register({
            name,
            help,
            type: 'gauge',
            labelNames,
        });
    }
    histogram(name, help, labelNames, buckets) {
        return this.register({
            name,
            help,
            type: 'histogram',
            labelNames,
            buckets: buckets || [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
        });
    }
    summary(name, help, labelNames, percentiles) {
        return this.register({
            name,
            help,
            type: 'summary',
            labelNames,
            percentiles: percentiles || [0.5, 0.9, 0.95, 0.99],
        });
    }
    getAllMetrics() {
        const snapshots = [];
        for (const metric of this.metrics.values()) {
            snapshots.push(metric.getSnapshot());
        }
        return snapshots;
    }
    reset() {
        for (const metric of this.metrics.values()) {
            metric.reset();
        }
    }
    // Export in Prometheus format
    toPrometheus() {
        const lines = [];
        for (const metric of this.metrics.values()) {
            const snapshot = metric.getSnapshot();
            // Add help and type comments
            lines.push(`# HELP ${snapshot.name} ${snapshot.help}`);
            lines.push(`# TYPE ${snapshot.name} ${snapshot.type}`);
            // Add metric values
            for (const value of snapshot.values) {
                const labels = { ...this.defaultLabels, ...value.labels };
                const labelStr = Object.entries(labels)
                    .map(([k, v]) => `${k}="${v}"`)
                    .join(',');
                const metricLine = labelStr
                    ? `${snapshot.name}{${labelStr}} ${value.value}`
                    : `${snapshot.name} ${value.value}`;
                lines.push(metricLine);
            }
            // Add histogram/summary metadata
            if (snapshot.metadata && (snapshot.type === 'histogram' || snapshot.type === 'summary')) {
                const { count, sum, buckets, percentiles } = snapshot.metadata;
                if (count !== undefined) {
                    lines.push(`${snapshot.name}_count ${count}`);
                }
                if (sum !== undefined) {
                    lines.push(`${snapshot.name}_sum ${sum}`);
                }
                // Histogram buckets
                if (buckets && snapshot.type === 'histogram') {
                    // TODO: Implement bucket counting
                }
                // Summary percentiles
                if (percentiles && snapshot.type === 'summary') {
                    for (const [key, value] of Object.entries(percentiles)) {
                        const q = Number(key.slice(1)) / 100;
                        lines.push(`${snapshot.name}{quantile="${q}"} ${value}`);
                    }
                }
            }
            lines.push(''); // Empty line between metrics
        }
        return lines.join('\n');
    }
}
// Global registry
export const metricsRegistry = new MetricsRegistry();
