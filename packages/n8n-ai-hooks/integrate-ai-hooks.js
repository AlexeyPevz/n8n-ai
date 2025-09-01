/**
 * Скрипт для интеграции AI hooks в запущенный n8n
 * Этот скрипт модифицирует n8n для добавления наших API endpoints
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Integrating n8n-ai hooks...');

// Путь к основному файлу сервера n8n
const serverPath = '/usr/local/lib/node_modules/n8n/dist/Server.js';

// Проверяем существование файла
if (!fs.existsSync(serverPath)) {
  console.error('❌ n8n Server.js not found at expected path');
  process.exit(1);
}

// Создаем патч-файл с нашими роутами
const patchContent = `
// n8n-ai hooks integration
try {
  const { createAIRoutes } = require('/opt/n8n-ai-hooks/dist/src/ai-routes.js');
  const { introspectAPI } = require('/opt/n8n-ai-hooks/dist/src/introspect-api.js');
  
  // Добавляем middleware для регистрации AI routes
  const originalListen = this.app.listen;
  this.app.listen = function(...args) {
    console.log('🤖 Registering n8n-ai routes...');
    
    // Регистрируем AI routes
    const aiRoutes = createAIRoutes();
    this.use(aiRoutes);
    
    console.log('✅ n8n-ai routes registered');
    
    // Вызываем оригинальный listen
    return originalListen.apply(this, args);
  };
  
  console.log('✅ n8n-ai hooks integrated successfully');
} catch (error) {
  console.error('❌ Failed to integrate n8n-ai hooks:', error);
}
`;

// Сохраняем патч
fs.writeFileSync('/opt/n8n-ai-patch.js', patchContent);

console.log('✅ Integration script prepared');

// Note: В production варианте здесь бы применялся патч к Server.js
// Для dev окружения используем монтирование volumes