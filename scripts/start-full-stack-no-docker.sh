#!/bin/bash

# Запуск полного стека n8n-ai без Docker (для тестирования)

set -e

echo "🚀 Starting n8n-ai full stack (no Docker mode)..."

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Функция для остановки всех процессов
cleanup() {
    echo -e "\n${YELLOW}🛑 Stopping all services...${NC}"
    pkill -f "tsx.*test-server" 2>/dev/null || true
    pkill -f "vite.*preview" 2>/dev/null || true
    echo -e "${GREEN}✅ All services stopped${NC}"
    exit 0
}

trap cleanup INT TERM

# Проверяем переменные окружения
if [ ! -f .env ]; then
    echo -e "${YELLOW}📝 Creating .env file...${NC}"
    cat > .env << EOF
# Core
N8N_WEBHOOK_URL=http://localhost:5678
ORCH_PORT=3000
NODE_ENV=development

# RAG System (disabled without Docker)
RAG_ENABLED=false

# AI (will use pattern matching)
AI_PROVIDER=mock

# Features
WORKFLOW_MAP_ENABLED=true
AUDIT_LOG_ENABLED=true
EOF
fi

# Загружаем переменные
source .env

# Проверяем сборку
if [ ! -d "packages/n8n-ai-orchestrator/dist" ]; then
    echo -e "${YELLOW}🔨 Building packages...${NC}"
    pnpm build || {
        echo -e "${RED}❌ Build failed${NC}"
        exit 1
    }
fi

# Запускаем приложение
echo -e "\n${GREEN}🚀 Starting application...${NC}"

# Orchestrator
echo "   Starting Orchestrator (port 3000)..."
cd packages/n8n-ai-orchestrator
ORCH_PORT=3000 npx tsx src/test-server.ts &
ORCH_PID=$!
cd ../..

# UI Panel
echo "   Starting UI Panel (port 5173)..."
cd packages/n8n-ai-panel
npx vite preview --port 5173 &
UI_PID=$!
cd ../..

# Ждем запуска
echo "   Waiting for services to start..."
for i in {1..20}; do
    if curl -s http://localhost:3000/api/v1/ai/health > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

# Проверяем статус
echo -e "\n${GREEN}🎉 Services are running!${NC}"
echo ""
echo "📊 Status:"
echo -e "   • Orchestrator: ${GREEN}$(curl -s http://localhost:3000/api/v1/ai/health > /dev/null 2>&1 && echo '✓ Running' || echo '✗ Not running')${NC}"
echo -e "   • UI Panel:     ${GREEN}$(curl -s http://localhost:5173 > /dev/null 2>&1 && echo '✓ Running' || echo '✗ Not running')${NC}"
echo -e "   • RAG System:   ${YELLOW}⚠️  Disabled (Docker required)${NC}"
echo -e "   • AI Mode:      ${YELLOW}Pattern Matching (1268 patterns)${NC}"

echo ""
echo "🌐 Access points:"
echo "   • UI Panel:     http://localhost:5173"
echo "   • API Health:   http://localhost:3000/api/v1/ai/health"
echo ""
echo "💡 Try creating a workflow:"
echo '   curl -X POST http://localhost:3000/plan \'
echo '     -H "Content-Type: application/json" \'
echo '     -d '\''{"prompt": "Create webhook that sends data to Slack"}'\'''
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Ждем завершения
wait