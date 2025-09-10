#!/bin/bash

# Скрипт для запуска E2E тестов с сервером

set -e

echo "🚀 Starting orchestrator server for E2E tests..."

# Запускаем сервер в фоне
ORCH_PORT=3456 node dist/server.js &
SERVER_PID=$!

echo "   Server PID: $SERVER_PID"

# Ждем пока сервер запустится
echo "⏳ Waiting for server to start..."
for i in {1..30}; do
  if curl -s http://localhost:3456/api/v1/ai/health > /dev/null; then
    echo "✅ Server is ready!"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "❌ Server failed to start"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

# Запускаем тесты
echo "🧪 Running E2E tests..."
ORCH_PORT=3456 npx vitest run src/e2e.test.ts

# Сохраняем результат
TEST_RESULT=$?

# Останавливаем сервер
echo "🛑 Stopping server..."
kill $SERVER_PID 2>/dev/null || true

# Возвращаем результат тестов
exit $TEST_RESULT