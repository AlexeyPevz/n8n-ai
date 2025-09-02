#!/bin/bash

# Проверка документации

echo "📚 Documentation Review"
echo "====================="
echo ""

# Подсчет документов
TOTAL_DOCS=$(find docs -name "*.md" | wc -l)
MAIN_DOCS=$(find . -maxdepth 1 -name "*.md" | wc -l)

echo "📄 Documentation Files:"
echo "   Main directory: $MAIN_DOCS files"
echo "   Docs directory: $TOTAL_DOCS files"
echo ""

# Проверка основных документов
echo "✅ Main Documentation:"
[ -f "README.md" ] && echo "   ✓ README.md" || echo "   ✗ README.md missing"
[ -f "CHANGELOG.md" ] && echo "   ✓ CHANGELOG.md" || echo "   ✗ CHANGELOG.md missing"
[ -f ".env.example" ] && echo "   ✓ .env.example" || echo "   ✗ .env.example missing"

echo ""
echo "📖 Key Guides:"
[ -f "docs/QUICK_START.md" ] && echo "   ✓ Quick Start Guide" || echo "   ✗ Quick Start missing"
[ -f "docs/API_REFERENCE.md" ] && echo "   ✓ API Reference" || echo "   ✗ API Reference missing"
[ -f "docs/ARCHITECTURE.md" ] && echo "   ✓ Architecture Guide" || echo "   ✗ Architecture missing"
[ -f "docs/FAQ.md" ] && echo "   ✓ FAQ" || echo "   ✗ FAQ missing"
[ -f "docs/CURRENT_STATUS.md" ] && echo "   ✓ Current Status" || echo "   ✗ Status missing"

echo ""
echo "📊 Documentation Stats:"
# Подсчет строк документации
TOTAL_LINES=$(find . -name "*.md" -not -path "./node_modules/*" -exec wc -l {} + | tail -1 | awk '{print $1}')
echo "   Total lines: $TOTAL_LINES"

# Проверка на TODO в документации
TODO_COUNT=$(grep -r "TODO\|FIXME\|XXX" docs --include="*.md" | wc -l)
echo "   TODOs in docs: $TODO_COUNT"

# Проверка битых ссылок (простая проверка на .md файлы)
echo ""
echo "🔗 Checking internal links..."
BROKEN_LINKS=0
for file in docs/*.md README.md; do
    # Извлекаем ссылки на .md файлы
    links=$(grep -oE '\[.*\]\(\..*\.md[^)]*\)' "$file" | grep -oE '\(\..*\.md[^)]*\)' | tr -d '()')
    for link in $links; do
        # Убираем якоря
        link_file=$(echo "$link" | cut -d'#' -f1)
        # Проверяем существование файла
        if [[ ! -f "$link_file" ]] && [[ ! -f "$(dirname "$file")/$link_file" ]]; then
            echo "   ✗ Broken link in $file: $link"
            ((BROKEN_LINKS++))
        fi
    done
done

if [ $BROKEN_LINKS -eq 0 ]; then
    echo "   ✓ All internal links valid"
fi

echo ""
echo "📝 Documentation Coverage:"
# Проверка документации для каждого пакета
for pkg in packages/*/; do
    pkg_name=$(basename "$pkg")
    if [ -f "$pkg/README.md" ]; then
        echo "   ✓ $pkg_name has README"
    else
        echo "   ✗ $pkg_name missing README"
    fi
done

echo ""
echo "🎯 Summary:"
echo "   Total documentation files: $((TOTAL_DOCS + MAIN_DOCS))"
echo "   Total documentation lines: $TOTAL_LINES"
echo "   Documentation TODOs: $TODO_COUNT"
echo "   Broken internal links: $BROKEN_LINKS"

if [ $BROKEN_LINKS -eq 0 ] && [ $TODO_COUNT -lt 10 ]; then
    echo ""
    echo "✅ Documentation is in good shape!"
else
    echo ""
    echo "⚠️  Documentation needs attention"
fi