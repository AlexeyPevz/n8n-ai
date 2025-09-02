#!/bin/bash

# Запуск полного стека n8n-ai с RAG системой

set -e

echo "🚀 Starting n8n-ai full stack with RAG..."

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Функция для остановки всех процессов
cleanup() {
    echo -e "\n${YELLOW}🛑 Stopping all services...${NC}"
    
    # Останавливаем процессы
    pkill -f "tsx.*test-server" 2>/dev/null || true
    pkill -f "vite.*preview" 2>/dev/null || true
    
    # Останавливаем Docker контейнеры
    docker stop qdrant 2>/dev/null || true
    docker stop redis 2>/dev/null || true
    
    echo -e "${GREEN}✅ All services stopped${NC}"
    exit 0
}

trap cleanup INT TERM

# Проверяем Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is required but not installed${NC}"
    exit 1
fi

# Проверяем переменные окружения
if [ ! -f .env ]; then
    echo -e "${YELLOW}📝 Creating .env file...${NC}"
    cat > .env << EOF
# Core
N8N_WEBHOOK_URL=http://localhost:5678
ORCH_PORT=3000
NODE_ENV=development

# RAG System
QDRANT_URL=http://localhost:6333
RAG_ENABLED=true

# AI (optional - will use patterns if not set)
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=your-key-here

# Features
WORKFLOW_MAP_ENABLED=true
AUDIT_LOG_ENABLED=true
EOF
    echo -e "${YELLOW}⚠️  Created .env file. Add API keys for AI features.${NC}"
fi

# Загружаем переменные
source .env

# 1. Запускаем инфраструктуру
echo -e "\n${GREEN}1️⃣ Starting infrastructure...${NC}"

# Redis
if ! docker ps | grep -q redis; then
    echo "   Starting Redis..."
    docker run -d --name redis -p 6379:6379 redis:7-alpine \
        --health-cmd "redis-cli ping" \
        --health-interval 5s
fi

# Qdrant
if ! docker ps | grep -q qdrant; then
    echo "   Starting Qdrant..."
    docker run -d --name qdrant -p 6333:6333 \
        -v qdrant_storage:/qdrant/storage \
        qdrant/qdrant
fi

# Ждем готовности
echo "   Waiting for services..."
for i in {1..30}; do
    if curl -s http://localhost:6333/readyz > /dev/null 2>&1 && \
       docker exec redis redis-cli ping > /dev/null 2>&1; then
        echo -e "   ${GREEN}✅ Infrastructure ready!${NC}"
        break
    fi
    sleep 1
done

# 2. Проверяем и заполняем RAG
echo -e "\n${GREEN}2️⃣ Checking RAG system...${NC}"
RAG_STATUS=$(curl -s http://localhost:6333/collections | grep -o "n8n-knowledge" || echo "empty")

if [ "$RAG_STATUS" = "empty" ]; then
    echo -e "   ${YELLOW}RAG is empty. Populating...${NC}"
    
    # Проверяем сборку
    if [ ! -d "packages/n8n-ai-orchestrator/dist" ]; then
        echo "   Building packages first..."
        pnpm build
    fi
    
    # Заполняем RAG
    cd packages/n8n-ai-orchestrator
    npx tsx scripts/populate-rag.ts || {
        echo -e "   ${YELLOW}⚠️  RAG population failed. Continuing without RAG.${NC}"
    }
    cd ../..
else
    echo -e "   ${GREEN}✅ RAG already populated${NC}"
fi

# 3. Запускаем приложение
echo -e "\n${GREEN}3️⃣ Starting application...${NC}"

# Orchestrator с RAG
echo "   Starting Orchestrator (port 3000)..."
cd packages/n8n-ai-orchestrator
QDRANT_URL=http://localhost:6333 \
RAG_ENABLED=true \
REDIS_URL=redis://localhost:6379 \
npx tsx src/test-server.ts &
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
for i in {1..10}; do
    if curl -s http://localhost:3000/api/v1/ai/health > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

# 4. Проверяем статус
echo -e "\n${GREEN}🎉 Full stack is running!${NC}"
echo ""
echo "📊 Services status:"
echo -e "   • Redis:       ${GREEN}$(docker ps | grep -q redis && echo '✓ Running' || echo '✗ Not running')${NC}"
echo -e "   • Qdrant:      ${GREEN}$(docker ps | grep -q qdrant && echo '✓ Running' || echo '✗ Not running')${NC}"
echo -e "   • RAG System:  ${GREEN}$([ "$RAG_STATUS" != "empty" ] && echo '✓ Populated' || echo '✗ Empty')${NC}"
echo -e "   • Orchestrator:${GREEN}$(curl -s http://localhost:3000/api/v1/ai/health > /dev/null 2>&1 && echo '✓ Running' || echo '✗ Not running')${NC}"
echo -e "   • UI Panel:    ${GREEN}$(curl -s http://localhost:5173 > /dev/null 2>&1 && echo '✓ Running' || echo '✗ Not running')${NC}"

echo ""
echo "🌐 Access points:"
echo "   • UI Panel:     http://localhost:5173"
echo "   • API Docs:     http://localhost:3000/docs"
echo "   • Health Check: http://localhost:3000/api/v1/ai/health"
echo "   • Qdrant UI:    http://localhost:6333/dashboard"
echo ""
echo "💡 Quick tests:"
echo "   # Check RAG search:"
echo '   curl -X POST http://localhost:3000/api/v1/ai/rag/search \'
echo '     -H "Content-Type: application/json" \'
echo '     -d '\''{"query": "HTTP request node"}'\'''
echo ""
echo "   # Create workflow with RAG context:"
echo '   curl -X POST http://localhost:3000/plan \'
echo '     -H "Content-Type: application/json" \'
echo '     -d '\''{"prompt": "Create workflow to fetch data from API daily"}'\'''
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Ждем завершения
wait