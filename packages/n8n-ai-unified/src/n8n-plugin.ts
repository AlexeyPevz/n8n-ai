/**
 * n8n AI Plugin - интегрирует AI функционал прямо в n8n
 */

import type { INodeTypeDescription, IWebhookFunctions } from 'n8n-workflow';
import { createAIRoutes } from '@n8n-ai/hooks';
import { startOrchestrator } from './embedded-orchestrator';
import { setupN8nAI as setupN8nAIIntegration } from './n8n-integration';
import express from 'express';
import path from 'path';
import fs from 'fs';

export interface N8nAIPluginOptions {
  enabled?: boolean;
  orchestratorMode?: 'embedded' | 'external';
  orchestratorUrl?: string;
  uiPosition?: 'bottom' | 'right' | 'modal';
}

export class N8nAIPlugin {
  private aiPanelHtml: string = '';
  private orchestratorProcess: any;
  private integration: any;

  constructor(private options: N8nAIPluginOptions = {}) {
    this.options = {
      enabled: true,
      orchestratorMode: 'embedded',
      uiPosition: 'bottom',
      ...options
    };
  }

  /**
   * Инициализация плагина при старте n8n
   */
  async init(app: express.Application): Promise<void> {
    if (!this.options.enabled) return;

    console.log('🤖 Initializing n8n AI Plugin...');

    // 1. Запускаем встроенный orchestrator если нужно
    if (this.options.orchestratorMode === 'embedded') {
      this.orchestratorProcess = await startOrchestrator({
        port: 0, // random port
        embedded: true
      });
      process.env.N8N_AI_ORCHESTRATOR_URL = `http://localhost:${this.orchestratorProcess.port}`;
    }

    // 2. Инициализируем интеграцию с n8n
    this.integration = setupN8nAIIntegration(app, {
      enabled: true,
      uiPosition: this.options.uiPosition,
      orchestratorUrl: this.options.orchestratorUrl || process.env.N8N_AI_ORCHESTRATOR_URL
    });

    // 3. Монтируем AI API routes
    const aiRoutes = createAIRoutes();
    app.use('/api/v1/ai', aiRoutes);
    app.use('/rest/ai', aiRoutes); // alias для совместимости

    // 4. Добавляем статику для UI
    app.use('/ai-assets', express.static(path.join(__dirname, '../ui/dist')));

    // 5. Добавляем HTML шаблоны
    this.setupTemplates(app);

    // 6. Инжектим UI в n8n страницы
    this.setupUIInjection(app);

    // 7. Регистрируем AI node types
    this.registerAINodes();

    console.log('✅ n8n AI Plugin initialized successfully');
  }

  /**
   * Настройка HTML шаблонов
   */
  private setupTemplates(app: express.Application): void {
    // AI Tools page
    app.get('/ai-tools', (req, res) => {
      const templatePath = path.join(__dirname, '../ui/templates/ai-tools.html');
      if (fs.existsSync(templatePath)) {
        res.sendFile(templatePath);
      } else {
        res.send(`
          <html>
            <head><title>AI Tools - n8n</title></head>
            <body>
              <h1>🤖 AI Tools</h1>
              <p>AI functionality is enabled but templates are not available.</p>
              <p>Please ensure the UI templates are built correctly.</p>
            </body>
          </html>
        `);
      }
    });

    // AI Workflow page
    app.get('/ai-workflow/:id?', (req, res) => {
      const templatePath = path.join(__dirname, '../ui/templates/ai-workflow.html');
      if (fs.existsSync(templatePath)) {
        res.sendFile(templatePath);
      } else {
        res.send(`
          <html>
            <head><title>AI Workflow - n8n</title></head>
            <body>
              <h1>🤖 AI Workflow Creator</h1>
              <p>AI workflow creator is enabled but templates are not available.</p>
              <p>Please ensure the UI templates are built correctly.</p>
            </body>
          </html>
        `);
      }
    });
  }

