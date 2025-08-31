import { describe, it, expect } from 'vitest';
import { hooksMetrics, HOOKS_METRIC } from '../metrics.js';

describe('hooks metrics', () => {
  it('renders JSON and Prometheus outputs', () => {
    hooksMetrics.increment(HOOKS_METRIC.API_REQUESTS, { path: '/api/v1/ai/health', status: '200' });
    hooksMetrics.recordDuration(HOOKS_METRIC.API_DURATION, 15, { path: '/api/v1/ai/health' });
    hooksMetrics.recordDuration(HOOKS_METRIC.API_DURATION, 25, { path: '/api/v1/ai/health' });

    const json = hooksMetrics.getJSON();
    expect(Object.keys(json.counters).length).toBeGreaterThan(0);
    expect(Object.keys(json.histograms).length).toBeGreaterThan(0);
    const prom = hooksMetrics.getPrometheus();
    expect(prom).toContain('hooks_api_requests_total');
    expect(prom).toContain('hooks_api_request_duration_ms_p95');
  });
});

