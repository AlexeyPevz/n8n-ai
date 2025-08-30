/**
 * Метрики для hooks (JSON + Prometheus)
 */

type LabelMap = Record<string, string>;

class MetricsCollector {
  private counters: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  increment(name: string, labels?: LabelMap): void {
    const key = this.key(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + 1);
  }

  recordDuration(name: string, durationMs: number, labels?: LabelMap): void {
    const key = this.key(name, labels);
    const arr = this.histograms.get(key) ?? [];
    arr.push(durationMs);
    this.histograms.set(key, arr);
  }

  getJSON(): { counters: Record<string, number>; histograms: Record<string, { count: number; min: number; max: number; p50: number; p95: number; p99: number }> } {
    const json: { counters: Record<string, number>; histograms: Record<string, { count: number; min: number; max: number; p50: number; p95: number; p99: number }> } = {
      counters: {},
      histograms: {}
    };
    for (const [k, v] of this.counters) json.counters[k] = v;
    for (const [k, arr] of this.histograms) {
      if (arr.length === 0) continue;
      const sorted = [...arr].sort((a, b) => a - b);
      const idx = (q: number) => sorted[Math.floor(sorted.length * q)] ?? sorted[sorted.length - 1];
      json.histograms[k] = {
        count: sorted.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        p50: idx(0.5),
        p95: idx(0.95),
        p99: idx(0.99),
      };
    }
    return json;
  }

  getPrometheus(): string {
    const lines: string[] = [];
    // Counters
    for (const [k, v] of this.counters) {
      const { name, labels } = this.parseKey(k);
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name}${this.labelsToString(labels)} ${v}`);
    }
    // Gauges for hist quantiles
    for (const [k, arr] of this.histograms) {
      if (arr.length === 0) continue;
      const sorted = [...arr].sort((a, b) => a - b);
      const idx = (q: number) => sorted[Math.floor(sorted.length * q)] ?? sorted[sorted.length - 1];
      const { name, labels } = this.parseKey(k);
      const base = `${name}`;
      lines.push(`# TYPE ${base}_count gauge`);
      lines.push(`${base}_count${this.labelsToString(labels)} ${sorted.length}`);
      lines.push(`# TYPE ${base}_p50 gauge`);
      lines.push(`${base}_p50${this.labelsToString(labels)} ${idx(0.5)}`);
      lines.push(`# TYPE ${base}_p95 gauge`);
      lines.push(`${base}_p95${this.labelsToString(labels)} ${idx(0.95)}`);
      lines.push(`# TYPE ${base}_p99 gauge`);
      lines.push(`${base}_p99${this.labelsToString(labels)} ${idx(0.99)}`);
    }
    return lines.join('\n') + '\n';
  }

  private key(name: string, labels?: LabelMap): string {
    if (!labels || Object.keys(labels).length === 0) return name;
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}{${labelStr}}`;
  }

  private parseKey(key: string): { name: string; labels: LabelMap } {
    const match = key.match(/^(.*?)\{(.*)\}$/);
    if (!match) return { name: key, labels: {} };
    const [, name, labelStr] = match;
    const labels: LabelMap = {};
    if (labelStr) {
      for (const pair of labelStr.split(',')) {
        const [k, v] = pair.split('=');
        if (k && v) labels[k] = v;
      }
    }
    return { name, labels };
  }

  private labelsToString(labels: LabelMap): string {
    const entries = Object.entries(labels);
    if (entries.length === 0) return '';
    const enc = entries.map(([k, v]) => `${k}="${v.replace(/"/g, '\\"')}"`).join(',');
    return `{${enc}}`;
  }
}

export const hooksMetrics = new MetricsCollector();
export const HOOKS_METRIC = {
  API_REQUESTS: 'hooks_api_requests_total',
  API_DURATION: 'hooks_api_request_duration_ms',
} as const;

