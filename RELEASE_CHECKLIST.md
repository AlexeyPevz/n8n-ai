# Release Checklist

## Pre-release
- [ ] CI green (lint, unit, build, golden, e2e, ui-e2e, integration-smoke, type-check, security)
- [ ] Update docs (README, SPRINT4_READY, PROJECT_STATUS)
- [ ] Verify docker-compose .env and defaults (USE_HOOKS, retries/timeouts, policies)
- [ ] Verify /metrics and /audit/logs reachable

## Functional
- [ ] Plan/Preview/Apply works via REST aliases
- [ ] Validate/Simulate via hooks (flags on), fallback OK
- [ ] Workflow Map live overlay visible
- [ ] Git Export stub returns OK

## Observability & Security
- [ ] Prometheus /metrics scraped
- [ ] Audit logs persisted (or temporary OK)
- [ ] Container/image scan

## Delivery
- [ ] Tag release
- [ ] Build & push images (hooks/orchestrator)
- [ ] Deploy staging
- [ ] Smoke tests pass
- [ ] Promote to production