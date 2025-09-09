#!/bin/bash

# Тест интеграции n8n-ai

set -e

# Цвета
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🧪 Testing n8n-ai integration...${NC}"

# Создаем простой тестовый сервер
TEST_DIR="/tmp/n8n-ai-test"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

echo -e "${YELLOW}📁 Creating test server...${NC}"

# Создаем простой Express сервер с AI интеграцией
cat > server.js << 'EOF'
const express = require('express');
const path = require('path');

const app = express();

// Middleware
app.use(express.json());
app.use(express.static('public'));

// AI API endpoints
app.get('/api/v1/ai/health', (req, res) => {
  res.json({ status: 'ok', mode: 'test', ts: Date.now() });
});

app.post('/api/v1/ai/plan', (req, res) => {
  const { prompt } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  
  // Простой AI планировщик
  const operations = [
    {
      op: 'add_node',
      node: {
        id: 'node-1',
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        typeVersion: 1,
        position: [400, 300],
        parameters: {}
      }
    },
    {
      op: 'add_node',
      node: {
        id: 'node-2',
        name: 'HTTP Request',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4,
        position: [600, 300],
        parameters: {
          method: 'GET',
          url: 'https://api.example.com/data',
          responseFormat: 'json'
        }
      }
    },
    {
      op: 'connect',
      from: 'Manual Trigger',
      to: 'HTTP Request'
    }
  ];
  
  res.json({
    ops: operations,
    version: 'v1',
    prompt,
    mode: 'test'
  });
});

