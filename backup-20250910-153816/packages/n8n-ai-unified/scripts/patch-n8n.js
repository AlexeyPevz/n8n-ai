#!/usr/bin/env node

/**
 * Патчит n8n для интеграции AI функционала
 * Этот скрипт модифицирует n8n для загрузки AI плагина
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Patching n8n for AI integration...');

// 1. Находим n8n установку
const n8nPath = process.env.N8N_PATH || '/usr/local/lib/node_modules/n8n';
const n8nCliPath = path.join(n8nPath, 'dist/src/commands/start.js');

if (!fs.existsSync(n8nCliPath)) {
  console.error('❌ n8n installation not found at:', n8nPath);
  console.log('Set N8N_PATH environment variable to n8n installation directory');
  process.exit(1);
}

// 2. Читаем оригинальный файл
const originalContent = fs.readFileSync(n8nCliPath, 'utf8');

// 3. Проверяем, не пропатчен ли уже
if (originalContent.includes('n8n-ai-plugin')) {
  console.log('✅ n8n already patched');
  process.exit(0);
}

// 4. Находим место для вставки (после инициализации express app)
const insertAfter = 'const app = express();';
const insertIndex = originalContent.indexOf(insertAfter);

if (insertIndex === -1) {
  console.error('❌ Could not find insertion point in n8n start command');
  process.exit(1);
}

// 5. Код для вставки
const aiPluginCode = `
// n8n AI Plugin Integration
if (process.env.N8N_AI_ENABLED === 'true') {
  try {
    const { setupN8nAI } = require('@n8n-ai/unified');
    setupN8nAI(app, {
      orchestratorMode: process.env.N8N_AI_ORCHESTRATOR_MODE || 'embedded',
      orchestratorUrl: process.env.N8N_AI_ORCHESTRATOR_URL,
      uiPosition: process.env.N8N_AI_UI_POSITION || 'bottom'
    });
    console.log('✅ n8n AI features enabled');
  } catch (error) {
    console.error('❌ Failed to load n8n AI plugin:', error.message);
  }
}
`;

// 6. Вставляем код
const modifiedContent = 
  originalContent.slice(0, insertIndex + insertAfter.length) +
  '\n' + aiPluginCode +
  originalContent.slice(insertIndex + insertAfter.length);

// 7. Делаем бэкап
const backupPath = n8nCliPath + '.backup';
if (!fs.existsSync(backupPath)) {
  fs.writeFileSync(backupPath, originalContent);
  console.log('📦 Created backup at:', backupPath);
}

// 8. Записываем модифицированный файл
fs.writeFileSync(n8nCliPath, modifiedContent);
console.log('✅ Successfully patched n8n');

// 9. Патчим package.json для добавления зависимости
const n8nPackageJsonPath = path.join(n8nPath, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(n8nPackageJsonPath, 'utf8'));

if (!packageJson.dependencies['@n8n-ai/unified']) {
  packageJson.dependencies['@n8n-ai/unified'] = 'file:../n8n-ai/packages/n8n-ai-unified';
  fs.writeFileSync(n8nPackageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('✅ Added AI dependency to n8n package.json');
}

// 10. Патчим UI для добавления AI компонента
const n8nEditorPath = path.join(n8nPath, 'packages/editor-ui/src/App.vue');
if (fs.existsSync(n8nEditorPath)) {
  const editorContent = fs.readFileSync(n8nEditorPath, 'utf8');
  
  if (!editorContent.includes('AIFirstTool')) {
    // Добавляем импорт
    const importInsert = "import { defineComponent } from 'vue';";
    const importIndex = editorContent.indexOf(importInsert);
    
    const aiImport = "\nimport AIFirstTool from '@n8n-ai/unified/ui/AIFirstTool.vue';";
    
    // Добавляем компонент в template
    const templateInsert = '</div>\n</template>';
    const templateIndex = editorContent.lastIndexOf(templateInsert);
    
    const aiComponent = '\n\t\t<AIFirstTool v-if="aiEnabled" />\n\t';
    
    let modifiedEditor = editorContent;
    
    if (importIndex !== -1) {
      modifiedEditor = 
        modifiedEditor.slice(0, importIndex + importInsert.length) +
        aiImport +
        modifiedEditor.slice(importIndex + importInsert.length);
    }
    
    if (templateIndex !== -1) {
      modifiedEditor = 
        modifiedEditor.slice(0, templateIndex) +
        aiComponent +
        modifiedEditor.slice(templateIndex);
    }
    
    // Добавляем в components
    const componentsMatch = modifiedEditor.match(/components:\s*{([^}]+)}/);
    if (componentsMatch) {
      const componentsContent = componentsMatch[1];
      if (!componentsContent.includes('AIFirstTool')) {
        const newComponents = componentsContent + ',\n\t\tAIFirstTool';
        modifiedEditor = modifiedEditor.replace(
          /components:\s*{[^}]+}/,
          `components: {${newComponents}}`
        );
      }
    }
    
    // Добавляем computed для aiEnabled
    const computedMatch = modifiedEditor.match(/computed:\s*{([^}]+)}/);
    if (computedMatch) {
      const computedContent = computedMatch[1];
      if (!computedContent.includes('aiEnabled')) {
        const newComputed = computedContent + `,
    aiEnabled() {
      return this.$store.getters['settings/isAiEnabled'];
    }`;
        modifiedEditor = modifiedEditor.replace(
          /computed:\s*{[^}]+}/,
          `computed: {${newComputed}}`
        );
      }
    }
    
    fs.writeFileSync(n8nEditorPath, modifiedEditor);
    console.log('✅ Patched n8n editor UI');
  }
}

console.log(`
🎉 n8n patching complete!

To enable AI features, set these environment variables:
  N8N_AI_ENABLED=true
  N8N_AI_ORCHESTRATOR_MODE=embedded  # or 'external'
  OPENAI_API_KEY=your-key-here

Then restart n8n.
`);