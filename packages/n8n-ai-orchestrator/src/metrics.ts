/**
 * Простая система метрик
 */

interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  labels?: Record<string, string>;
}

class MetricsCollector {
  private metrics: Metric[] = [];
  private counters: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  increment(name: string, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + 1);
  }

  recordDuration(name: string, duration: number, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    if (!this.histograms.has(key)) {
      this.histograms.set(key, []);
    }
    this.histograms.get(key)!.push(duration);
  }

  async measureAsync<T>(
    name: string, 
    fn: () => Promise<T>, 
    labels?: Record<string, string>
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      this.recordDuration(name, Date.now() - start, { ...labels, status: 'success' });
      return result;
    } catch (error) {
      this.recordDuration(name, Date.now() - start, { ...labels, status: 'error' });
      throw error;
    }
  }

  getMetrics(): { counters: Record<string, number>; histograms: Record<string, { count: number; min: number; max: number; p50: number; p95: number; p99: number }> } {
    const metrics: { counters: Record<string, number>; histograms: Record<string, { count: number; min: number; max: number; p50: number; p95: number; p99: number }> } = {
      counters: {},
      histograms: {}
    };

    // Counters
    for (const [key, value] of this.counters) {
      metrics.counters[key] = value;
    }

    // Histograms (calculate p50, p95, p99)
    for (const [key, values] of this.histograms) {
      if (values.length === 0) continue;
      
      const sorted = [...values].sort((a, b) => a - b);
      metrics.histograms[key] = {
        count: sorted.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)]
      };
    }

    return metrics;
  }

  reset(): void {
    this.metrics = [];
    this.counters.clear();
    this.histograms.clear();
  }

  private getKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}{${labelStr}}`;
  }
}

export const metrics = new MetricsCollector();

// Предопределенные метрики
export const METRICS = {
  API_REQUESTS: 'api_requests_total',
  API_DURATION: 'api_request_duration_ms',
  PLAN_OPERATIONS: 'plan_operations_total',
  GRAPH_OPERATIONS: 'graph_operations_total',
  VALIDATION_ERRORS: 'validation_errors_total',
  INTEGRATION_ERRORS: 'integration_errors_total'
} as const;