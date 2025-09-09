#!/bin/bash

# Скрипт для интеграции n8n-ai с n8n

set -e

# Цвета
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔗 Integrating n8n-ai with n8n...${NC}"

# Проверяем, что n8n установлен
if ! command -v n8n &> /dev/null; then
    echo -e "${YELLOW}⚠️  n8n not found. Installing n8n...${NC}"
    npm install -g n8n
fi

# Создаем директорию для n8n с AI
N8N_AI_DIR="/tmp/n8n-ai-integration"
echo -e "${YELLOW}📁 Creating n8n-ai integration directory...${NC}"
mkdir -p "$N8N_AI_DIR"
cd "$N8N_AI_DIR"

# Инициализируем n8n проект
echo -e "${YELLOW}🚀 Initializing n8n project...${NC}"
npm init -y
npm install n8n

# Создаем конфигурацию n8n с AI
echo -e "${YELLOW}⚙️  Creating n8n configuration with AI...${NC}"
cat > n8n.config.js << 'EOF'
const { setupN8nAI } = require('@n8n-ai/unified');

module.exports = {
  // n8n configuration
  database: {
    type: 'sqlite',
    database: './n8n.db',
  },
  
  // AI Plugin configuration
  plugins: {
    ai: {
      enabled: true,
      orchestratorMode: 'embedded',
      uiPosition: 'bottom'
    }
  },
  
  // Custom initialization
  async init(app) {
    // Initialize AI plugin
    const aiPlugin = setupN8nAI(app, {
      enabled: true,
      orchestratorMode: 'embedded',
      uiPosition: 'bottom'
    });
    
    console.log('✅ n8n-ai plugin initialized');
  }
};
EOF

# Создаем package.json с AI зависимостями
echo -e "${YELLOW}📦 Setting up package.json with AI dependencies...${NC}"
cat > package.json << 'EOF'
{
  "name": "n8n-ai-integration",
  "version": "1.0.0",
  "description": "n8n with AI capabilities",
  "main": "n8n.config.js",
  "scripts": {
    "start": "n8n start",
    "dev": "n8n start --tunnel"
  },
  "dependencies": {
    "n8n": "^1.0.0",
    "@n8n-ai/unified": "file:../../packages/n8n-ai-unified"
  }
}
EOF

# Копируем AI пакет
echo -e "${YELLOW}📋 Copying AI package...${NC}"
cp -r /workspace/packages/n8n-ai-unified ./packages/
mkdir -p node_modules/@n8n-ai
ln -sf ../../packages/n8n-ai-unified node_modules/@n8n-ai/unified

# Создаем простой n8n сервер с AI
echo -e "${YELLOW}🔧 Creating n8n server with AI...${NC}"
cat > server.js << 'EOF'
const express = require('express');
const { setupN8nAI } = require('@n8n-ai/unified');

const app = express();

// Initialize AI plugin
const aiPlugin = setupN8nAI(app, {
  enabled: true,
  orchestratorMode: 'embedded',
  uiPosition: 'bottom'
});

// Basic n8n-like routes
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>n8n with AI</title>
      <link rel="stylesheet" href="/ai-assets/n8n-ai-panel.css">
    </head>
    <body>
      <div style="padding: 20px;">
        <h1>🤖 n8n with AI</h1>
        <p>Welcome to n8n with AI capabilities!</p>
        
        <div style="margin: 20px 0;">
          <a href="/ai-tools" style="display: inline-block; padding: 10px 20px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-right: 10px;">
            AI Tools
          </a>
          <a href="/ai-workflow" style="display: inline-block; padding: 10px 20px; background: #28a745; color: white; text-decoration: none; border-radius: 5px;">
            AI Workflow Creator
          </a>
        </div>
        
        <div style="margin: 20px 0;">
          <h3>Available AI Features:</h3>
          <ul>
            <li>🎯 AI Workflow Creator - Create workflows using natural language</li>
            <li>🔍 Workflow Analyzer - Analyze and optimize existing workflows</li>
            <li>📊 Smart Insights - Get intelligent insights about your workflows</li>
            <li>⚡ Auto-optimization - Automatically optimize workflows</li>
            <li>🛡️ Security Checker - Scan workflows for security issues</li>
            <li>📚 Documentation Generator - Generate workflow documentation</li>
          </ul>
        </div>
      </div>
      
      <script src="/ai-assets/n8n-ai-panel.umd.js"></script>
      <script>
        if (window.N8nAIPanel) {
          window.N8nAIPanel.init({
            position: 'bottom',
            apiUrl: '/api/v1/ai'
          });
        }
      </script>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 5678;
app.listen(PORT, () => {
  console.log(`🚀 n8n with AI running on http://localhost:${PORT}`);
  console.log(`🤖 AI Tools: http://localhost:${PORT}/ai-tools`);
  console.log(`🎯 AI Workflow: http://localhost:${PORT}/ai-workflow`);
});
EOF

# Создаем .env файл
echo -e "${YELLOW}📝 Creating environment configuration...${NC}"
cat > .env << 'EOF'
# n8n Configuration
N8N_PORT=5678
N8N_HOST=0.0.0.0

# AI Configuration
N8N_AI_ENABLED=true
AI_PROVIDER=mock
WORKFLOW_MAP_ENABLED=true
AUDIT_LOG_ENABLED=true

# Database
DB_TYPE=sqlite
DB_SQLITE_DATABASE=./n8n.db
EOF

echo -e "${GREEN}✅ n8n-ai integration setup complete!${NC}"
echo ""
echo -e "${BLUE}🚀 To start n8n with AI:${NC}"
echo "   cd $N8N_AI_DIR"
echo "   npm start"
echo ""
echo -e "${BLUE}🌐 Access points:${NC}"
echo "   • Main: http://localhost:5678"
echo "   • AI Tools: http://localhost:5678/ai-tools"
echo "   • AI Workflow: http://localhost:5678/ai-workflow"
echo ""
echo -e "${YELLOW}💡 Note: This creates a simplified n8n integration for demonstration.${NC}"
echo -e "${YELLOW}   For production use, integrate with the actual n8n codebase.${NC}"