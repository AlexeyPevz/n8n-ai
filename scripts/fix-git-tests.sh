#!/bin/bash

# Исправляем git-integration тесты для работы с execFile

cd /workspace/packages/n8n-ai-orchestrator

# Заменяем все mockExec на mockExecFile в тестах
sed -i 's/const mockExec = vi.mocked(exec);/const mockExecFile = vi.mocked(execFile);/g' src/git/git-integration.test.ts

# Заменяем mockExec на mockExecFile
sed -i 's/mockExec\./mockExecFile./g' src/git/git-integration.test.ts
sed -i 's/expect(mockExec)/expect(mockExecFile)/g' src/git/git-integration.test.ts

# Обновляем вызовы для execFile (с аргументами массивом)
# git init
sed -i "s/toHaveBeenCalledWith([[:space:]]*'git init',/toHaveBeenCalledWith(\n        'git',\n        ['init'],/g" src/git/git-integration.test.ts

# git add
sed -i "s/'git add workflows\/test-workflow.json'/'git', ['add', 'workflows\/test-workflow.json']/g" src/git/git-integration.test.ts

# git commit
sed -i "s/'git commit -m \"/'git', ['commit', '-m', '/g" src/git/git-integration.test.ts
sed -i 's/""/]/g' src/git/git-integration.test.ts

# git checkout
sed -i "s/'git checkout -b ai\//'git', ['checkout', '-b', 'ai\//g" src/git/git-integration.test.ts
sed -i "s/'git checkout main'/'git', ['checkout', 'main']/g" src/git/git-integration.test.ts

# gh pr create - более сложный
sed -i "s/'gh pr create --title \"Test PR\" --body \"Test Body\" --head ai\/test-workflow-/'gh', ['pr', 'create', '--title', 'Test PR', '--body', 'Test Body', '--head', 'ai\/test-workflow-/g" src/git/git-integration.test.ts

echo "Git tests fixed for execFile"