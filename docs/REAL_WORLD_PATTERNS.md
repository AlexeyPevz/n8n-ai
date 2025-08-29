# Real-World Workflow Patterns для n8n-ai

## Источник данных
Проанализировано 100+ реальных воркфлоу из репозитория [n8n-factory](https://github.com/AlexeyPevz/n8n-factory-/tree/main/examples)

## Ключевые находки

### 1. Популярные интеграции
- **Slack** - уведомления, алерты, отчеты
- **Email** - автоматизация рассылок, дайджесты
- **GitHub** - CI/CD, управление issues
- **Stripe** - обработка платежей
- **Google Sheets** - хранение и обработка данных
- **LangChain** - AI-функциональность

### 2. Частые паттерны воркфлоу

#### Webhook → Action
```
Webhook → Process Data → Send Notification (Slack/Email)
```
Используется для: алертов, триггеров от внешних систем

#### Scheduled Reports
```
Schedule → Fetch Data → Transform → Send Report
```
Используется для: ежедневных отчетов, мониторинга

#### AI Enhancement
```
Input → Text Splitter → Embeddings → Vector Store → AI Agent → Output
```
Используется для: умной обработки текста, чат-ботов

#### Error Handling
```
Main Flow → Error Trigger → Send Alert → Log Error
```
Используется для: надежности критичных процессов

### 3. Типичные параметры нод

#### HTTP Request
- method: GET/POST (90% случаев)
- responseFormat: json
- authentication: часто требуется

#### Slack
- channel: динамический через expressions
- text: markdown formatting
- attachments: для rich messages

#### Schedule Trigger
- cronExpression: "0 9 * * *" (ежедневно в 9:00)
- interval: часовые проверки для мониторинга

### 4. Рекомендации для AI Planner

1. **Всегда добавляй триггер** - Manual Trigger по умолчанию
2. **Используй expressions** - `={{ $json.field }}` для динамических данных
3. **Добавляй error handling** - для критичных воркфлоу
4. **Группируй по функциям** - триггеры слева, действия справа
5. **Именуй понятно** - "Fetch Users", не "HTTP Request 1"

### 5. Интеграция в n8n-ai

Добавлены паттерны в `workflow-patterns.ts`:
- webhook-to-slack
- scheduled-report
- ai-enhanced-workflow
- github-automation
- stripe-integration
- inventory-monitoring

### 6. Примеры промптов для тестирования

1. "Send webhook notifications to Slack channel"
2. "Create daily report workflow with email"
3. "Build AI workflow with OpenAI embeddings"
4. "Monitor GitHub commits and create issues"
5. "Process Stripe payments to QuickBooks"
6. "Check inventory levels every hour and alert on Slack"

## Следующие шаги

1. Расширить библиотеку паттернов
2. Добавить ML для определения лучшего паттерна
3. Создать систему рекомендаций параметров
4. Интегрировать с RAG для контекстного поиска