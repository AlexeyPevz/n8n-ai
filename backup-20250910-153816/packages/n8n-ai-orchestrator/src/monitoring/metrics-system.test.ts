import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MetricsRegistry, Counter, Gauge, Histogram, Summary } from './metrics-system.js';

describe('MetricsRegistry', () => {
  let registry: MetricsRegistry;

  beforeEach(() => {
    registry = new MetricsRegistry();
  });

  describe('Counter', () => {
    it('should create and increment counter', () => {
      const counter = registry.counter('test_counter', 'Test counter metric');
      
      expect(counter.value()).toBe(0);
      
      counter.inc();
      expect(counter.value()).toBe(1);
      
      counter.inc(5);
      expect(counter.value()).toBe(6);
    });

    it('should track counter with labels', () => {
      const counter = registry.counter('http_requests', 'HTTP requests', ['method', 'status']);
      
      counter.inc({ method: 'GET', status: '200' });
      counter.inc({ method: 'GET', status: '200' });
      counter.inc({ method: 'POST', status: '201' });
      counter.inc({ method: 'GET', status: '404' });
      
      const values = counter.values();
      expect(values.get('method="GET",status="200"')).toBe(2);
      expect(values.get('method="POST",status="201"')).toBe(1);
      expect(values.get('method="GET",status="404"')).toBe(1);
    });

    it('should emit events on increment', () => {
      const counter = registry.counter('event_counter', 'Event counter');
      const listener = vi.fn();
      
      registry.on('metric:update', listener);
      
      counter.inc(10);
      
      expect(listener).toHaveBeenCalledWith({
        name: 'event_counter',
        type: 'counter',
        value: 10,
        labels: {},
        timestamp: expect.any(Number),
      });
    });
  });

  describe('Gauge', () => {
    it('should set and track gauge value', () => {
      const gauge = registry.gauge('memory_usage', 'Memory usage in bytes');
      
      gauge.set(1000);
      expect(gauge.value()).toBe(1000);
      
      gauge.inc(500);
      expect(gauge.value()).toBe(1500);
      
      gauge.dec(200);
      expect(gauge.value()).toBe(1300);
    });

    it('should track gauge with labels', () => {
      const gauge = registry.gauge('queue_size', 'Queue size', ['queue']);
      
      gauge.set(10, { queue: 'emails' });
      gauge.set(5, { queue: 'webhooks' });
      
      const values = gauge.values();
      expect(values.get('queue="emails"')).toBe(10);
      expect(values.get('queue="webhooks"')).toBe(5);
    });

    it('should track current time with setToCurrentTime', () => {
      const gauge = registry.gauge('last_run', 'Last run timestamp');
      const now = Date.now();
      
      gauge.setToCurrentTime();
      
      const value = gauge.value();
      expect(value).toBeGreaterThanOrEqual(now / 1000);
      expect(value).toBeLessThanOrEqual((now + 1000) / 1000);
    });
  });

  describe('Histogram', () => {
    it('should observe values and calculate percentiles', () => {
      const histogram = registry.histogram('response_time', 'Response time in ms');
      
      // Add values
      for (let i = 1; i <= 100; i++) {
        histogram.observe(i);
      }
      
      const percentiles = histogram.percentiles([0.5, 0.9, 0.99]);
      expect(percentiles[0.5]).toBeCloseTo(50, 0);
      expect(percentiles[0.9]).toBeCloseTo(90, 0);
      expect(percentiles[0.99]).toBeCloseTo(99, 0);
    });

    it('should track histogram with custom buckets', () => {
      const histogram = registry.histogram(
        'request_duration',
        'Request duration',
        [],
        [0.1, 0.5, 1, 2, 5, 10]
      );
      
      histogram.observe(0.05);
      histogram.observe(0.3);
      histogram.observe(0.7);
      histogram.observe(1.5);
      histogram.observe(7);
      histogram.observe(15);
      
      const buckets = histogram.buckets();
      expect(buckets[0.1]).toBe(1); // 0.05
      expect(buckets[0.5]).toBe(2); // 0.05, 0.3
      expect(buckets[1]).toBe(3);   // 0.05, 0.3, 0.7
      expect(buckets[2]).toBe(4);   // + 1.5
      expect(buckets[5]).toBe(4);   // same (7 > 5)
      expect(buckets[10]).toBe(5);  // + 7
      expect(buckets['+Inf']).toBe(6); // all including 15
    });

    it('should calculate correct statistics', () => {
      const histogram = registry.histogram('test_hist', 'Test histogram');
      
      histogram.observe(1);
      histogram.observe(2);
      histogram.observe(3);
      histogram.observe(4);
      histogram.observe(5);
      
      expect(histogram.sum()).toBe(15);
      expect(histogram.count()).toBe(5);
      expect(histogram.mean()).toBe(3);
    });

    it('should measure timer duration', async () => {
      const histogram = registry.histogram('timer_test', 'Timer test');
      
      const timer = histogram.startTimer();
      await new Promise(resolve => setTimeout(resolve, 100));
      const duration = timer();
      
      expect(duration).toBeGreaterThan(0.09); // 90ms
      expect(duration).toBeLessThan(0.2); // 200ms
      expect(histogram.count()).toBe(1);
    });
  });

  describe('Summary', () => {
    it('should calculate quantiles over time window', () => {
      const summary = registry.summary('response_summary', 'Response time summary');
      
      // Add values
      for (let i = 1; i <= 100; i++) {
        summary.observe(i);
      }
      
      const quantiles = summary.quantiles([0.5, 0.9, 0.99]);
      expect(quantiles[0.5]).toBeCloseTo(50, 0);
      expect(quantiles[0.9]).toBeCloseTo(90, 0);
      expect(quantiles[0.99]).toBeCloseTo(99, 0);
    });

    it('should expire old values', () => {
      vi.useFakeTimers();
      
      const summary = registry.summary(
        'expiring_summary', 
        'Expiring summary',
        [],
        { maxAge: 60000, ageBuckets: 6 } // 1 minute window, 10s buckets
      );
      
      summary.observe(10);
      vi.advanceTimersByTime(30000); // 30s
      summary.observe(20);
      vi.advanceTimersByTime(40000); // 70s total
      summary.observe(30);
      
      // First value should be expired
      const values = summary.values();
      expect(values.length).toBe(2); // Only 20 and 30
      
      vi.useRealTimers();
    });
  });

  describe('Metric Collection', () => {
    it('should collect all metrics', () => {
      const counter = registry.counter('total_requests', 'Total requests');
      const gauge = registry.gauge('active_connections', 'Active connections');
      const histogram = registry.histogram('response_time', 'Response time');
      
      counter.inc(100);
      gauge.set(50);
      histogram.observe(0.5);
      histogram.observe(1.5);
      
      const metrics = registry.collect();
      
      expect(metrics.length).toBe(3);
      expect(metrics.find(m => m.name === 'total_requests')?.type).toBe('counter');
      expect(metrics.find(m => m.name === 'active_connections')?.type).toBe('gauge');
      expect(metrics.find(m => m.name === 'response_time')?.type).toBe('histogram');
    });

    it('should export metrics in Prometheus format', () => {
      const counter = registry.counter('app_requests_total', 'Total requests', ['method']);
      counter.inc({ method: 'GET' });
      counter.inc({ method: 'POST' });
      counter.inc({ method: 'GET' });
      
      const prometheus = registry.toPrometheus();
      
      expect(prometheus).toContain('# HELP app_requests_total Total requests');
      expect(prometheus).toContain('# TYPE app_requests_total counter');
      expect(prometheus).toContain('app_requests_total{method="GET"} 2');
      expect(prometheus).toContain('app_requests_total{method="POST"} 1');
    });

    it('should export metrics in JSON format', () => {
      const gauge = registry.gauge('cpu_usage', 'CPU usage percentage');
      gauge.set(75.5);
      
      const json = registry.toJSON();
      const parsed = JSON.parse(json);
      
      expect(parsed.metrics).toHaveLength(1);
      expect(parsed.metrics[0]).toMatchObject({
        name: 'cpu_usage',
        type: 'gauge',
        help: 'CPU usage percentage',
        value: 75.5,
      });
    });
  });

  describe('Event Emission', () => {
    it('should emit events for all metric updates', () => {
      const events: any[] = [];
      registry.on('metric:update', event => events.push(event));
      
      const counter = registry.counter('events_counter', 'Events counter');
      const gauge = registry.gauge('events_gauge', 'Events gauge');
      
      counter.inc();
      gauge.set(10);
      counter.inc(5);
      
      expect(events).toHaveLength(3);
      expect(events[0].name).toBe('events_counter');
      expect(events[0].value).toBe(1);
      expect(events[1].name).toBe('events_gauge');
      expect(events[1].value).toBe(10);
      expect(events[2].name).toBe('events_counter');
      expect(events[2].value).toBe(6);
    });
  });

  describe('Registry Management', () => {
    it('should prevent duplicate metric names', () => {
      registry.counter('duplicate_metric', 'First metric');
      
      expect(() => {
        registry.gauge('duplicate_metric', 'Second metric');
      }).toThrow('Metric duplicate_metric already exists');
    });

    it('should get existing metrics', () => {
      const counter = registry.counter('existing_counter', 'Existing counter');
      counter.inc(10);
      
      const retrieved = registry.get('existing_counter') as Counter;
      expect(retrieved).toBe(counter);
      expect(retrieved.value()).toBe(10);
    });

    it('should list all metric names', () => {
      registry.counter('metric1', 'Metric 1');
      registry.gauge('metric2', 'Metric 2');
      registry.histogram('metric3', 'Metric 3');
      registry.summary('metric4', 'Metric 4');
      
      const names = registry.getMetricNames();
      expect(names).toEqual(['metric1', 'metric2', 'metric3', 'metric4']);
    });

    it('should clear all metrics', () => {
      registry.counter('temp1', 'Temp 1').inc(100);
      registry.gauge('temp2', 'Temp 2').set(50);
      
      registry.clear();
      
      expect(registry.getMetricNames()).toEqual([]);
      expect(registry.collect()).toEqual([]);
    });
  });
});