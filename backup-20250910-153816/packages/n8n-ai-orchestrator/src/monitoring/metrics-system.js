import { EventEmitter } from 'events';
export class Metric {
    options;
    series = new Map();
    history = [];
    eventEmitter = new EventEmitter();
    constructor(options) {
        this.options = options;
    }
    // Counter/Gauge increment
    inc(labelsOrValue, maybeValue) {
        const isGauge = this.options.type === 'gauge';
        const isCounter = this.options.type === 'counter';
        if (!isGauge && !isCounter) {
            throw new Error(`inc() can only be used with counter or gauge metrics`);
        }
        const labels = typeof labelsOrValue === 'object' ? labelsOrValue : undefined;
        const value = typeof labelsOrValue === 'number' ? labelsOrValue : (maybeValue ?? 1);
        const key = this.getLabelKey(labels);
        const current = this.series.get(key) || { value: 0, labels };
        current.value += value;
        current.timestamp = Date.now();
        this.series.set(key, current);
        this.history.push({ ...current });
        this.eventEmitter.emit('metric:update', { ...current, labels: current.labels || {} });
    }
    // Gauge methods
    set(value, labels) {
        if (this.options.type !== 'gauge') {
            throw new Error(`set() can only be used with gauge metrics`);
        }
        const key = this.getLabelKey(labels);
        const metric = { value, labels, timestamp: Date.now() };
        this.series.set(key, metric);
        this.history.push({ ...metric });
        this.eventEmitter.emit('metric:update', { ...metric, labels: metric.labels || {} });
    }
    // Gauge decrement helper
    dec(value = 1) {
        if (this.options.type !== 'gauge') {
            throw new Error(`dec() can only be used with gauge metrics`);
        }
        const current = this.series.get('default') || { value: 0 };
        this.set((current.value || 0) - value);
    }
    setToCurrentTime() {
        if (this.options.type !== 'gauge') {
            throw new Error(`setToCurrentTime() can only be used with gauge metrics`);
        }
        this.set(Date.now() / 1000);
    }
    // Histogram methods
    observe(value, labels) {
        if (this.options.type !== 'histogram' && this.options.type !== 'summary') {
            throw new Error(`observe() can only be used with histogram or summary metrics`);
        }
        const key = this.getLabelKey(labels);
        const metric = { value, labels, timestamp: Date.now() };
        this.history.push({ ...metric });
        this.eventEmitter.emit('metric:update', { ...metric, labels: metric.labels || {} });
    }
    // Timer helper
    startTimer(labels) {
        const start = process.hrtime.bigint();
        return () => {
            const end = process.hrtime.bigint();
            const duration = Number(end - start) / 1e9; // seconds
            this.observe(duration, labels);
            return duration;
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
            snapshot.values = Array.from(this.series.values()).map(v => ({
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
        this.series.clear();
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
            if (sorted.length === 0) {
                result[`p${p * 100}`] = 0;
                continue;
            }
            const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1));
            result[`p${p * 100}`] = sorted[index] || 0;
        }
        return result;
    }
    value(labels) {
        const key = this.getLabelKey(labels);
        const current = this.series.get(key);
        if (current)
            return current.value;
        if (this.options.type === 'histogram' || this.options.type === 'summary') {
            const snap = this.getSnapshot();
            return snap.metadata?.sum ?? 0;
        }
        return 0;
    }
    values() {
        if (this.options.type === 'counter' || this.options.type === 'gauge') {
            const out = new Map();
            for (const [k, v] of this.series.entries())
                out.set(k, v.value);
            return out;
        }
        // For summary/histogram return list of values (optionally windowed)
        const now = Date.now();
        let list = this.history;
        if (this.options.type === 'summary' && this.options.summaryWindow) {
            const maxAge = this.options.summaryWindow.maxAge;
            list = this.history.filter(h => (now - (h.timestamp || now)) <= maxAge);
        }
        return list.map(h => h.value);
    }
    buckets() {
        if (!this.options.buckets)
            return undefined;
        const edges = [...this.options.buckets].sort((a, b) => a - b);
        const counts = {};
        const values = this.history.map(h => h.value);
        for (const b of edges)
            counts[b] = values.filter(v => v <= b).length;
        counts['+Inf'] = values.length;
        return counts;
    }
    percentiles(pcts) {
        const sorted = this.history.map(h => h.value).sort((a, b) => a - b);
        const res = {};
        const list = pcts && pcts.length ? pcts : (this.options.percentiles || [0.5, 0.9, 0.95, 0.99]);
        for (const p of list) {
            const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1));
            res[p] = sorted[idx] ?? 0;
        }
        return res;
    }
    // Alias for summaries
    quantiles(pcts) {
        return this.percentiles(pcts);
    }
    sum() {
        if (this.options.type === 'histogram' || this.options.type === 'summary') {
            const snap = this.getSnapshot();
            return snap.metadata?.sum ?? 0;
        }
        return this.value();
    }
    count() {
        if (this.options.type === 'histogram' || this.options.type === 'summary') {
            const snap = this.getSnapshot();
            return snap.metadata?.count ?? 0;
        }
        let total = 0;
        for (const v of this.series.values())
            total += v.value;
        return total;
    }
    mean() {
        if (this.options.type === 'histogram' || this.options.type === 'summary') {
            const snap = this.getSnapshot();
            const c = snap.metadata?.count ?? 0;
            if (!c)
                return 0;
            return (snap.metadata?.sum ?? 0) / c;
        }
        return this.value();
    }
}
export class MetricsRegistry {
    metrics = new Map();
    defaultLabels = {};
    emitter = new EventEmitter();
    setDefaultLabels(labels) {
        this.defaultLabels = { ...labels };
    }
    on(event, listener) {
        this.emitter.on(event, listener);
    }
    register(options) {
        if (this.metrics.has(options.name)) {
            throw new Error(`Metric ${options.name} already exists`);
        }
        const metric = new Metric(options);
        // Forward metric updates
        metric.on('metric:update', (v) => this.emitter.emit('metric:update', { name: options.name, type: options.type, value: v.value, labels: v.labels, timestamp: v.timestamp }));
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
    summary(name, help, labelNames, percentilesOrWindow) {
        const opts = {
            name,
            help,
            type: 'summary',
            labelNames,
            percentiles: Array.isArray(percentilesOrWindow) ? percentilesOrWindow : [0.5, 0.9, 0.95, 0.99],
        };
        if (percentilesOrWindow && !Array.isArray(percentilesOrWindow)) {
            opts.summaryWindow = { maxAge: percentilesOrWindow.maxAge, ageBuckets: percentilesOrWindow.ageBuckets };
        }
        return this.register(opts);
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
    collect() {
        const metrics = [];
        for (const metric of this.metrics.values()) {
            const snap = metric.getSnapshot();
            const entry = {
                name: snap.name,
                type: snap.type,
                help: snap.help,
                values: metric.values(),
            };
            if (snap.type === 'histogram' || snap.type === 'summary') {
                entry.sum = metric.sum();
                entry.count = metric.count();
                entry.mean = metric.mean();
                if (snap.type === 'histogram')
                    entry.buckets = metric.buckets();
            }
            metrics.push(entry);
        }
        return metrics;
    }
    toJSON() {
        const list = [];
        for (const metric of this.metrics.values()) {
            const snap = metric.getSnapshot();
            for (const v of snap.values) {
                list.push({ name: snap.name, type: snap.type, help: snap.help, value: v.value, labels: v.labels });
            }
        }
        return JSON.stringify({ metrics: list, timestamp: new Date().toISOString() });
    }
    getMetricNames() {
        return Array.from(this.metrics.keys());
    }
    clear() {
        this.metrics.clear();
    }
}
// Global registry
export const metricsRegistry = new MetricsRegistry();