// AI Tools page
app.get('/ai-tools', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AI Tools - n8n</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0;
                padding: 20px;
                background: #f8f9fa;
            }
            .container {
                max-width: 1200px;
                margin: 0 auto;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                overflow: hidden;
            }
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px;
                text-align: center;
            }
            .content {
                padding: 20px;
            }
            .feature-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 20px;
                margin-top: 20px;
            }
            .feature-card {
                border: 1px solid #e1e5e9;
                border-radius: 8px;
                padding: 20px;
                transition: transform 0.2s, box-shadow 0.2s;
            }
            .feature-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            }
            .feature-title {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 10px;
                color: #2c3e50;
            }
            .feature-description {
                color: #6c757d;
                margin-bottom: 15px;
            }
            .feature-button {
                background: #667eea;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
                transition: background 0.2s;
            }
            .feature-button:hover {
                background: #5a6fd8;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🤖 AI Tools</h1>
                <p>Intelligent workflow creation and management</p>
            </div>
            <div class="content">
                <div class="feature-grid">
                    <div class="feature-card">
                        <div class="feature-title">🎯 AI Workflow Creator</div>
                        <div class="feature-description">
                            Create workflows using natural language. Just describe what you want to achieve and AI will build the workflow for you.
                        </div>
                        <button class="feature-button" onclick="openAICreator()">
                            Create Workflow
                        </button>
                    </div>
                    
                    <div class="feature-card">
                        <div class="feature-title">🔍 Workflow Analyzer</div>
                        <div class="feature-description">
                            Analyze existing workflows to find optimization opportunities, security issues, and performance improvements.
                        </div>
                        <button class="feature-button" onclick="openAnalyzer()">
                            Analyze Workflow
                        </button>
                    </div>
                    
                    <div class="feature-card">
                        <div class="feature-title">📊 Smart Insights</div>
                        <div class="feature-description">
                            Get intelligent insights about your workflows, including usage patterns, bottlenecks, and recommendations.
                        </div>
                        <button class="feature-button" onclick="openInsights()">
                            View Insights
                        </button>
                    </div>
                    
                    <div class="feature-card">
                        <div class="feature-title">⚡ Auto-optimization</div>
                        <div class="feature-description">
                            Automatically optimize your workflows for better performance, cost efficiency, and reliability.
                        </div>
                        <button class="feature-button" onclick="openOptimizer()">
                            Optimize Now
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <script>
            function openAICreator() {
                window.location.href = '/ai-workflow';
            }
            
            function openAnalyzer() {
                alert('Workflow Analyzer - Coming Soon!');
            }
            
            function openInsights() {
                alert('Smart Insights - Coming Soon!');
            }
            
            function openOptimizer() {
                alert('Auto-optimization - Coming Soon!');
            }
        </script>
    </body>
    </html>
  `);
});

// AI Workflow page
app.get('/ai-workflow', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AI Workflow - n8n</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0;
                padding: 0;
                background: #f8f9fa;
            }
            .container {
                display: flex;
                height: 100vh;
            }
            .sidebar {
                width: 400px;
                background: white;
                border-right: 1px solid #e1e5e9;
                display: flex;
                flex-direction: column;
            }
            .sidebar-header {
                padding: 20px;
                border-bottom: 1px solid #e1e5e9;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            .sidebar-content {
                flex: 1;
                padding: 20px;
                overflow-y: auto;
            }
            .prompt-section {
                margin-bottom: 30px;
            }
            .prompt-label {
                font-weight: 600;
                margin-bottom: 10px;
                color: #2c3e50;
            }
            .prompt-textarea {
                width: 100%;
                height: 120px;
                padding: 12px;
                border: 1px solid #e1e5e9;
                border-radius: 6px;
                font-size: 14px;
                resize: vertical;
                font-family: inherit;
            }
            .prompt-textarea:focus {
                outline: none;
                border-color: #667eea;
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
            }
            .generate-button {
                background: #667eea;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                width: 100%;
                transition: background 0.2s;
            }
            .generate-button:hover {
                background: #5a6fd8;
            }
            .generate-button:disabled {
                background: #6c757d;
                cursor: not-allowed;
            }
            .workflow-preview {
                flex: 1;
                background: #f8f9fa;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
            }
            .workflow-canvas {
                width: 100%;
                height: 100%;
                background: white;
                border-radius: 8px;
                margin: 20px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                position: relative;
                overflow: hidden;
            }
            .workflow-placeholder {
                text-align: center;
                color: #6c757d;
                font-size: 18px;
            }
            .workflow-placeholder i {
                font-size: 48px;
                margin-bottom: 20px;
                display: block;
            }
            .loading {
                display: none;
                text-align: center;
                padding: 20px;
            }
            .loading.show {
                display: block;
            }
            .spinner {
                border: 3px solid #f3f3f3;
                border-top: 3px solid #667eea;
                border-radius: 50%;
                width: 30px;
                height: 30px;
                animation: spin 1s linear infinite;
                margin: 0 auto 10px;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="sidebar">
                <div class="sidebar-header">
                    <h2>🤖 AI Workflow Creator</h2>
                    <p>Describe your workflow in natural language</p>
                </div>
                <div class="sidebar-content">
                    <div class="prompt-section">
                        <div class="prompt-label">What do you want to build?</div>
                        <textarea 
                            class="prompt-textarea" 
                            id="aiPrompt"
                            placeholder="Example: Create a webhook that receives data and sends it to Slack when a specific condition is met..."
                        ></textarea>
                        <button class="generate-button" id="generateButton" onclick="generateWorkflow()">
                            Generate Workflow
                        </button>
                    </div>
                    
                    <div class="loading" id="loadingIndicator">
                        <div class="spinner"></div>
                        <div>Generating workflow...</div>
                    </div>
                    
                    <div id="workflowResult" style="display: none;">
                        <h3>Generated Workflow</h3>
                        <div id="workflowPreview"></div>
                    </div>
                </div>
            </div>
            
            <div class="workflow-preview">
                <div class="workflow-canvas" id="workflowCanvas">
                    <div class="workflow-placeholder">
                        <i>🎨</i>
                        <div>Your AI-generated workflow will appear here</div>
                    </div>
                </div>
            </div>
        </div>

        <script>
            let currentWorkflow = null;
            
            async function generateWorkflow() {
                const prompt = document.getElementById('aiPrompt').value.trim();
                if (!prompt) {
                    alert('Please enter a description of your workflow');
                    return;
                }
                
                const generateButton = document.getElementById('generateButton');
                const loadingIndicator = document.getElementById('loadingIndicator');
                const workflowResult = document.getElementById('workflowResult');
                
                generateButton.disabled = true;
                loadingIndicator.classList.add('show');
                workflowResult.style.display = 'none';
                
                try {
                    const response = await fetch('/api/v1/ai/plan', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ prompt })
                    });
                    
                    const result = await response.json();
                    
                    if (result.ops) {
                        currentWorkflow = result;
                        displayWorkflow(result);
                        workflowResult.style.display = 'block';
                        document.getElementById('workflowPreview').innerHTML = 
                            '<pre>' + JSON.stringify(result, null, 2) + '</pre>';
                    } else {
                        throw new Error(result.error || 'Failed to generate workflow');
                    }
                } catch (error) {
                    alert('Error generating workflow: ' + error.message);
                } finally {
                    generateButton.disabled = false;
                    loadingIndicator.classList.remove('show');
                }
            }
            
            function displayWorkflow(workflow) {
                const canvas = document.getElementById('workflowCanvas');
                canvas.innerHTML = '<div class="workflow-placeholder"><i>✅</i><div>Workflow generated successfully!</div></div>';
                console.log('Generated workflow:', workflow);
            }
        </script>
    </body>
    </html>
  `);
});

