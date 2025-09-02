#!/bin/bash

# Запуск всех компонентов локально без Docker

echo "🚀 Starting n8n-ai components locally..."

# Функция для остановки всех процессов
cleanup() {
    echo ""
    echo "🛑 Stopping all services..."
    pkill -f "tsx.*test-server"
    pkill -f "vite.*preview"
    exit 0
}

# Устанавливаем обработчик для Ctrl+C
trap cleanup INT

# Проверяем сборку
if [ ! -d "packages/n8n-ai-orchestrator/dist" ]; then
    echo "🔨 Building packages..."
    pnpm build
fi

# Запускаем orchestrator
echo ""
echo "1️⃣ Starting Orchestrator API (port 3000)..."
cd packages/n8n-ai-orchestrator
ORCH_PORT=3000 npx tsx src/test-server.ts &
ORCH_PID=$!
cd ../..

# Ждем запуска orchestrator
echo "   Waiting for orchestrator..."
for i in {1..10}; do
    if curl -s http://localhost:3000/api/v1/ai/health > /dev/null 2>&1; then
        echo "   ✅ Orchestrator is ready!"
        break
    fi
    sleep 1
done

# Запускаем UI
echo ""
echo "2️⃣ Starting UI Panel (port 5173)..."
cd packages/n8n-ai-panel
npx vite preview --port 5173 &
UI_PID=$!
cd ../..

# Информация для пользователя
echo ""
echo "✅ All services started!"
echo ""
echo "🌐 Access points:"
echo "   - UI Panel: http://localhost:5173"
echo "   - API Health: http://localhost:3000/api/v1/ai/health"
echo ""
echo "📝 Test workflow creation:"
echo '   curl -X POST http://localhost:3000/plan \'
echo '     -H "Content-Type: application/json" \'
echo '     -d '\''{"prompt": "Create webhook that posts to Slack"}'\'''
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Ждем завершения
wait