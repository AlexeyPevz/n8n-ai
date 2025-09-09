#!/bin/bash

# Запуск единого приложения локально (эмуляция unified режима)

echo "🚀 Starting unified n8n-ai application..."

# Проверяем переменные окружения
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# Core
N8N_WEBHOOK_URL=http://localhost:5678
ORCH_PORT=3456
NODE_ENV=development

# AI (optional - will use mock if not set)
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=your-key-here

# Features
N8N_AI_ENABLED=true
WORKFLOW_MAP_ENABLED=true
EOF
    echo "ℹ️  Created .env file. Add API keys if you want AI features."
fi

# Загружаем переменные
if [ -f .env ]; then
    source .env
fi

# Проверяем сборку
if [ ! -d "packages/n8n-ai-unified/dist" ]; then
    echo "🔨 Building unified package..."
    cd packages/n8n-ai-unified
    pnpm build 2>/dev/null || echo "⚠️  Unified build has issues, using separate components"
    cd ../..
fi

# Функция остановки
cleanup() {
    echo ""
    echo "🛑 Stopping unified application..."
    pkill -f "node.*unified"
    pkill -f "tsx.*embedded"
    exit 0
}

trap cleanup INT

# Запускаем embedded orchestrator
echo ""
echo "🎯 Starting embedded orchestrator..."
cd packages/n8n-ai-unified
node dist/n8n-ai-unified/src/embedded-orchestrator.js 2>/dev/null &
ORCH_PID=$!

# Если не работает, запускаем обычный
if ! kill -0 $ORCH_PID 2>/dev/null; then
    echo "   Falling back to standalone orchestrator..."
    cd ../n8n-ai-orchestrator
    npx tsx src/test-server.ts &
    ORCH_PID=$!
fi
cd ../..

# Запускаем unified UI
echo "🖼️  Starting unified UI..."
cd packages/n8n-ai-panel
npx vite preview --port 5678 --open &
UI_PID=$!
cd ../..

# Ждем запуска
sleep 3

echo ""
echo "✨ Unified n8n-ai is running!"
echo ""
echo "🌐 Open http://localhost:5678 in your browser"
echo ""
echo "🤖 Features available:"
echo "   - Natural language workflow creation"
echo "   - Visual workflow builder"
echo "   - Node explanations"
echo "   - Workflow map"
echo ""
echo "💡 Try these commands:"
echo '   - "Create a webhook that posts to Slack"'
echo '   - "Add HTTP request to fetch weather data"'
echo '   - "Build workflow for daily reports"'
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Проверяем здоровье
if curl -s http://localhost:3456/api/v1/ai/health > /dev/null 2>&1 || \
   curl -s http://localhost:3000/api/v1/ai/health > /dev/null 2>&1; then
    echo "✅ API is healthy"
else
    echo "⚠️  API may not be fully initialized yet"
fi

# Ждем
wait