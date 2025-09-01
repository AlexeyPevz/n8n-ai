# Production Deployment Guide

This guide covers deploying n8n-ai to production environments.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Environment Configuration](#environment-configuration)
4. [Security Configuration](#security-configuration)
5. [Database Setup](#database-setup)
6. [Deployment Options](#deployment-options)
7. [Monitoring & Observability](#monitoring--observability)
8. [Scaling Considerations](#scaling-considerations)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements
- Node.js 18+ (LTS recommended)
- PostgreSQL 13+ or MySQL 8+
- Redis 6+ (for caching and session management)
- Qdrant (optional, for RAG functionality)
- 4GB+ RAM minimum (8GB recommended)
- 20GB+ disk space

### Required Services
- n8n instance (v1.0+)
- AI Provider API keys (OpenAI, Anthropic, or OpenRouter)
- Git repository (optional, for Git integration)

## Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Nginx/    │────▶│    n8n      │────▶│  Database   │
│   Traefik   │     │  Instance   │     │ PostgreSQL  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                    │
       │                    │
       ▼                    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  AI Panel   │────▶│ Orchestrator│────▶│   Redis     │
│   (SPA)     │     │  (Fastify)  │     │   Cache     │
└─────────────┘     └─────────────┘     └─────────────┘
                            │
                            ▼
                    ┌─────────────┐
                    │   Qdrant    │
                    │ (Optional)  │
                    └─────────────┘
```

## Environment Configuration

### 1. Create Production Environment File

```bash
cp .env.example .env.production
```

### 2. Essential Environment Variables

```env
# Node Environment
NODE_ENV=production

# n8n Configuration
N8N_BASE_URL=https://n8n.yourdomain.com
N8N_API_KEY=your-n8n-api-key

# AI Provider Configuration
AI_PROVIDER=openrouter  # or openai, anthropic
AI_API_KEY=your-api-key
AI_MODEL=anthropic/claude-3-opus
AI_MAX_TOKENS=4000
AI_TEMPERATURE=0.3

# Security
SECURITY_PRESET=production  # strict for high-security environments
API_KEY_SECRET=your-random-secret-key
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000  # 15 minutes

# Database (for audit logs)
DATABASE_URL=postgresql://user:password@localhost:5432/n8n_ai
DATABASE_SSL=true

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password

# Monitoring
METRICS_ENABLED=true
METRICS_PORT=9090

# Git Integration (optional)
GIT_INTEGRATION_ENABLED=true
GIT_REPO_PATH=/var/lib/n8n-ai/workflows
GIT_BRANCH=main
GIT_AUTHOR_NAME=n8n AI Bot
GIT_AUTHOR_EMAIL=ai@yourdomain.com

# RAG System (optional)
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your-qdrant-key
RAG_ENABLED=true
RAG_COLLECTION_NAME=n8n_docs

# Performance
SCHEMA_CACHE_SIZE=2000
SCHEMA_CACHE_TTL=7200000  # 2 hours
WORKER_THREADS=4
```

## Security Configuration

### 1. API Key Setup

Generate secure API keys:

```bash
# Generate a secure API key
openssl rand -hex 32
```

### 2. Configure Security Policies

Create `config/security-policies.json`:

```json
{
  "policies": [
    {
      "type": "node_whitelist",
      "enabled": true,
      "whitelist": [
        "n8n-nodes-base.httpRequest",
        "n8n-nodes-base.webhook",
        "n8n-nodes-base.set",
        "n8n-nodes-base.if",
        "n8n-nodes-base.switch",
        "n8n-nodes-base.function",
        "n8n-nodes-base.merge"
      ],
      "allowUnknown": false
    },
    {
      "type": "operation_limit",
      "enabled": true,
      "maxOperations": 50,
      "maxNodesPerBatch": 20
    },
    {
      "type": "cost_limit",
      "enabled": true,
      "maxEstimatedCost": 1000,
      "costUnit": "tokens"
    }
  ]
}
```

### 3. SSL/TLS Configuration

Use Let's Encrypt with nginx:

```nginx
server {
    listen 443 ssl http2;
    server_name ai.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/ai.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ai.yourdomain.com/privkey.pem;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Orchestrator API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    # AI Panel SPA
    location / {
        root /var/www/ai-panel;
        try_files $uri $uri/ /index.html;
    }
}
```

## Database Setup

### PostgreSQL Setup

```sql
-- Create database and user
CREATE DATABASE n8n_ai;
CREATE USER n8n_ai_user WITH ENCRYPTED PASSWORD 'strong-password';
GRANT ALL PRIVILEGES ON DATABASE n8n_ai TO n8n_ai_user;

-- Create audit log table
\c n8n_ai;

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id TEXT,
    workflow_id TEXT NOT NULL,
    workflow_name TEXT,
    prompt TEXT,
    prompt_hash TEXT,
    model TEXT,
    operation_batch JSONB,
    operation_count INTEGER,
    diff_hash TEXT,
    estimated_cost DECIMAL(10,4),
    actual_cost DECIMAL(10,4),
    execution_time INTEGER,
    status TEXT NOT NULL,
    error TEXT,
    policy_violations JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_workflow_id ON audit_logs(workflow_id);
CREATE INDEX idx_audit_logs_status ON audit_logs(status);
```

## Deployment Options

### Option 1: Docker Compose

```yaml
version: '3.8'

services:
  orchestrator:
    build: ./packages/n8n-ai-orchestrator
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    ports:
      - "3000:3000"
    depends_on:
      - redis
      - postgres
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    volumes:
      - ./config:/app/config:ro
      - workflow-repo:/var/lib/n8n-ai/workflows

  ai-panel:
    build: ./packages/n8n-ai-panel
    ports:
      - "8080:80"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data:/data
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: n8n_ai
      POSTGRES_USER: n8n_ai_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped

  qdrant:
    image: qdrant/qdrant
    ports:
      - "6333:6333"
    volumes:
      - qdrant-data:/qdrant/storage
    restart: unless-stopped

volumes:
  redis-data:
  postgres-data:
  qdrant-data:
  workflow-repo:
```

### Option 2: Kubernetes

See [kubernetes/](../kubernetes/) directory for Helm charts and manifests.

### Option 3: PM2

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'n8n-ai-orchestrator',
    script: './packages/n8n-ai-orchestrator/dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/n8n-ai/error.log',
    out_file: '/var/log/n8n-ai/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '1G'
  }]
};
```

```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

## Monitoring & Observability

### 1. Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'n8n-ai'
    static_configs:
      - targets: ['localhost:9090']
    metrics_path: '/metrics'
```

### 2. Grafana Dashboard

Import the dashboard from `monitoring/grafana-dashboard.json`.

Key metrics to monitor:
- Request rate and latency
- AI token usage and costs
- Error rates by type
- Policy violations
- Cache hit rates
- WebSocket connections

### 3. Health Checks

```bash
# Check orchestrator health
curl https://ai.yourdomain.com/api/v1/ai/health

# Check metrics
curl https://ai.yourdomain.com/metrics
```

### 4. Log Aggregation

Configure log shipping to ELK or similar:

```yaml
# filebeat.yml
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /var/log/n8n-ai/*.log
  json.keys_under_root: true
  json.add_error_key: true

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
```

## Scaling Considerations

### 1. Horizontal Scaling

- **Orchestrator**: Stateless, can scale horizontally behind load balancer
- **AI Panel**: Static files, serve via CDN
- **Redis**: Use Redis Cluster for high availability
- **Database**: Use read replicas for audit log queries

### 2. Performance Tuning

```javascript
// Orchestrator optimizations
const server = Fastify({
  logger: true,
  trustProxy: true,
  connectionTimeout: 30000,
  bodyLimit: 10485760, // 10MB
});

// Enable compression
await server.register(compress);

// Cache static responses
server.addHook('onSend', async (request, reply, payload) => {
  if (request.url.startsWith('/api/v1/ai/introspect')) {
    reply.header('Cache-Control', 'public, max-age=3600');
  }
  return payload;
});
```

### 3. Resource Limits

```yaml
# Kubernetes resource limits
resources:
  requests:
    memory: "512Mi"
    cpu: "500m"
  limits:
    memory: "2Gi"
    cpu: "2000m"
```

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Check schema cache size
   - Monitor WebSocket connections
   - Review pagination settings

2. **Slow AI Responses**
   - Check RAG context size
   - Review prompt complexity
   - Consider using faster models

3. **Database Connection Errors**
   - Verify connection pool settings
   - Check SSL configuration
   - Monitor connection limits

### Debug Mode

Enable detailed logging:

```env
LOG_LEVEL=debug
DEBUG=n8n-ai:*
```

### Performance Profiling

```bash
# CPU profiling
node --inspect=0.0.0.0:9229 dist/server.js

# Memory snapshot
kill -USR2 <pid>
```

## Backup & Recovery

### 1. Database Backup

```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h localhost -U n8n_ai_user -d n8n_ai | gzip > backup_$DATE.sql.gz

# Keep last 30 days
find . -name "backup_*.sql.gz" -mtime +30 -delete
```

### 2. Git Repository Backup

```bash
# Backup workflow repository
tar -czf workflows_backup_$DATE.tar.gz /var/lib/n8n-ai/workflows
```

## Security Checklist

- [ ] All API keys rotated from defaults
- [ ] SSL/TLS enabled on all endpoints
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] API authentication required
- [ ] Database connections use SSL
- [ ] Audit logging enabled
- [ ] Regular security updates scheduled
- [ ] Backup strategy implemented
- [ ] Monitoring alerts configured

## Support

For production support:
- Check logs: `/var/log/n8n-ai/`
- Monitor metrics: `/metrics` endpoint
- Review audit logs in database
- Enable debug logging if needed

For issues, contact the development team with:
- Error messages and stack traces
- Relevant audit log entries
- Performance metrics
- Steps to reproduce