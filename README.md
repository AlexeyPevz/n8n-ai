# n8n-ai: AI-first Workflow Builder for n8n

## 1. Vision
Turn n8n into an **AI-first integration platform**: a user describes a goal in natural language and the assistant deterministically builds, refactors, validates and tests the workflow, then shows a visual diff before applying changes.

Key goals:
1. **Describe → Plan → Preview → Apply → Test → Fix** loop in the editor.
2. **Schema-Guided Reasoning (SGR)** – LLM output is strictly validated against JSON-schemas for nodes, graphs and diff operations.
3. **Workflow Map** – static dependency map + live status & cost metrics across multiple workflows.
4. **Governance & Security** – credential-only access, diff policies, audit, undo/redo.
5. **Refactoring** – replace node, extract sub-workflow, optimise batches.

---

## 2. High-level Architecture
```
        ┌────────────┐        Graph/Validate/Simulate        ┌────────────┐
        │ n8n (fork) │  <───────────────────────────────┐    │   UI:      │
        │  + hooks   │         events / introspect      │    │ Editor +   │
        └────┬───────┘                                   │    │ AI Panel   │
             │ Introspect API                            │    │ Map Tab    │
             │ Graph Mutation API ───────────────────────┼──▶ └────────────┘
             │ Validate / Simulate API                   │
             │ Execution Events (SSE/WS)                 │
             ▼                                           │
        ┌────────────────┐  RAG / SGR / Agents  ┌───────▼─────────┐
        │  Orchestrator  │  (Planner/Builder/   │  Schemas +      │
        │  (sidecar)     │  Validator/Critic)   │  Recipes Cache  │
        └────────────────┘                      └─────────────────┘
```

See diagram at `docs/diagrams/architecture.mmd` (Mermaid).

Quick links:
- API reference: `docs/API.md`
- Environment vars: `docs/ENV.md`
- Deployment: `DEPLOYMENT.md`, `docker-compose.yml`

---

## 3. Core Concepts

### 3.0 AI-Powered Workflow Generation
The system uses Large Language Models (LLMs) to understand natural language requests and generate n8n workflows:
* **Multi-provider support** – OpenAI, Anthropic (coming soon), Ollama (coming soon)
* **Context-aware** – Uses current workflow state and available nodes
* **Schema validation** – All AI outputs are validated against strict schemas
* **Fallback mechanisms** – Pattern matching when AI is unavailable

### 3.1 Schema-Guided Reasoning (SGR)
* **NodeSchema** – types, required/enums/dependencies, resolved `loadOptions`.
* **GraphSchema** – allowed connections & operations.
* **OperationBatch** – atomic diff format.

Example:
```json
{
  "ops": [
    { "op": "add_node", "node": { "id": "http-1", "type": "n8n-nodes-base.httpRequest", "parameters": { "method": "GET", "url": "https://api.example.com" } } },
    { "op": "connect", "from": "Manual Trigger", "to": "http-1" },
    { "op": "annotate", "name": "http-1", "text": "GET because endpoint is read-only" }
  ]
}
```

### 3.2 UI Roles
* **AI Panel (sidebar)** – chat, clarifying Q&A, plan card, diff preview, apply/undo.
* **Canvas** – live diff colours (green add / yellow change / red delete), contextual actions.
* **Secrets Wizard** – modal to choose/create credentials, test connectivity.
* **Workflow Map** – dependency graph + live status & cost.

State machine: `Idle → Clarifying → Planning → Review → Secrets → Building → Testing → Done/Debug`.

---

## 4. Repository Layout
```
/ .gitignore
  README.md              ← you are here
  pnpm-workspace.yaml
  docker-compose.yml     ← dev stack (n8n fork + orchestrator + redis + qdrant)
  /packages
    n8n-ai-hooks         ← thin n8n fork (typescript, licences kept)
    n8n-ai-orchestrator  ← NestJS/TS or Fastify sidecar
    n8n-ai-schemas       ← shared JSONSchema/Zod types
    n8n-ai-panel         ← Vue 3 + Vite (optional)
  /examples              ← golden flows & regression fixtures
  /docs                  ← ADRs, API reference, diagrams
```

---

## 5. Getting Started

### 5.1 Quick Start (Unified App) 🚀
```bash
# Clone and start unified n8n with AI
git clone https://github.com/your-org/n8n-ai.git
cd n8n-ai
./scripts/start-unified.sh

# Open http://localhost:5678
# Press Cmd+K to open AI assistant
```

### 5.2 Development Setup
#### Prerequisites
* Node 20 + pnpm `>=8`
* Docker & Docker-Compose
* Make (optional for shortcuts)

#### Clone & Bootstrap
```bash
git clone https://github.com/your-org/n8n-ai.git
cd n8n-ai
corepack enable
pnpm install
cp .env.example .env
# Edit .env to add your AI provider API key (e.g., OpenAI)
docker compose up -d        # start n8n, redis, qdrant
pnpm -r run dev             # start orchestrator and panel in parallel
```
UI/services:
- `http://localhost:5678` – n8n
- `http://localhost:3000` – Orchestrator API
- `http://localhost:3001` – AI Panel (dev)

### 5.3 Running tests
```bash
pnpm test        # unit + lints
pnpm e2e         # orchestrator e2e; golden flows: pnpm -C examples test
```

### 5.4 API & ENV
- API: see `docs/API.md`
- ENV: see `docs/ENV.md`
- Deployment: see `DEPLOYMENT.md` and `docker-compose.yml`