  /**
   * Инжектим AI UI в n8n frontend
   */
  private setupUIInjection(app: express.Application): void {
    // Middleware для инжекции AI UI
    app.use((req, res, next) => {
      const originalRender = res.render;
      
      res.render = function(this: any, view: string, options: any) {
        if (view === 'App' || view === 'index' || view === 'workflow') {
          // Добавляем наш AI UI в options
          options = options || {};
          options.aiEnabled = true;
          options.aiConfig = {
            position: this.options.uiPosition,
            apiUrl: '/api/v1/ai',
            orchestratorUrl: this.options.orchestratorUrl || process.env.N8N_AI_ORCHESTRATOR_URL
          };
          
          // Инжектим скрипты и стили
          const aiScripts = `
            <script src="/ai-assets/n8n-ai-panel.umd.js"></script>
            <link rel="stylesheet" href="/ai-assets/n8n-ai-panel.css">
            <script>
              window.N8N_AI_CONFIG = ${JSON.stringify(options.aiConfig)};
              // Инициализируем AI панель
              if (window.N8nAIPanel) {
                window.N8nAIPanel.init(options.aiConfig);
              }
            </script>
          `;
          
          // Добавляем в head или body
          if (options.additionalScripts) {
            options.additionalScripts += aiScripts;
          } else {
            options.additionalScripts = aiScripts;
          }
        }
        
        return originalRender.call(this, view, options);
      };
      
      next();
    });
  }

  /**
   * Регистрируем специальные AI ноды
   */
  private registerAINodes(): void {
    // AI Trigger Node
    const aiTriggerNode: INodeTypeDescription = {
      displayName: 'AI Workflow Trigger',
      name: 'aiWorkflowTrigger',
      icon: 'fa:robot',
      group: ['trigger'],
      version: 1,
      description: 'Triggers workflow from AI assistant',
      defaults: {
        name: 'AI Trigger',
        color: '#6B47FF',
      },
      inputs: [],
      outputs: ['main'] as any,
      properties: [
        {
          displayName: 'Trigger ID',
          name: 'triggerId',
          type: 'string',
          default: '',
          description: 'Unique identifier for AI trigger',
        },
      ],
      webhooks: [
        {
          name: 'default',
          httpMethod: 'POST',
          responseMode: 'onReceived',
          path: 'ai-trigger',
        },
      ],
    };

    // AI Assistant Node
    const aiAssistantNode: INodeTypeDescription = {
      displayName: 'AI Assistant',
      name: 'aiAssistant',
      icon: 'fa:brain',
      group: ['transform'],
      version: 1,
      description: 'AI-powered data processing and analysis',
      defaults: {
        name: 'AI Assistant',
        color: '#6B47FF',
      },
      inputs: ['main'] as any,
      outputs: ['main'] as any,
      properties: [
        {
          displayName: 'AI Task',
          name: 'aiTask',
          type: 'options',
          options: [
            { name: 'Analyze Data', value: 'analyze' },
            { name: 'Generate Text', value: 'generate' },
            { name: 'Classify Data', value: 'classify' },
            { name: 'Extract Information', value: 'extract' },
          ],
          default: 'analyze',
        },
        {
          displayName: 'Prompt',
          name: 'prompt',
          type: 'string',
          typeOptions: {
            rows: 4,
          },
          default: '',
          description: 'Instructions for the AI assistant',
        },
      ],
    };

    // Регистрируем ноды в n8n
    // Это будет зависеть от n8n API для регистрации нод
    // registerNodeType(aiTriggerNode);
    // registerNodeType(aiAssistantNode);
  }

  /**
   * Остановка плагина
   */
  async stop(): Promise<void> {
    if (this.orchestratorProcess) {
      await this.orchestratorProcess.stop();
    }
  }
}

// Экспортируем функцию для простой интеграции
export function setupN8nAI(app: express.Application, options?: N8nAIPluginOptions): N8nAIPlugin {
  const plugin = new N8nAIPlugin(options);
  plugin.init(app);
  return plugin;
}