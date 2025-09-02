#!/bin/bash

# Проверка актуальности документации

echo "🔍 Checking for outdated documentation..."
echo "========================================"
echo ""

# Проверка дат в документах
echo "📅 Checking dates in documents..."
echo ""

# Ищем старые даты (до сентября 2025)
OLD_DATES=$(grep -r "2024\|2023\|January 2025\|February 2025\|March 2025\|April 2025\|May 2025\|June 2025\|July 2025\|August 2025" docs/ --include="*.md" || true)
if [ -n "$OLD_DATES" ]; then
    echo "⚠️  Found potentially old dates:"
    echo "$OLD_DATES" | head -10
else
    echo "✅ No old dates found"
fi

echo ""
echo "📦 Checking Sprint documents..."
# Проверка Sprint документов (они могут быть устаревшими)
SPRINT_DOCS=$(ls docs/SPRINT*.md 2>/dev/null || true)
if [ -n "$SPRINT_DOCS" ]; then
    echo "Found sprint documents (may be historical):"
    for doc in $SPRINT_DOCS; do
        echo "  - $doc"
    done
fi

echo ""
echo "🔗 Checking API endpoints against code..."

# Проверка соответствия API endpoints
DOCUMENTED_ENDPOINTS=$(grep -E "(GET|POST|PUT|DELETE) /" docs/API*.md | grep -oE "/(api/)?[a-zA-Z0-9/_-]+" | sort -u)
CODE_ENDPOINTS=$(grep -r "router\.\|server\.\|app\." packages/*/src --include="*.ts" | grep -E "(get|post|put|delete)\(" | grep -oE "'/[^']*'" | tr -d "'" | sort -u)

echo "Documented endpoints: $(echo "$DOCUMENTED_ENDPOINTS" | wc -l)"
echo "Code endpoints: $(echo "$CODE_ENDPOINTS" | wc -l)"

echo ""
echo "🚨 Checking for deprecated features..."

# Проверка упоминаний устаревших фич
DEPRECATED=$(grep -r "fork\|n8n fork\|four terminals\|four windows" docs/ --include="*.md" | grep -v "historical" || true)
if [ -n "$DEPRECATED" ]; then
    echo "⚠️  Found references to deprecated approach:"
    echo "$DEPRECATED" | head -5
else
    echo "✅ No deprecated features mentioned"
fi

echo ""
echo "📝 Checking package.json versions..."

# Сравнение версий в документации и package.json
MAIN_VERSION=$(grep '"version"' package.json | grep -oE "[0-9]+\.[0-9]+\.[0-9]+")
DOC_VERSIONS=$(grep -r "version.*[0-9]\+\.[0-9]\+\.[0-9]\+" docs/ --include="*.md" | grep -oE "[0-9]+\.[0-9]+\.[0-9]+" | sort -u)

echo "Main package version: $MAIN_VERSION"
echo "Versions mentioned in docs: $DOC_VERSIONS"

echo ""
echo "🔍 Checking for outdated examples..."

# Проверка примеров кода на устаревший синтаксис
OLD_IMPORTS=$(grep -r "from '\./.*'" docs/ --include="*.md" | grep -v "\.js'" || true)
if [ -n "$OLD_IMPORTS" ]; then
    echo "⚠️  Found imports without .js extension:"
    echo "$OLD_IMPORTS" | head -3
fi

echo ""
echo "📊 Checking for stub/mock references..."

# Проверка упоминаний заглушек (которые мы удалили)
STUBS=$(grep -r "stub\|mock\|заглушк" docs/ --include="*.md" | grep -v "no stubs\|removed stubs\|without stubs" || true)
if [ -n "$STUBS" ]; then
    echo "⚠️  Found references to stubs/mocks:"
    echo "$STUBS" | head -5
else
    echo "✅ No problematic stub references"
fi

echo ""
echo "🏗️ Checking architecture references..."

# Проверка устаревших архитектурных решений
OLD_ARCH=$(grep -r "microservices\|separate services\|multiple ports" docs/ --include="*.md" | grep -v "unified\|single" || true)
if [ -n "$OLD_ARCH" ]; then
    echo "⚠️  Found references to old architecture:"
    echo "$OLD_ARCH" | head -5
fi

echo ""
echo "📈 Summary of potential issues:"
echo "================================"

ISSUES=0

[ -n "$OLD_DATES" ] && echo "- Old dates found" && ((ISSUES++))
[ -n "$DEPRECATED" ] && echo "- Deprecated features mentioned" && ((ISSUES++))
[ -n "$OLD_IMPORTS" ] && echo "- Outdated import examples" && ((ISSUES++))
[ -n "$STUBS" ] && echo "- Stub/mock references" && ((ISSUES++))
[ -n "$OLD_ARCH" ] && echo "- Old architecture references" && ((ISSUES++))

if [ $ISSUES -eq 0 ]; then
    echo "✅ No major outdated documentation found!"
else
    echo ""
    echo "⚠️  Found $ISSUES potential issues to review"
fi