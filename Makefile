.PHONY: help install dev test build clean docker-up docker-down docker-build

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies
	pnpm install

dev: ## Start development servers
	pnpm run dev

test: ## Run all tests
	pnpm test

test-schemas: ## Test schemas only
	pnpm -C packages/n8n-ai-schemas test

test-golden: ## Test golden flows
	cd examples && pnpm tsx test-golden-flows.ts

build: ## Build all packages
	pnpm run build

clean: ## Clean all build artifacts
	rm -rf packages/*/dist
	rm -rf packages/*/node_modules
	rm -rf node_modules

docker-up: ## Start docker services
	docker compose up -d

docker-down: ## Stop docker services
	docker compose down

docker-build: ## Build custom n8n image with AI hooks
	docker build -t n8n-ai-hooks:latest packages/n8n-ai-hooks/

docker-logs: ## Show docker logs
	docker compose logs -f

orchestrator-logs: ## Show orchestrator logs
	docker compose logs -f orchestrator

n8n-logs: ## Show n8n logs
	docker compose logs -f n8n

smoke: ## Run smoke checks (compose up, health, plan/apply/validate/simulate, workflow-map)
	docker compose up -d
	./scripts/wait-for-http.sh http://localhost:3000/api/v1/ai/health 60
	./scripts/wait-for-http.sh http://localhost:5678/api/v1/ai/health 60
	# Health
	curl -s http://localhost:3000/api/v1/ai/health | python3 -m json.tool
	# Introspect
	./scripts/wait-for-http.sh http://localhost:3000/introspect/nodes 60
	curl -s http://localhost:3000/introspect/nodes | python3 -m json.tool
	# Plan
	PLAN_RES=$$(curl -s -X POST http://localhost:3000/plan -H 'content-type: application/json' -d '{"prompt":"HTTP GET JSONPlaceholder"}') && echo $$PLAN_RES | python3 -m json.tool
	# Apply via REST alias
	APPLY_RES=$$(echo $$PLAN_RES | jq -c .); \
	curl -s -X POST http://localhost:3000/rest/ai/graph/demo/batch -H 'content-type: application/json' -d "$$APPLY_RES" | python3 -m json.tool
	# Validate (hooks proxy enabled by compose)
	curl -s -X POST 'http://localhost:3000/rest/ai/graph/demo/validate?autofix=1' -H 'content-type: application/json' -d '{}' | python3 -m json.tool
	# Simulate
	curl -s -X POST http://localhost:3000/rest/ai/graph/demo/simulate -H 'content-type: application/json' -d '{}' | python3 -m json.tool
	# Workflow map
	curl -s http://localhost:3000/workflow-map | python3 -m json.tool
	docker compose down

# Development shortcuts
dev-orchestrator: ## Start only orchestrator in dev mode
	pnpm -C packages/n8n-ai-orchestrator dev

dev-panel: ## Start only UI panel in dev mode
	pnpm -C packages/n8n-ai-panel dev

dev-schemas: ## Build schemas in watch mode
	pnpm -C packages/n8n-ai-schemas dev

# Testing shortcuts
curl-introspect: ## Test introspect API
	curl -s http://localhost:3000/introspect/nodes | python3 -m json.tool

curl-plan: ## Test plan API with sample prompt
	curl -s -X POST http://localhost:3000/plan \
		-H 'content-type: application/json' \
		-d '{"prompt":"Create HTTP GET request to fetch users"}' | python3 -m json.tool

curl-health: ## Check orchestrator health
	curl -s http://localhost:3000/api/v1/ai/health | python3 -m json.tool

# Unified app commands
unified-build: ## Build unified n8n with AI
	pnpm -C packages/n8n-ai-unified build

unified-start: ## Start unified n8n with AI
	./scripts/start-unified.sh

unified-docker-build: ## Build unified Docker image
	docker build -f Dockerfile.unified -t n8n-ai-unified:latest .

unified-docker-up: ## Start unified app with Docker
	docker-compose -f docker-compose.unified.yml up -d

unified-docker-down: ## Stop unified app
	docker-compose -f docker-compose.unified.yml down

unified-logs: ## Show unified app logs
	docker-compose -f docker-compose.unified.yml logs -f

# RAG commands
rag-populate: ## Populate RAG system with n8n documentation
	cd packages/n8n-ai-orchestrator && npx tsx scripts/populate-rag.ts

rag-start: ## Start Qdrant for RAG
	docker run -d --name qdrant -p 6333:6333 -v qdrant_storage:/qdrant/storage qdrant/qdrant

rag-stop: ## Stop Qdrant
	docker stop qdrant && docker rm qdrant