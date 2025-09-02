#!/bin/bash

# Глубокая проверка проекта - все аспекты

set -e

echo "🔍 DEEP PROJECT INSPECTION"
echo "=========================="
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Счетчики проблем
CRITICAL_ISSUES=0
WARNINGS=0
PASSED=0

# Функция для логирования
log_error() {
    echo -e "${RED}❌ $1${NC}"
    ((CRITICAL_ISSUES++))
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    ((WARNINGS++))
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED++))
}

# 1. ПРОВЕРКА СТРУКТУРЫ ПРОЕКТА
echo "1️⃣ PROJECT STRUCTURE CHECK"
echo "   ========================"

# Проверка обязательных файлов
REQUIRED_FILES=(
    "package.json"
    "pnpm-workspace.yaml"
    "tsconfig.base.json"
    "README.md"
    "Makefile"
    ".env.example"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "/workspace/$file" ]; then
        log_success "$file exists"
    else
        log_error "$file missing"
    fi
done

# Проверка структуры пакетов
echo ""
echo "   Package structure:"
for pkg in schemas hooks orchestrator panel unified; do
    PKG_PATH="/workspace/packages/n8n-ai-$pkg"
    if [ -d "$PKG_PATH" ]; then
        # Проверка обязательных файлов пакета
        if [ -f "$PKG_PATH/package.json" ] && [ -f "$PKG_PATH/tsconfig.json" ]; then
            log_success "n8n-ai-$pkg structure OK"
        else
            log_error "n8n-ai-$pkg missing required files"
        fi
    else
        log_error "n8n-ai-$pkg directory missing"
    fi
done

# 2. ПРОВЕРКА ЗАВИСИМОСТЕЙ
echo ""
echo "2️⃣ DEPENDENCY CHECK"
echo "   ================="

# Проверка установленных зависимостей
cd /workspace
if [ -d "node_modules" ]; then
    log_success "Root node_modules exists"
else
    log_error "Root node_modules missing - run pnpm install"
fi

# Проверка версий
echo ""
echo "   Node/pnpm versions:"
NODE_VERSION=$(node --version)
PNPM_VERSION=$(pnpm --version 2>/dev/null || echo "not installed")
echo "   Node: $NODE_VERSION"
echo "   pnpm: $PNPM_VERSION"

# Проверка pnpm lock файла
if [ -f "/workspace/pnpm-lock.yaml" ]; then
    log_success "pnpm-lock.yaml exists"
else
    log_warning "pnpm-lock.yaml missing"
fi

# 3. ПРОВЕРКА КОМПИЛЯЦИИ TYPESCRIPT
echo ""
echo "3️⃣ TYPESCRIPT COMPILATION CHECK"
echo "   ============================"

cd /workspace
for pkg in schemas hooks orchestrator panel unified; do
    PKG_PATH="packages/n8n-ai-$pkg"
    if [ -d "$PKG_PATH" ]; then
        echo -n "   Checking $pkg... "
        if cd "$PKG_PATH" && npx tsc --noEmit --skipLibCheck 2>/tmp/tsc-$pkg.log; then
            log_success "$pkg compiles without errors"
        else
            ERROR_COUNT=$(grep -c "error TS" /tmp/tsc-$pkg.log || echo "0")
            if [ "$ERROR_COUNT" -gt 0 ]; then
                log_error "$pkg has $ERROR_COUNT TypeScript errors"
                echo "   First 3 errors:"
                grep "error TS" /tmp/tsc-$pkg.log | head -3 | sed 's/^/     /'
            else
                log_warning "$pkg compilation issues (check /tmp/tsc-$pkg.log)"
            fi
        fi
        cd /workspace
    fi
done

# 4. ПРОВЕРКА СБОРКИ
echo ""
echo "4️⃣ BUILD CHECK"
echo "   ============"

cd /workspace
echo "   Running pnpm build..."
if pnpm build > /tmp/build-full.log 2>&1; then
    log_success "Full build successful"
    
    # Проверка dist директорий
    echo ""
    echo "   Checking build outputs:"
    for pkg in schemas hooks orchestrator panel unified; do
        DIST_PATH="packages/n8n-ai-$pkg/dist"
        if [ -d "$DIST_PATH" ]; then
            FILE_COUNT=$(find "$DIST_PATH" -type f -name "*.js" -o -name "*.d.ts" | wc -l)
            if [ "$FILE_COUNT" -gt 0 ]; then
                log_success "n8n-ai-$pkg: $FILE_COUNT output files"
            else
                log_error "n8n-ai-$pkg: no JS/TS files in dist"
            fi
        else
            log_error "n8n-ai-$pkg: no dist directory"
        fi
    done
else
    log_error "Build failed"
    echo "   Last 10 lines of build log:"
    tail -10 /tmp/build-full.log | sed 's/^/   /'
fi

# 5. ПРОВЕРКА UNIFIED ИНТЕГРАЦИИ
echo ""
echo "5️⃣ UNIFIED INTEGRATION CHECK"
echo "   ========================="

UNIFIED_PATH="/workspace/packages/n8n-ai-unified"
if [ -d "$UNIFIED_PATH/dist" ]; then
    # Проверка plugin файлов
    if [ -f "$UNIFIED_PATH/dist/n8n-ai-unified/src/n8n-plugin.js" ]; then
        log_success "n8n-plugin.js built"
    else
        log_error "n8n-plugin.js not found"
    fi
    
    # Проверка UI файлов
    if [ -f "$UNIFIED_PATH/dist/n8n-ai-panel.es.js" ]; then
        log_success "UI bundle built"
    else
        log_error "UI bundle not found"
    fi
    
    # Проверка embedded orchestrator
    if [ -f "$UNIFIED_PATH/dist/n8n-ai-unified/src/embedded-orchestrator.js" ]; then
        log_success "embedded-orchestrator.js built"
    else
        log_error "embedded-orchestrator.js not found"
    fi
