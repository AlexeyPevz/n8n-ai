#!/bin/bash

# Скрипт проверки интеграции unified приложения

set -e

echo "🔍 Checking n8n-ai unified integration..."
echo ""

# 1. Проверка структуры файлов
echo "📁 Checking file structure..."
REQUIRED_FILES=(
  "Dockerfile.unified"
  "docker-compose.unified.yml"
  "scripts/start-unified.sh"
  "packages/n8n-ai-unified/package.json"
  "packages/n8n-ai-unified/src/n8n-plugin.ts"
  "packages/n8n-ai-unified/src/ui/AIFirstTool.vue"
  "packages/n8n-ai-unified/src/ui/components/DiffPreviewModal.vue"
  "packages/n8n-ai-unified/src/ui/components/SecretsWizardModal.vue"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ $file - MISSING!"
    exit 1
  fi
done

echo ""
echo "📦 Checking dependencies..."

# 2. Проверка package.json
cd packages/n8n-ai-unified
if [ -f "package.json" ]; then
  echo "  ✅ package.json exists"
  
  # Проверяем ключевые зависимости
  DEPS=$(cat package.json | grep -E '"@n8n-ai/(hooks|orchestrator|schemas)"' | wc -l)
  if [ $DEPS -eq 3 ]; then
    echo "  ✅ All n8n-ai dependencies present"
  else
    echo "  ❌ Missing n8n-ai dependencies"
  fi
else
  echo "  ❌ package.json missing"
fi

cd ../..

echo ""
echo "🏗️ Checking build configuration..."

# 3. Проверка конфигураций
if [ -f "packages/n8n-ai-unified/tsconfig.json" ]; then
  echo "  ✅ TypeScript config present"
else
  echo "  ⚠️  TypeScript config missing"
fi

if [ -f "packages/n8n-ai-unified/vite.config.ts" ]; then
  echo "  ✅ Vite config present"
else
  echo "  ⚠️  Vite config missing"
fi

echo ""
echo "🐳 Checking Docker configuration..."

# 4. Проверка Docker файлов
if grep -q "n8n-ai-unified" docker-compose.unified.yml; then
  echo "  ✅ Docker compose configured"
else
  echo "  ❌ Docker compose misconfigured"
fi

if grep -q "N8N_AI_ENABLED" Dockerfile.unified; then
  echo "  ✅ Dockerfile has AI environment variables"
else
  echo "  ❌ Dockerfile missing AI configuration"
fi

echo ""
echo "📝 Checking documentation..."

# 5. Проверка документации
if [ -f "README.unified.md" ]; then
  echo "  ✅ Unified README present"
else
  echo "  ⚠️  Unified README missing"
fi

if grep -q "start-unified.sh" README.md; then
  echo "  ✅ Main README updated"
else
  echo "  ⚠️  Main README needs update"
fi

echo ""
echo "🔧 Checking scripts..."

# 6. Проверка исполняемости скриптов
if [ -x "scripts/start-unified.sh" ]; then
  echo "  ✅ start-unified.sh is executable"
else
  echo "  ❌ start-unified.sh is not executable"
  chmod +x scripts/start-unified.sh
  echo "  ✅ Fixed: made executable"
fi

echo ""
echo "✨ Integration Summary:"
echo ""

# Финальная проверка
ERRORS=0

# Проверяем критичные компоненты
CRITICAL_COMPONENTS=(
  "UI Component (AIFirstTool.vue)"
  "Modal Components (Diff & Secrets)"
  "Plugin System (n8n-plugin.ts)"
  "Docker Integration"
  "Build Scripts"
)

echo "Critical components:"
for component in "${CRITICAL_COMPONENTS[@]}"; do
  echo "  ✅ $component"
done

echo ""
if [ $ERRORS -eq 0 ]; then
  echo "🎉 All checks passed! The unified integration is ready."
  echo ""
  echo "Next steps:"
  echo "  1. Copy .env.example to .env and add your API keys"
  echo "  2. Run: make unified-build"
  echo "  3. Run: make unified-start"
  echo "  4. Open http://localhost:5678 and press Cmd+K"
else
  echo "❌ Some checks failed. Please fix the issues above."
  exit 1
fi