### 5.5 Troubleshooting
- pnpm not found: `corepack enable && corepack prepare pnpm@8.15.0 --activate`.
- Node version: require Node ≥ 20 (`node -v`).
- Ports in use: adjust `.env` or exported env vars (`N8N_PORT`, `ORCH_PORT`).
- CORS: orchestrator enables CORS (`@fastify/cors`) for dev; if panel can’t reach API, check port 3000.

---

## 6. Development Workflow
| Stage | Tooling |
|-------|---------|
| Lint  | ESLint + Prettier (strict) |
| Types | TypeScript `strict` mode everywhere |
| Commits | Conventional Commits (`feat:`, `fix:`…) validated by `commitlint` |
| Branching | Trunk-based with short-lived feature branches + `/feature-flags` |
| CI | GitHub Actions: lint → unit → build → Validate/Simulate on golden flows |
| CD | Optional: PR auto-deploy to Preview stack |

### 6.1 Pull Request Checklist
1. Green CI.
2. Updated docs / schema migrations.
3. Added/updated tests.
4. Changelog entry.

---

## 7. Sprint Roadmap (12 weeks)
### Week 0 – Initialisation (1 week)
* Repos scaffold, pnpm workspace, docker-compose dev stack (n8n fork, orchestrator, redis, qdrant).
* ADR-001: high-level architecture.
* Baseline SGR schemas (Node, Graph, OperationBatch).

### Sprint 1 (Week 1-2) – Vertical Slice 0
* Introspect API v0 (static NodeDescription, no loadOptions).
* Graph Mutation API: `add_node`.
* OperationBatch validator in orchestrator.
* AI Panel MVP: Describe → HTTP GET node → visual diff (list) → Apply/Undo.
* 10 golden flows scripted; CI regression.

### Sprint 2 (Week 3-4) – Connections & Validation
* Graph ops: `connect`, `set_params`, `delete`, `annotate`.
* Pre-validation (types/enums/required) + lints v0 (missing trigger, dangling branches).
* Execution Events (SSE) stub.
* Canvas diff colours + “Changes” panel.

### Sprint 3 (Week 5-7) – Dynamics & Simulation
* Introspect v2: sandbox `loadOptions` with timeout/cache/ETag.
* Simulate API (dry-run) returning synthetic data shapes.
* Critic v1: auto-fix enum/required issues.
* `={{ }}` expression autocomplete stub.

### Sprint 4 (Week 8-9) – Workflow Map
* Dependency indexer (Execute Workflow, basic HTTP→Webhook heuristic).
* `/workflow-map` REST + `/live` WS endpoints.
* Map Tab with static view + live statuses.

### Sprint 5 (Week 10-11) – Governance, Git, Refactors
* Diff policies (whitelist limits), audit log (user/prompt/diff hash).
* Git integration: Apply → commit/PR, CI Validate/Simulate.
* Refactor ops: `replace_node`, `extract_subworkflow`, `optimize_batches`.

### Week 12 – Polish & Release
* Perf: schema cache, pre-warm hot nodes, trimming RAG context.
* UX: Secrets Wizard v1, Explain-node, map cost tooltips.
* Docs, demo video, upstream PRs for extension points.

---

## 8. API Surface
### 8.1 Introspect
`GET /introspect/nodes` → `NodeDescription[]`

### 8.2 Graph Mutation
`POST /graph/:id/batch` body = `OperationBatch` → `{ ok: true, undoId }`

### 8.3 Validate / Simulate
`POST /graph/:id/validate` → lint report
`POST /graph/:id/simulate` → dry-run stats

### 8.3.1 Audit & Metrics
`GET /audit/logs` → latest audit entries
`GET /metrics` → Prometheus metrics

Hooks API OpenAPI: `docs/OPENAPI.yaml`. Orchestrator (Planner) OpenAPI: `docs/OPENAPI.orchestrator.yaml`.

### 8.4 Events & Live Map
`/events` (SSE) → `workflow_start|finish|error`, `node_start|finish` …
`/workflow-map` → edges; `/workflow-map/live` (SSE) → live statuses/cost (basic)

---

## 9. Testing & QA
* Unit tests per package (`vitest`).
* Golden flows executed end-to-end via Playwright against local stack on every PR.
* Snapshot tests on OperationBatch diff rendering.
* Lint warnings must be ≤ defined budget.

---

## 10. Security & Governance
* **Credentials-only** – assistant sees only `credentialRef`.
* Diff policies – max nodes added, domain blacklist, mandatory trigger check.
* Audit: `userId`, `promptHash`, `diffHash`, model version, cost.
* Undo/Redo stored as diff stack, not graph snapshots.

---

## 11. Contribution Guide
1. Fork & clone.
2. `pnpm install && pnpm run dev`.
3. Follow Conventional Commits.
4. Write/extend tests.
5. Open PR → template will ask for architecture impact & docs links.

Please read `/docs/CONTRIBUTING.md` for full details.

---

## 12. License
* Core repositories follow the upstream n8n license (Apache-2.0) + additional notice for AI components.

---

## 13. Roadmap Beyond MVP
* Yield/Resume extension of Wait node.
* Advanced Workflow Map: SLA alerts, predictive cost estimator.
* Fine-tuning on anonymised public flows.
* Non-English prompt support (i18n).

---

_© 2024 n8n-ai project_