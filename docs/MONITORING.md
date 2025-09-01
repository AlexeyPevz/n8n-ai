# Monitoring and Metrics Guide

## Overview

n8n-ai includes a comprehensive monitoring system with:
- Real-time metrics collection
- Prometheus-compatible export
- Built-in dashboard
- Performance tracking
- Resource monitoring
- AI-specific metrics

## Architecture

```
Application Code
    ↓
Metrics Collection → Registry → Exporters
    ↓                              ↓
Auto-instrumentation         Prometheus
Decorators                   Dashboard
Middleware                   JSON API
```

## Available Metrics

### HTTP Metrics
- `n8n_ai_http_requests_total` - Total HTTP requests by method, path, status
- `n8n_ai_http_request_duration_seconds` - Request duration histogram

### AI Metrics
- `n8n_ai_planning_requests_total` - Planning requests by complexity, status, provider
- `n8n_ai_planning_duration_seconds` - Planning duration histogram
- `n8n_ai_token_usage_total` - Token usage by provider and type
- `n8n_ai_planning_errors_total` - Planning errors by provider and type

### Graph Operation Metrics
- `n8n_ai_graph_operations_total` - Graph operations by type and status
- `n8n_ai_graph_operation_duration_seconds` - Operation duration
- `n8n_ai_workflow_size` - Current workflow size (nodes)

### Validation Metrics
- `n8n_ai_validation_requests_total` - Validation requests by status
- `n8n_ai_validation_errors_total` - Validation errors by type and severity
- `n8n_ai_validation_duration_seconds` - Validation duration

### RAG Metrics
- `n8n_ai_rag_search_requests_total` - RAG searches by status
- `n8n_ai_rag_search_duration_seconds` - Search duration
- `n8n_ai_rag_document_count` - Documents in vector store
- `n8n_ai_rag_search_results_count` - Results per search histogram

### Cache Metrics
- `n8n_ai_cache_hits_total` - Cache hits by type
- `n8n_ai_cache_misses_total` - Cache misses by type
- `n8n_ai_cache_size_bytes` - Cache size by type

### System Metrics
- `n8n_ai_memory_usage_bytes` - Memory usage (heap, rss, external)
- `n8n_ai_cpu_usage_percent` - CPU usage percentage
- `n8n_ai_uptime_seconds` - System uptime

## Endpoints

### Prometheus Format
```
GET /metrics
```
Returns metrics in Prometheus text format.

### JSON Format
```
GET /metrics/json
```
Returns all metrics as JSON.

### Dashboard Metrics
```
GET /metrics/dashboard
```
Returns aggregated metrics for dashboard display.

### Historical Metrics
```
GET /metrics/history?startTime=1234567890&endTime=1234567899
```
Returns historical metrics within time range.

### Time Range Metrics
```
GET /metrics/range/1h  # Last hour
GET /metrics/range/6h  # Last 6 hours
GET /metrics/range/24h # Last 24 hours
GET /metrics/range/7d  # Last 7 days
```
Returns metrics for specific time ranges with comparisons.

### Health Check
```
GET /metrics/health
```
Returns system health with key metrics.

### Web Dashboard
```
GET /metrics/dashboard.html
```
Interactive web dashboard with real-time updates.

## Prometheus Integration

### Configuration
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'n8n-ai'
    static_configs:
      - targets: ['localhost:3000']
    scrape_interval: 15s
```

### Example Queries
```promql
# Request rate
rate(n8n_ai_http_requests_total[5m])

# Error rate
rate(n8n_ai_http_requests_total{status="5xx"}[5m]) / rate(n8n_ai_http_requests_total[5m])

# AI planning p95 latency
histogram_quantile(0.95, rate(n8n_ai_planning_duration_seconds_bucket[5m]))

# Token usage rate
rate(n8n_ai_token_usage_total[1h])

# Memory usage
n8n_ai_memory_usage_bytes{type="heap"}
```

## Grafana Dashboard

Import the dashboard from `docs/grafana-dashboard.json` or create custom panels.

### Key Panels
1. **Overview**
   - Request rate
   - Error rate
   - Response time (p50, p95, p99)
   - Active workflows

2. **AI Performance**
   - Planning success rate
   - Token usage by provider
   - Complexity breakdown
   - Planning latency

3. **System Resources**
   - CPU usage
   - Memory usage
   - Garbage collection
   - Event loop lag

4. **Cache Performance**
   - Hit rate
   - Size by type
   - Eviction rate

## Custom Metrics

### Adding New Metrics
```typescript
import { metricsRegistry } from './monitoring/metrics-system';

// Counter
const myCounter = metricsRegistry.counter(
  'my_custom_counter',
  'Description of counter',
  ['label1', 'label2']
);
myCounter.inc({ label1: 'value1', label2: 'value2' });

// Gauge
const myGauge = metricsRegistry.gauge(
  'my_custom_gauge',
  'Description of gauge'
);
myGauge.set(42);

// Histogram
const myHistogram = metricsRegistry.histogram(
  'my_custom_histogram',
  'Description of histogram',
  ['label'],
  [0.1, 0.5, 1, 5, 10] // buckets
);
myHistogram.observe(2.5, { label: 'value' });
```

### Using Decorators
```typescript
import { measureAsync } from './monitoring/metrics-middleware';

class MyService {
  @measureAsync('my_operation_duration', { service: 'myservice' })
  async performOperation() {
    // Method execution time will be automatically measured
  }
}
```

### Manual Timing
```typescript
import { appMetrics } from './monitoring/app-metrics';

const timer = appMetrics.ai.planningDuration.startTimer({ complexity: 'medium' });
try {
  // Do work
} finally {
  timer(); // Records duration
}
```

## Alerting

### Prometheus Alerting Rules
```yaml
groups:
  - name: n8n-ai
    rules:
      - alert: HighErrorRate
        expr: rate(n8n_ai_http_requests_total{status="5xx"}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"
          
      - alert: HighMemoryUsage
        expr: n8n_ai_memory_usage_bytes{type="heap"} > 500000000
        for: 10m
        annotations:
          summary: "High memory usage"
          
      - alert: SlowAIPlanning
        expr: histogram_quantile(0.95, rate(n8n_ai_planning_duration_seconds_bucket[5m])) > 10
        for: 5m
        annotations:
          summary: "AI planning is slow"
```

## Performance Tips

1. **Metric Cardinality**
   - Avoid high-cardinality labels (user IDs, request IDs)
   - Use bounded label values
   - Aggregate where possible

2. **Collection Frequency**
   - System metrics: Every 10 seconds
   - Business metrics: On demand
   - Histograms: Use appropriate buckets

3. **Storage**
   - Historical data is kept in memory (last 1000 points)
   - Use external storage for long-term retention
   - Configure Prometheus retention appropriately

## Troubleshooting

### Missing Metrics
- Check if service is running
- Verify metric registration
- Check for errors in logs

### High Memory Usage
- Reduce histogram buckets
- Limit label cardinality
- Decrease history retention

### Slow Queries
- Use recording rules in Prometheus
- Optimize label selectors
- Pre-aggregate where possible