type LabelMap = Record<string, string>;
declare class MetricsCollector {
    private counters;
    private histograms;
    increment(name: string, labels?: LabelMap): void;
    recordDuration(name: string, durationMs: number, labels?: LabelMap): void;
    getJSON(): {
        counters: Record<string, number>;
        histograms: Record<string, {
            count: number;
            min: number;
            max: number;
            p50: number;
            p95: number;
            p99: number;
        }>;
    };
    getPrometheus(): string;
    private key;
    private parseKey;
    private labelsToString;
}
export declare const hooksMetrics: MetricsCollector;
export declare const HOOKS_METRIC: {
    readonly API_REQUESTS: "hooks_api_requests_total";
    readonly API_DURATION: "hooks_api_request_duration_ms";
};
export {};
//# sourceMappingURL=metrics.d.ts.map