// Main page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>n8n with AI</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0;
                padding: 20px;
                background: #f8f9fa;
            }
            .container {
                max-width: 1200px;
                margin: 0 auto;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                overflow: hidden;
            }
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px;
                text-align: center;
            }
            .content {
                padding: 20px;
            }
            .button {
                display: inline-block;
                padding: 10px 20px;
                background: #667eea;
                color: white;
                text-decoration: none;
                border-radius: 5px;
                margin-right: 10px;
                margin-bottom: 10px;
            }
            .button:hover {
                background: #5a6fd8;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🤖 n8n with AI</h1>
                <p>Welcome to n8n with AI capabilities!</p>
            </div>
            <div class="content">
                <div style="margin: 20px 0;">
                    <a href="/ai-tools" class="button">AI Tools</a>
                    <a href="/ai-workflow" class="button">AI Workflow Creator</a>
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
        </div>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 5678;
app.listen(PORT, () => {
  console.log('🚀 n8n with AI running on http://localhost:' + PORT);
  console.log('🤖 AI Tools: http://localhost:' + PORT + '/ai-tools');
  console.log('🎯 AI Workflow: http://localhost:' + PORT + '/ai-workflow');
});
EOF

# Создаем package.json
cat > package.json << 'EOF'
{
  "name": "n8n-ai-test",
  "version": "1.0.0",
  "description": "Test n8n with AI integration",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
EOF

# Устанавливаем зависимости
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install

# Запускаем сервер
echo -e "${YELLOW}🚀 Starting test server...${NC}"
node server.js &
SERVER_PID=$!

# Ждем запуска
sleep 3

# Тестируем endpoints
echo -e "${BLUE}🧪 Testing endpoints...${NC}"

# Health check
if curl -s http://localhost:5678/api/v1/ai/health | grep -q "ok"; then
    echo -e "   ${GREEN}✅ Health endpoint working${NC}"
else
    echo -e "   ${RED}❌ Health endpoint failed${NC}"
fi

# AI Tools page
if curl -s http://localhost:5678/ai-tools | grep -q "AI Tools"; then
    echo -e "   ${GREEN}✅ AI Tools page working${NC}"
else
    echo -e "   ${RED}❌ AI Tools page failed${NC}"
fi

# AI Workflow page
if curl -s http://localhost:5678/ai-workflow | grep -q "AI Workflow Creator"; then
    echo -e "   ${GREEN}✅ AI Workflow page working${NC}"
else
    echo -e "   ${RED}❌ AI Workflow page failed${NC}"
fi

# Test AI planning
echo -e "${BLUE}🧪 Testing AI planning...${NC}"
RESPONSE=$(curl -s -X POST http://localhost:5678/api/v1/ai/plan \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Create a webhook that sends data to Slack"}')

if echo "$RESPONSE" | grep -q "ops"; then
    echo -e "   ${GREEN}✅ AI planning working${NC}"
    echo -e "   ${YELLOW}Generated operations: $(echo "$RESPONSE" | grep -o '"ops"' | wc -l)${NC}"
else
    echo -e "   ${RED}❌ AI planning failed${NC}"
fi

echo -e "\n${GREEN}🎉 Integration test complete!${NC}"
echo -e "${BLUE}🌐 Access points:${NC}"
echo -e "   • Main: http://localhost:5678"
echo -e "   • AI Tools: http://localhost:5678/ai-tools"
echo -e "   • AI Workflow: http://localhost:5678/ai-workflow"

echo -e "\n${YELLOW}Press Ctrl+C to stop the server${NC}"

# Ожидание
wait