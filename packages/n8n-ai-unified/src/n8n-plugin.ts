/**
 * n8n AI Plugin - интегрирует AI функционал прямо в n8n
 */

import type { INodeTypeDescription, IWebhookFunctions } from 'n8n-workflow';
import { createAIRoutes } from '@n8n-ai/hooks';
import { startOrchestrator } from './embedded-orchestrator';
import express from 'express';
import path from 'path';

export interface N8nAIPluginOptions {
  enabled?: boolean;
  orchestratorMode?: 'embedded' | 'external';
  orchestratorUrl?: string;
  uiPosition?: 'bottom' | 'right' | 'modal';
}

export class N8nAIPlugin {
  private aiPanelHtml: string = '';
  private orchestratorProcess: any;

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
  async init(app: any): Promise<void> {
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

    // 2. Монтируем AI API routes
    const aiRoutes = createAIRoutes();
    app.use('/api/v1/ai', aiRoutes);
    app.use('/rest/ai', aiRoutes); // alias для совместимости

    // 3. Добавляем статику для UI
    app.use('/ai-assets', express.static(path.join(__dirname, '../ui/dist')));

    // 4. Инжектим UI в n8n страницы
    this.setupUIInjection(app);

    // 5. Регистрируем AI node types
    this.registerAINodes();

    console.log('✅ n8n AI Plugin initialized successfully');
  }

  /**
   * Инжектим AI UI в n8n frontend
   */
  private setupUIInjection(app: any): void {
    // Перехватываем рендеринг основной страницы
    app.use((req: any, res: any, next: any) => {
      const originalRender = res.render;
      res.render = function(view: string, options: any) {
        if (view === 'App' || view === 'index') {
          // Добавляем наш AI UI в options
          options = options || {};
          options.aiEnabled = true;
          options.aiConfig = {
            position: this.options.uiPosition,
            apiUrl: '/api/v1/ai'
          };
          
          // Инжектим скрипты и стили
          options.additionalScripts = (options.additionalScripts || '') + `
            <script src="/ai-assets/n8n-ai-panel.umd.js"></script>
            <link rel="stylesheet" href="/ai-assets/n8n-ai-panel.css">
            <script>
              window.N8N_AI_CONFIG = ${JSON.stringify(options.aiConfig)};
            </script>
          `;
        }
        return originalRender.call(this, view, options);
      }.bind(res);
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
      outputs: ['main'],
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

    // Регистрируем ноду в n8n
    // Это будет зависеть от n8n API для регистрации нод
    // registerNodeType(aiTriggerNode);
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
export function setupN8nAI(app: any, options?: N8nAIPluginOptions): N8nAIPlugin {
  const plugin = new N8nAIPlugin(options);
  plugin.init(app);
  return plugin;
}