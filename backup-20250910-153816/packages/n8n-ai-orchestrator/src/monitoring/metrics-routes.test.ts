import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { registerMetricsRoutes, registerDashboardRoute } from './metrics-routes.js';
import { metricsRegistry } from './app-metrics.js';

vi.mock('./app-metrics.js', () => ({
  metricsRegistry: {
    toPrometheus: vi.fn(),
    toJSON: vi.fn(),
    collect: vi.fn(),
    counter: vi.fn(() => ({ inc: vi.fn() })),
    gauge: vi.fn(() => ({ set: vi.fn() })),
    histogram: vi.fn(() => ({ observe: vi.fn() })),
  },
  APP_METRICS: {},
}));

describe('Metrics Routes', () => {
  let app: any;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await registerMetricsRoutes(app);
    await registerDashboardRoute(app);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  describe('GET /metrics', () => {
    it('should return metrics in Prometheus format', async () => {
      const prometheusData = `# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 42
http_requests_total{method="POST",status="201"} 10`;

      vi.mocked(metricsRegistry.toPrometheus).mockReturnValue(prometheusData);

      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('text/plain; version=0.0.4');
      expect(response.body).toBe(prometheusData);
    });

    it('should handle empty metrics', async () => {
      vi.mocked(metricsRegistry.toPrometheus).mockReturnValue('');

      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toBe('');
    });
  });

  describe('GET /metrics/json', () => {
    it('should return metrics in JSON format', async () => {
      const jsonData = {
        metrics: [
          {
            name: 'http_requests_total',
            type: 'counter',
            help: 'Total HTTP requests',
            value: 52,
            labels: {},
          },
          {
            name: 'memory_usage_bytes',
            type: 'gauge',
            help: 'Memory usage in bytes',
            value: 104857600,
            labels: {},
          },
        ],
        timestamp: new Date().toISOString(),
      };

      vi.mocked(metricsRegistry.toJSON).mockReturnValue(JSON.stringify(jsonData));

      const response = await app.inject({
        method: 'GET',
        url: '/metrics/json',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(JSON.parse(response.body)).toEqual(jsonData);
    });

    it('should include query filters', async () => {
      vi.mocked(metricsRegistry.collect).mockReturnValue([
        {
          name: 'http_requests_total',
          type: 'counter',
          help: 'Total HTTP requests',
          values: new Map([['method="GET"', 100]]),
        },
        {
          name: 'ai_tokens_used',
          type: 'counter',
          help: 'AI tokens used',
          values: new Map([['model="gpt-4"', 5000]]),
        },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/metrics/json?prefix=ai_',
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result.metrics).toHaveLength(1);
      expect(result.metrics[0].name).toBe('ai_tokens_used');
    });
  });

  describe('GET /metrics/dashboard', () => {
    it('should return dashboard HTML', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/metrics/dashboard',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.body).toContain('<!DOCTYPE html>');
      expect(response.body).toContain('Metrics Dashboard');
    });
  });

  describe('GET /metrics/dashboard.html', () => {
    it('should return dashboard HTML at alternate path', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/metrics/dashboard.html',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.body).toContain('Metrics Dashboard');
    });
  });

  describe('GET /metrics/health', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/metrics/health',
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        metrics: {
          collected: expect.any(Number),
          errors: expect.any(Number),
        },
      });
    });
  });

  describe('POST /metrics/custom', () => {
    it('should record custom metric', async () => {
      const mockCounter = { inc: vi.fn() };
      vi.mocked(metricsRegistry.counter).mockReturnValue(mockCounter as any);

      const response = await app.inject({
        method: 'POST',
        url: '/metrics/custom',
        payload: {
          name: 'custom_event',
          type: 'counter',
          value: 1,
          labels: { event: 'test' },
        },
      });

      expect(response.statusCode).toBe(200);
      expect(metricsRegistry.counter).toHaveBeenCalledWith(
        'custom_event',
        expect.any(String),
        expect.any(Array)
      );
      expect(mockCounter.inc).toHaveBeenCalledWith({ event: 'test' }, 1);
    });

    it('should record gauge metric', async () => {
      const mockGauge = { set: vi.fn() };
      vi.mocked(metricsRegistry.gauge).mockReturnValue(mockGauge as any);

      const response = await app.inject({
        method: 'POST',
        url: '/metrics/custom',
        payload: {
          name: 'custom_gauge',
          type: 'gauge',
          value: 42.5,
          labels: { instance: 'test' },
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockGauge.set).toHaveBeenCalledWith(42.5, { instance: 'test' });
    });

    it('should record histogram metric', async () => {
      const mockHistogram = { observe: vi.fn() };
      vi.mocked(metricsRegistry.histogram).mockReturnValue(mockHistogram as any);

      const response = await app.inject({
        method: 'POST',
        url: '/metrics/custom',
        payload: {
          name: 'response_time',
          type: 'histogram',
          value: 0.123,
          labels: { endpoint: '/api/test' },
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockHistogram.observe).toHaveBeenCalledWith(0.123, { endpoint: '/api/test' });
    });

    it('should validate metric type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/metrics/custom',
        payload: {
          name: 'invalid_metric',
          type: 'invalid',
          value: 1,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain('Invalid metric type');
    });
  });

  describe('GET /metrics/summary', () => {
    it('should return metrics summary', async () => {
      vi.mocked(metricsRegistry.collect).mockReturnValue([
        {
          name: 'http_requests_total',
          type: 'counter',
          help: 'Total HTTP requests',
          values: new Map([
            ['method="GET",status="200"', 100],
            ['method="POST",status="201"', 50],
          ]),
        },
        {
          name: 'response_time_seconds',
          type: 'histogram',
          help: 'Response time',
          values: new Map(),
          sum: 150,
          count: 1000,
          mean: 0.15,
          buckets: { 0.1: 200, 0.5: 800, 1: 950, '+Inf': 1000 },
        },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/metrics/summary',
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result.summary).toMatchObject({
        totalMetrics: 2,
        byType: {
          counter: 1,
          histogram: 1,
        },
        topMetrics: expect.any(Array),
      });
    });
  });
});