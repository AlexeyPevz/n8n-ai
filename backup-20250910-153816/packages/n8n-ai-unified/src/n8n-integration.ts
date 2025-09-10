/**
 * Интеграция с n8n - добавляет AI функционал в n8n интерфейс
 */

import express from 'express';
import path from 'path';

export interface N8nAIIntegrationOptions {
  enabled?: boolean;
  uiPosition?: 'bottom' | 'right' | 'modal';
  orchestratorUrl?: string;
}

export class N8nAIIntegration {
  private options: N8nAIIntegrationOptions;

  constructor(options: N8nAIIntegrationOptions = {}) {
    this.options = {
      enabled: true,
      uiPosition: 'bottom',
      orchestratorUrl: 'http://localhost:3000',
      ...options
    };
  }

  /**
   * Инициализация интеграции с n8n
   */
  async init(app: express.Application): Promise<void> {
    if (!this.options.enabled) return;

    console.log('🤖 Initializing n8n AI Integration...');

    // 1. Добавляем статические файлы UI
    app.use('/ai-assets', express.static(path.join(__dirname, '../ui/dist')));

    // 2. Добавляем API прокси к orchestrator
    this.setupAPIProxy(app);

    // 3. Инжектим UI в n8n страницы
    this.setupUIInjection(app);

    // 4. Добавляем AI routes
    this.setupAIRoutes(app);

    console.log('✅ n8n AI Integration initialized successfully');
  }

  /**
   * Настройка API прокси к orchestrator
   */
  private setupAPIProxy(app: express.Application): void {
    const orchestratorUrl = this.options.orchestratorUrl!;

    // Простой прокси для AI API
    app.use('/api/v1/ai', async (req, res) => {
      try {
        const targetUrl = `${orchestratorUrl}${req.path}`;
        const response = await fetch(targetUrl, {
          method: req.method,
          headers: {
            'Content-Type': 'application/json',
            ...(req.headers as Record<string, string>)
          },
          body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
        });
        
        const data = await response.json();
        res.status(response.status).json(data);
      } catch (error) {
        res.status(500).json({ error: 'Failed to proxy request to orchestrator' });
      }
    });

    // Алиас для совместимости
    app.use('/rest/ai', (req, res, next) => {
      req.url = req.url.replace('/rest/ai', '/api/v1/ai');
      next();
    });
  }

  /**
   * Инжекция UI в n8n страницы
   */
  private setupUIInjection(app: express.Application): void {
    const self = this;
    // Middleware для инжекции AI UI
    app.use((req, res, next) => {
      const originalRender = res.render;
      
      res.render = function(view: string, options: any) {
        if (view === 'App' || view === 'index' || view === 'workflow') {
          // Добавляем AI конфигурацию
          options = options || {};
          options.aiEnabled = true;
          options.aiConfig = {
            position: self.options.uiPosition,
            apiUrl: '/api/v1/ai',
            orchestratorUrl: self.options.orchestratorUrl
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
   * Настройка AI routes
   */
  private setupAIRoutes(app: express.Application): void {
    // AI Tools endpoint
    app.get('/ai-tools', (req, res) => {
      res.render('ai-tools', {
        title: 'AI Tools',
        aiConfig: this.options
      });
    });

    // AI Workflow endpoint
    app.get('/ai-workflow/:id?', (req, res) => {
      const workflowId = req.params.id || 'new';
      res.render('ai-workflow', {
        title: 'AI Workflow',
        workflowId,
        aiConfig: this.options
      });
    });

    // AI Settings endpoint
    app.get('/ai-settings', (req, res) => {
      res.render('ai-settings', {
        title: 'AI Settings',
        aiConfig: this.options
      });
    });
  }
}

// Экспортируем функцию для простой интеграции
export function setupN8nAI(app: express.Application, options?: N8nAIIntegrationOptions): N8nAIIntegration {
  const integration = new N8nAIIntegration(options);
  integration.init(app);
  return integration;
}