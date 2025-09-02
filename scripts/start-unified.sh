#!/bin/bash

# Скрипт для запуска единого n8n с AI функциями

echo "🚀 Starting unified n8n with AI features..."

# Проверяем наличие .env файла
if [ ! -f .env ]; then
    echo "📝 Creating .env file from example..."
    cat > .env << EOF
# n8n Configuration
N8N_PORT=5678
N8N_HOST=localhost
N8N_ENCRYPTION_KEY=your-encryption-key

# AI Configuration
N8N_AI_ENABLED=true
N8N_AI_ORCHESTRATOR_MODE=embedded
N8N_AI_UI_POSITION=bottom

# AI Providers (at least one required)
OPENAI_API_KEY=your-openai-key
# ANTHROPIC_API_KEY=your-anthropic-key
# OPENROUTER_API_KEY=your-openrouter-key

# Security
N8N_AI_API_TOKEN=your-api-token
JWT_SECRET=your-jwt-secret

# Optional Features
WORKFLOW_MAP_ENABLED=true
AUDIT_LOG_ENABLED=true
EOF
    echo "⚠️  Please edit .env file and add your API keys"
    exit 1
fi

# Загружаем переменные окружения
source .env

# Проверяем обязательные переменные
if [ -z "$OPENAI_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$OPENROUTER_API_KEY" ]; then
    echo "❌ Error: At least one AI provider API key is required"
    echo "Please set OPENAI_API_KEY, ANTHROPIC_API_KEY, or OPENROUTER_API_KEY in .env"
    exit 1
fi

# Билдим проект если нужно
if [ ! -d "packages/n8n-ai-unified/dist" ]; then
    echo "🔨 Building AI components..."
    pnpm install
    pnpm build
fi

# Запускаем docker-compose
echo "🐳 Starting services..."
docker-compose -f docker-compose.unified.yml up -d

# Ждем запуска
echo "⏳ Waiting for n8n to start..."
sleep 5

# Проверяем статус
if curl -s http://localhost:${N8N_PORT:-5678}/healthz > /dev/null; then
    echo "✅ n8n with AI is running!"
    echo ""
    echo "🌐 Open http://localhost:${N8N_PORT:-5678} in your browser"
    echo "🤖 Press Cmd+K to open AI assistant"
    echo ""
    echo "📚 Quick tips:"
    echo "  - Use natural language to create workflows"
    echo "  - Try: 'Create HTTP request to fetch weather data'"
    echo "  - Click 'Workflow Map' to see all workflows"
    echo ""
    echo "📋 Logs: docker-compose -f docker-compose.unified.yml logs -f"
else
    echo "❌ Failed to start n8n"
    echo "Check logs: docker-compose -f docker-compose.unified.yml logs"
    exit 1
fi