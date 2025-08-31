# Deployment Guide

## Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local builds)
- Access to container registry (optional)

## Services
- n8n-ai-hooks (n8n with AI hooks)
- Orchestrator (Fastify API)
- Redis, Qdrant (optional)

## Quick Start (local)
```bash
cp .env.example .env
pnpm install
pnpm docker:up
pnpm dev:full
```

## Health & Smoke
```bash
curl -s http://localhost:3000/api/v1/ai/health | jq .
curl -s http://localhost:3000/introspect/nodes | jq '. | length'
curl -s http://localhost:3000/workflow-map | jq .
```

## Env & Policies
- USE_HOOKS=1 (proxy validate/simulate to hooks)
- HOOKS_FETCH_RETRIES=2, HOOKS_FETCH_TIMEOUT_MS=3000
- DIFF_POLICY_MAX_ADD_NODES, DIFF_POLICY_DOMAIN_BLACKLIST

## Metrics & Audit
- Prometheus: GET /metrics
- Audit: GET /audit/logs (and /rest/ai/audit/logs)

## Production Notes
- Run orchestrator behind reverse proxy (TLS)
- Forward auth headers (Authorization/cookie/x-user-id)
- Persistent audit storage (DB) recommended
- Configure log aggregation and alerting (SSE, metrics)