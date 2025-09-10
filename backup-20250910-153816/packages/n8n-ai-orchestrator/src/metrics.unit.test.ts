import { describe, it, expect, beforeEach } from 'vitest';
import { metrics, METRICS } from './metrics.js';

describe('metrics collector', () => {
  beforeEach(() => {
    metrics.reset();
  });

  it('increments counters and records durations with percentiles', async () => {
    metrics.increment(METRICS.API_REQUESTS, { endpoint: '/plan', method: 'POST', status: '200' });
    metrics.increment(METRICS.API_REQUESTS, { endpoint: '/plan', method: 'POST', status: '200' });
    metrics.increment(METRICS.API_REQUESTS, { endpoint: '/graph', method: 'POST', status: '400' });

    // record some synthetic durations
    metrics.recordDuration(METRICS.API_DURATION, 10, { endpoint: '/plan', method: 'POST' });
    metrics.recordDuration(METRICS.API_DURATION, 20, { endpoint: '/plan', method: 'POST' });
    metrics.recordDuration(METRICS.API_DURATION, 30, { endpoint: '/plan', method: 'POST' });

    // and via measureAsync helper (success + error path)
    await metrics.measureAsync(METRICS.API_DURATION, async () => {
      await new Promise((r) => setTimeout(r, 1));
      return 'ok';
    }, { endpoint: '/ok' });

    await expect(metrics.measureAsync(METRICS.API_DURATION, async () => {
      await new Promise((r) => setTimeout(r, 1));
      throw new Error('boom');
    }, { endpoint: '/err' })).rejects.toThrow('boom');

    const snapshot = metrics.getMetrics();
    // counters present
    const counterKeys = Object.keys(snapshot.counters);
    expect(counterKeys.some(k => k.startsWith('api_requests_total'))).toBe(true);

    // histograms present with quantiles
    const histKeys = Object.keys(snapshot.histograms);
    expect(histKeys.some(k => k.startsWith('api_request_duration_ms'))).toBe(true);
    const anyHist = snapshot.histograms[histKeys[0]];
    expect(anyHist.count).toBeGreaterThan(0);
    expect(anyHist.min).toBeLessThanOrEqual(anyHist.max);
    expect(anyHist.p50).toBeDefined();
    expect(anyHist.p95).toBeDefined();
    expect(anyHist.p99).toBeDefined();
  });
});

