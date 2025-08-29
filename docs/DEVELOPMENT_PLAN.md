# Development Plan: n8n-ai

_Last updated: 2025-08-29_

## Status Legend
| Status | Meaning |
|--------|---------|
| 🚧 **In Progress** | Спринт активен, задачи выполняются |
| 🗓 **Planned** | Спринт запланирован, ещё не стартовал |
| ⏸ **Postponed** | Спринт отложен до уточнения сроков |
| ✅ **Completed** | Спринт закрыт **после** одобрения владельца репо |

> ⚠️ **Внимание:** менять статус `Completed` → ставить только после явного письменного _Approve_ от @product-owner.

## Timeline (12 weeks)
| № | Sprint | Dates (2025) | Scope (short) | Status |
|---|--------|--------------|---------------|--------|
| 0 | Initialisation | **Sep 1 – Sep 7** | Repos scaffold, dev-stack, baseline schemas | 🗓 Planned |
| 1 | Vertical Slice 0 | **Sep 8 – Sep 21** | Introspect v0, `add_node`, AI panel MVP, golden flows | 🗓 Planned |
| 2 | Connections & Validation | **Sep 22 – Oct 5** | Batch ops (`connect`, `set_params`, …), lints v0, canvas diff | 🗓 Planned |
| 3 | Dynamics & Simulation | **Oct 6 – Oct 26** | Sandbox `loadOptions`, Simulate API, Critic v1, expressions | 🗓 Planned |
| 4 | Workflow Map | **Oct 27 – Nov 9** | Dependency index, `/workflow-map`, map tab (static + live) | 🗓 Planned |
| 5 | Governance, Git & Refactors | **Nov 10 – Nov 23** | Diff policies, audit, Git PR, refactor ops | 🗓 Planned |
| – | Polish & Release | **Nov 24 – Nov 30** | Perf, UX, Secrets Wizard v1, docs, demo | 🗓 Planned |

## Detailed Scope per Sprint
### Sprint 0 — Initialisation (1 week)
- Create repositories (`n8n-ai-hooks`, `n8n-ai-orchestrator`, `n8n-ai-schemas`, `n8n-ai-panel`).
- Add ADR-001 (architecture overview).
- Set up pnpm workspace, docker-compose dev stack (n8n fork, orchestrator, redis, qdrant).
- Bootstrap baseline SGR schemas.

### Sprint 1 — Vertical Slice 0 (2 weeks)
- **Backend**: Introspect API v0 (static `NodeDescription`, no `loadOptions`).
- **Backend**: Graph Mutation API `add_node` + pre-validation.
- **Orchestrator**: OperationBatch validator.
- **Frontend**: AI panel MVP — Describe → HTTP GET node → diff (list) → Apply/Undo.
- **QA**: 10 golden flows scripted; CI regression pipeline.

### Sprint 2 — Connections & Validation (2 weeks)
- Add Graph ops: `connect`, `set_params`, `delete`, `annotate`.
- Implement lints v0: missing trigger, dangling branches, enum/required.
- Execution Events (SSE) stub.
- Canvas diff colours & “Changes” panel.

### Sprint 3 — Dynamics & Simulation (3 weeks)
- **Backend**: Sandbox `loadOptions` with timeout/cache/ETag.
- **Backend**: Simulate API (dry-run) returning synthetic shapes.
- **Orchestrator**: Critic v1 auto-fix loop.
- **Frontend**: Autocomplete for `={{ }}` expressions (stub).

### Sprint 4 — Workflow Map (2 weeks)
- Build dependency indexer (Execute Workflow, HTTP→Webhook heuristic).
- Expose REST `/workflow-map` and WS `/live` endpoints.
- Map tab: static view first, then live statuses overlay.

### Sprint 5 — Governance, Git & Refactors (2 weeks)
- Implement diff policies (whitelist/limits), audit log (user, promptHash, diffHash, model, cost).
- Git integration: Apply → commit/PR, CI Validate/Simulate.
- New Graph ops: `replace_node`, `extract_subworkflow`, `optimize_batches`.

### Polish & Release (1 week)
- Performance: schema cache, RAG context trimming, pre-warm hot nodes.
- UX: Secrets Wizard v1, Explain-node snippet, map cost tooltips.
- Documentation, demo video, upstream PRs for extension points.

---

## Updating This Document
1. **Single Source**: all timeline edits happen _only_ here (`docs/DEVELOPMENT_PLAN.md`).
2. **Dates**: use ISO format `YYYY-MM-DD`; adjust in case of company-wide holidays.
3. **Status Changes**:
   - Change status column emoji + text.
   - Add a bullet under _Changelog_ section with date & author initials.
4. **Scope Adjustments**: keep sprint scope bullets concise (max 5-7 lines).
5. **Changelog** section must remain at the bottom of the file.
6. Open a PR; get review; **`Completed`** status only after explicit 👍 from @product-owner.

## Changelog
- **2025-08-29** – Initial draft created (AB).