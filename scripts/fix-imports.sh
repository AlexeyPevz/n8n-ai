#!/bin/bash

# Исправление импортов для ESM

echo "Fixing imports for ESM compatibility..."

cd /workspace/packages/n8n-ai-orchestrator/src

# Находим все импорты без .js расширения
FILES=$(grep -r "from '\./[^']*'" . --include="*.ts" | grep -v "\.js'" | cut -d: -f1 | sort -u)

for file in $FILES; do
    echo "Fixing imports in $file"
    # Заменяем импорты, добавляя .js
    sed -i "s/from '\.\//from '.\//" "$file"
    sed -i "s/\(from '[^']*\)'/\1.js'/g" "$file"
    # Исправляем двойные .js.js если появились
    sed -i "s/\.js\.js/\.js/g" "$file"
done

echo "Fixed imports in $(echo "$FILES" | wc -l) files"