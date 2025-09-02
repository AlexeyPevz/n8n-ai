# 🤖 n8n with AI - Unified Application

## 🎯 Что это?

Это единое приложение n8n со встроенными AI возможностями. Больше не нужно запускать несколько сервисов - всё работает из коробки!

## ✨ Возможности

- **AI-first tool** - кнопка в интерфейсе n8n для вызова AI ассистента
- **Естественный язык** - создавайте workflow простыми командами
- **Workflow Map** - визуализация всех ваших процессов
- **Встроенный orchestrator** - не нужен отдельный сервис
- **Нативный UI** - всё в стиле n8n

## 🚀 Быстрый старт

### 1. Простой способ (Docker)

```bash
# Клонируем репозиторий
git clone https://github.com/your-org/n8n-ai.git
cd n8n-ai

# Запускаем
./scripts/start-unified.sh
```

При первом запуске будет создан `.env` файл. Добавьте туда ваш OpenAI ключ и запустите снова.

### 2. Ручная установка

```bash
# Установка зависимостей
pnpm install

# Сборка
pnpm build

# Запуск через Docker Compose
docker-compose -f docker-compose.unified.yml up
```

## 🎮 Использование

1. Откройте http://localhost:5678
2. Нажмите кнопку **"AI-first tool"** или `Cmd+K`
3. Введите команду, например:
   - "Создай HTTP запрос для получения погоды"
   - "Добавь webhook который принимает JSON и сохраняет в базу"
   - "Сделай workflow для ежедневной отправки отчетов"

## 📸 Скриншоты

### Главный экран с AI кнопкой
```
┌────────────────────────────────────────────┐
│  n8n                              [AI-first │
│  ┌─────┐  ┌─────┐                   tool]  │
│  │Start│→ │HTTP │ → ...                     │
│  └─────┘  └─────┘                           │
└────────────────────────────────────────────┘
```

### AI панель (выезжает снизу)
```
┌────────────────────────────────────────────┐
│  n8n workflow editor                        │
├────────────────────────────────────────────┤
│  🤖 AI Workflow Assistant          [Map][X] │
├────────────────────────────────────────────┤
│  User: Create HTTP request to API          │
│  AI: I'll create an HTTP request node...   │
│  [Preview Changes] [Apply]                  │
├────────────────────────────────────────────┤
│  Type your request...             [Send ⌘↵] │
└────────────────────────────────────────────┘
```

## ⚙️ Конфигурация

### Переменные окружения

```bash
# Основные
N8N_AI_ENABLED=true              # Включить AI функции
N8N_AI_UI_POSITION=bottom        # bottom, right, modal

# AI провайдеры (минимум один)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-...

# Дополнительно
WORKFLOW_MAP_ENABLED=true        # Карта workflow
AUDIT_LOG_ENABLED=true          # Логирование действий
```

## 🏗️ Архитектура

```
n8n (основное приложение)
├── AI Plugin (встроенный)
│   ├── API Routes (/api/v1/ai/*)
│   ├── UI Component (Vue)
│   └── Orchestrator (опционально встроенный)
├── Redis (кэш и очереди)
└── Qdrant (векторная БД для RAG)
```

## 🔧 Разработка

### Структура проекта
```
packages/
├── n8n-ai-unified/     # Объединяющий пакет
│   ├── src/
│   │   ├── n8n-plugin.ts    # Плагин для n8n
│   │   └── ui/              # Vue компоненты
│   └── scripts/
│       └── patch-n8n.js     # Патч для n8n
├── n8n-ai-hooks/       # API endpoints
├── n8n-ai-orchestrator/# Бизнес логика
└── n8n-ai-schemas/     # Типы и схемы
```

### Локальная разработка

```bash
# Режим разработки
pnpm dev

# Тесты
pnpm test

# Линтинг
pnpm lint
```

## 🐛 Решение проблем

### AI кнопка не появляется
- Проверьте `N8N_AI_ENABLED=true` в `.env`
- Перезапустите n8n

### Ошибка "No API key"
- Добавьте хотя бы один AI ключ в `.env`
- Поддерживаются: OpenAI, Anthropic, OpenRouter

### Панель не открывается
- Проверьте консоль браузера (F12)
- Убедитесь, что порт 5678 не занят

## 📚 Документация

- [Полная документация](./docs/README.md)
- [API Reference](./docs/API.md)
- [Security Guide](./docs/SECURITY.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)

## 🤝 Вклад в проект

Мы приветствуем контрибуции! См. [CONTRIBUTING.md](./docs/CONTRIBUTING.md)

## 📄 Лицензия

Apache 2.0 - см. [LICENSE](./LICENSE)