# Интеграция n8n-ai в единое приложение

## Цель
Превратить разрозненные сервисы в единый пользовательский опыт внутри n8n.

## Архитектура

```
┌─────────────────────────────────────────┐
│            n8n (главное приложение)      │
├─────────────────────────────────────────┤
│  ┌──────────────┐  ┌─────────────────┐  │
│  │   Основной   │  │   AI Panel      │  │
│  │   Редактор   │  │  (встроенный)   │  │
│  └──────────────┘  └─────────────────┘  │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │    n8n-ai-hooks (встроенный)     │   │
│  └──────────────────────────────────┘   │
│                    ↓                     │
│  ┌──────────────────────────────────┐   │
│  │  Orchestrator (встроенный или    │   │
│  │  как отдельный микросервис)      │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## Шаги интеграции

### 1. Подготовка n8n-ai-panel для встраивания

```bash
# В packages/n8n-ai-panel/vite.config.ts
export default defineConfig({
  build: {
    lib: {
      entry: './src/main.ts',
      name: 'N8nAiPanel',
      formats: ['umd', 'es']
    }
  }
})
```

### 2. Интеграция в n8n UI

```typescript
// packages/n8n-ai-hooks/src/ui-integration.ts
export function mountAIPanel(container: HTMLElement, options: {
  apiUrl: string;
  workflowId: string;
  onOperation: (batch: OperationBatch) => void;
}) {
  // Монтируем Vue приложение
  const app = createApp(AIPanel, options);
  app.mount(container);
  return app;
}
```

### 3. Добавление кнопки в n8n toolbar

```vue
<!-- В n8n editor -->
<template>
  <div class="editor-toolbar">
    <!-- Существующие кнопки -->
    
    <n8n-button
      v-if="aiEnabled"
      icon="robot"
      type="tertiary"
      size="small"
      @click="toggleAIPanel"
    >
      AI Assistant
    </n8n-button>
  </div>
  
  <!-- Выезжающая панель -->
  <n8n-drawer
    v-model="aiPanelVisible"
    :width="450"
    direction="rtl"
  >
    <div ref="aiPanelContainer" class="ai-panel-container" />
  </n8n-drawer>
</template>

<script>
export default {
  data() {
    return {
      aiPanelVisible: false,
      aiPanelApp: null
    }
  },
  
  methods: {
    toggleAIPanel() {
      this.aiPanelVisible = !this.aiPanelVisible;
      if (this.aiPanelVisible && !this.aiPanelApp) {
        this.mountAIPanel();
      }
    },
    
    mountAIPanel() {
      this.aiPanelApp = mountAIPanel(this.$refs.aiPanelContainer, {
        apiUrl: '/api/v1/ai',
        workflowId: this.workflowId,
        onOperation: this.handleAIOperation
      });
    },
    
    handleAIOperation(batch) {
      // Применяем операции к текущему workflow
      this.applyOperations(batch);
    }
  }
}
</script>
```

### 4. Единый Docker образ

```dockerfile
# Dockerfile.unified
FROM n8n:latest

# Копируем AI компоненты
COPY packages/n8n-ai-hooks/dist /opt/n8n-ai/hooks
COPY packages/n8n-ai-panel/dist /opt/n8n-ai/panel
COPY packages/n8n-ai-orchestrator/dist /opt/n8n-ai/orchestrator

# Патчим n8n для загрузки AI модулей
COPY scripts/patch-n8n.js /opt/
RUN node /opt/patch-n8n.js

ENV N8N_AI_ENABLED=true
```

### 5. Конфигурация для production

```yaml
# docker-compose.unified.yml
version: '3.9'

services:
  n8n-with-ai:
    build: 
      context: .
      dockerfile: Dockerfile.unified
    ports:
      - "5678:5678"
    environment:
      - N8N_AI_ENABLED=true
      - N8N_AI_ORCHESTRATOR_MODE=embedded # или external
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - n8n_data:/home/node/.n8n
      
  # Опционально: внешний orchestrator для масштабирования
  orchestrator:
    image: n8n-ai-orchestrator
    deploy:
      replicas: 3
    environment:
      - REDIS_URL=redis://redis:6379
      
  redis:
    image: redis:7
    
  qdrant:
    image: qdrant/qdrant
```

## UI/UX интеграция

### Варианты размещения AI функционала:

1. **Боковая панель** (как в VS Code)
   - Выезжает справа
   - Всегда доступна
   - Не мешает основной работе

2. **Модальное окно**
   - Для сложных операций
   - Пошаговый wizard

3. **Inline подсказки**
   - При наведении на ноды
   - Контекстные предложения

4. **Command palette**
   - Cmd+K для быстрых команд
   - "Create HTTP request to API"

## Преимущества единого приложения

1. **Для пользователей:**
   - Один URL, один логин
   - Единый интерфейс
   - Нет переключения между окнами

2. **Для разработки:**
   - Общий контекст
   - Единая система событий
   - Проще отладка

3. **Для деплоя:**
   - Один контейнер
   - Проще мониторинг
   - Единые логи

## Roadmap

1. **Phase 1**: Базовая интеграция (2 недели)
   - [ ] Build AI panel как библиотеку
   - [ ] Добавить endpoint в n8n-ai-hooks
   - [ ] Простая кнопка в n8n UI

2. **Phase 2**: Полная интеграция (4 недели)
   - [ ] Нативные n8n компоненты
   - [ ] Единая система событий
   - [ ] Интеграция с n8n store

3. **Phase 3**: Production ready (2 недели)
   - [ ] Единый Docker образ
   - [ ] Конфигурация через env
   - [ ] Документация для пользователей