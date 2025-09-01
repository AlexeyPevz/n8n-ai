# Orchestrator API Reference

## Health & Metrics

- GET `/api/v1/ai/health` — status
- GET `/api/v1/ai/metrics` — JSON metrics
- GET `/metrics` — Prometheus text format

## Introspection

- GET `/introspect/nodes` — list of available nodes

## Planner

- POST `/plan` { prompt }
- POST `/suggest` { prompt, category? }
- GET `/patterns`
- POST `/ai/recommend-model` { prompt }

## Graph

- POST `/graph/:id/batch` { OperationBatch }
- POST `/graph/:id/validate`
- POST `/graph/:id/simulate`
- POST `/graph/:id/critic` { batch? }
- POST `/graph/:id/undo` { undoId? }
- POST `/graph/:id/redo`
- GET `/graph/:id`

## Workflow Map

- GET `/workflow-map`
- GET `/workflow-map/live` (SSE)
- WS `/live` (websocket)

## REST aliases

Same routes under `/rest/ai/*` for upstream compatibility.