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

smoke: ## Run smoke checks (docker-compose up, health, introspect)
	docker compose up -d
	./scripts/wait-for-http.sh http://localhost:3000/api/v1/ai/health 60
	curl -s http://localhost:3000/api/v1/ai/health | python3 -m json.tool
	./scripts/wait-for-http.sh http://localhost:3000/introspect/nodes 60
	curl -s http://localhost:3000/introspect/nodes | python3 -m json.tool
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