else
    log_error "Unified dist directory missing"
fi

# 6. ПРОВЕРКА ТЕСТОВ
echo ""
echo "6️⃣ TEST SUITE CHECK"
echo "   ================"

# Запуск тестов для каждого пакета
for pkg in schemas hooks orchestrator; do
    echo ""
    echo "   Testing n8n-ai-$pkg:"
    cd "/workspace/packages/n8n-ai-$pkg"
    
    if [ -f "package.json" ] && grep -q '"test"' package.json; then
        if pnpm test 2>&1 | grep -q "Test Files.*passed"; then
            log_success "$pkg tests pass"
        else
            log_warning "$pkg tests have failures"
        fi
    else
        log_warning "$pkg has no test script"
    fi
done

# 7. ПРОВЕРКА БЕЗОПАСНОСТИ
echo ""
echo "7️⃣ SECURITY CHECK"
echo "   =============="

cd /workspace

# Проверка exec вызовов
UNSAFE_EXEC=$(grep -r "exec(" packages/ --include="*.ts" --include="*.js" | grep -v "execFile" | grep -v "test" | grep -v "mock" | wc -l)
if [ "$UNSAFE_EXEC" -eq 0 ]; then
    log_success "No unsafe exec() calls"
else
    log_error "Found $UNSAFE_EXEC unsafe exec() calls"
    grep -r "exec(" packages/ --include="*.ts" --include="*.js" | grep -v "execFile" | grep -v "test" | head -3
fi

# Проверка hardcoded credentials
HARDCODED=$(grep -r "password\|secret\|token" packages/ --include="*.ts" | grep -v "test" | grep -v "interface" | grep -v "type" | grep "=" | grep -E '"[^"]+"' | wc -l)
if [ "$HARDCODED" -eq 0 ]; then
    log_success "No hardcoded credentials found"
else
    log_warning "Potential hardcoded credentials: $HARDCODED occurrences"
fi

# 8. ПРОВЕРКА ENV КОНФИГУРАЦИИ
echo ""
echo "8️⃣ ENVIRONMENT CONFIG CHECK"
echo "   ========================"

if [ -f "/workspace/.env.example" ]; then
    log_success ".env.example exists"
    
    # Проверка обязательных переменных
    REQUIRED_VARS=(
        "ORCH_PORT"
        "N8N_WEBHOOK_URL"
        "NODE_ENV"
    )
    
    for var in "${REQUIRED_VARS[@]}"; do
        if grep -q "^$var=" /workspace/.env.example; then
            log_success "$var defined in .env.example"
        else
            log_warning "$var missing from .env.example"
        fi
    done
fi

# 9. ПРОВЕРКА DOCKER
echo ""
echo "9️⃣ DOCKER CHECK"
echo "   ============"

if [ -f "/workspace/docker-compose.yml" ]; then
    log_success "docker-compose.yml exists"
fi

if [ -f "/workspace/Dockerfile.unified" ]; then
    log_success "Dockerfile.unified exists"
fi

# 10. ПРОВЕРКА API ENDPOINTS
echo ""
echo "🔟 API ENDPOINT CHECK"
echo "   =================="

# Проверка определения роутов
cd /workspace
ROUTES=$(grep -r "router\.\|server\.\|app\." packages/ --include="*.ts" | grep -E "(get|post|put|delete|patch)\(" | wc -l)
echo "   Found $ROUTES API route definitions"

if [ "$ROUTES" -gt 20 ]; then
    log_success "API routes defined"
else
    log_warning "Few API routes found"
fi

# ФИНАЛЬНЫЙ ОТЧЕТ
echo ""
echo "📊 DEEP CHECK SUMMARY"
echo "===================="
echo ""
echo "Passed checks: $PASSED"
echo "Warnings: $WARNINGS" 
echo "Critical issues: $CRITICAL_ISSUES"
echo ""

if [ "$CRITICAL_ISSUES" -eq 0 ]; then
    echo -e "${GREEN}✅ NO CRITICAL ISSUES FOUND${NC}"
    echo ""
    echo "Project appears to be properly configured and built."
else
    echo -e "${RED}❌ FOUND $CRITICAL_ISSUES CRITICAL ISSUES${NC}"
    echo ""
    echo "These issues must be fixed before the project can be used."
fi

if [ "$WARNINGS" -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}⚠️  $WARNINGS warnings should be reviewed${NC}"
fi

# Детальная проверка реальной интеграции
echo ""
echo "🔗 REAL INTEGRATION CHECK"
echo "========================"

# Проверка использования n8n типов
N8N_IMPORTS=$(grep -r "from 'n8n-" packages/ --include="*.ts" | grep -v "node_modules" | wc -l)
if [ "$N8N_IMPORTS" -gt 0 ]; then
    log_success "Found $N8N_IMPORTS imports from n8n packages"
else
    log_error "No n8n package imports found"
fi

# Проверка stubs/mocks
STUB_COUNT=$(grep -r "stub\|mock\|TODO.*stub" packages/ --include="*.ts" | grep -v "test" | wc -l)
if [ "$STUB_COUNT" -lt 5 ]; then
    log_success "Minimal stubs found ($STUB_COUNT)"
else
    log_warning "Many stubs/mocks found ($STUB_COUNT) - check if real integration"
fi

exit $CRITICAL_ISSUES