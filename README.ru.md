# n8n-ai: AI-first конструктор воркфлоу для n8n

## 1. Видение
Сделать n8n **AI-first**: пользователь описывает цель на естественном языке, ассистент детерминированно строит/рефакторит воркфлоу, валидирует и тестирует его, затем показывает визуальный diff перед применением изменений.

Ключевые цели:
1. Цикл **Describe → Plan → Preview → Apply → Test → Fix** прямо в редакторе.
2. **Schema-Guided Reasoning (SGR)** — вывод LLM строго валидируется по JSON-схемам нод, графа и операций-диффов.
3. **Workflow Map** — статическая карта зависимостей + live-статусы и оценка стоимости исполнения нескольких воркфлоу.
4. **Управление и безопасность** — работа только с credentialRef, политики диффов, аудит, undo/redo.
5. **Рефакторинг** — замена нод, выделение под-воркфлоу, оптимизация батчей.

---

## 2. Высокоуровневая архитектура
```
        ┌────────────┐        Graph/Validate/Simulate        ┌────────────┐
        │ n8n (fork) │  <───────────────────────────────┐    │   UI:      │
        │  + hooks   │         events / introspect      │    │ Редактор + │
        └────┬───────┘                                   │    │ AI-панель  │
             │ Introspect API                            │    │  Карта     │
             │ Graph Mutation API ───────────────────────┼──▶ └────────────┘
             │ Validate / Simulate API                   │
             │ Execution Events (SSE/WS)                 │
             ▼                                           │
        ┌────────────────┐  RAG / SGR / Агенты  ┌───────▼─────────┐
        │  Orchestrator  │  (Planner/Builder/   │  Кэш схем,      │
        │  (сайдкар)     │  Validator/Critic)   │  рецепты        │
        └────────────────┘                      └─────────────────┘
```

### 2.1 Тонкий форк n8n (`n8n-ai-hooks`)
* **Introspect API** — описание нод в рантайме + sandbox `loadOptions`.
* **Graph Mutation API** — типизированные batch-операции (`add_node`, `set_params`, …) с предвалидацией и undo/redo.
* **Validate & Simulate API** — статическая и контекстная проверка, dry-run на синтетике.
* **Execution Events** — поток SSE/WebSocket (`start|finish|error`) для воркфлоу/нод.

### 2.2 Сайдкар-оркестратор (`n8n-ai-orchestrator`)
* Мульти-агентный цикл: **Planner → Builder → Validator → Critic**.
* **RAG** по официальной документации, примерам и исходникам нод.
* **Кэш схем**, авто-ремонт, логирование, метрики и стоимость.

### 2.3 Общий пакет (`n8n-ai-schemas`)
* Определения Zod/JSONSchema для Node, Graph, OperationBatch, Lints.

### 2.4 Опциональная панель (`n8n-ai-panel`)
* Встраиваемое SPA, если понадобится изоляция iframe.

---

## 3. Базовые концепции
### 3.1 Schema-Guided Reasoning (SGR)
* **NodeSchema** — типы, required/enums, зависимости, резолв `loadOptions`.
* **GraphSchema** — допустимые связи и операции.
* **OperationBatch** — атомарный формат диффа.

Пример:
```json
{
  "ops": [
    { "op": "add_node", "node": { "id": "http-1", "type": "n8n-nodes-base.httpRequest", "parameters": { "method": "GET", "url": "https://api.example.com" } } },
    { "op": "connect", "from": "Manual Trigger", "to": "http-1" },
    { "op": "annotate", "name": "http-1", "text": "GET, так как endpoint read-only" }
  ]
}
```

### 3.2 Роли интерфейса
* **AI-панель (sidebar)** — чат, уточнения, карточка плана, превью диффа, apply/undo.
* **Канвас** — live-diff цвета (зелёный/жёлтый/красный), контекстные действия.
* **Secrets Wizard** — модальное окно выбора/создания credential, тест коннекта.
* **Workflow Map** — карта зависимостей + live-статусы и стоимость.

Состояния: `Idle → Clarifying → Planning → Review → Secrets → Building → Testing → Done/Debug`.

---

## 4. Структура репозитория
```
/ .gitignore
  README.md            ← англ. версия
  README.ru.md         ← русская версия
  pnpm-workspace.yaml
  docker-compose.yml   ← dev-стек (n8n fork + orchestrator + redis + qdrant)
  /packages
    n8n-ai-hooks
    n8n-ai-orchestrator
    n8n-ai-schemas
    n8n-ai-panel
  /examples            ← golden flows & regression fixtures
  /docs                ← ADR, API reference, схемы
```

---

## 5. Быстрый старт
### 5.1 Зависимости
* Node 20 + pnpm `>=8`
* Docker & Docker-Compose
* Make (опционально)

### 5.2 Клонирование и запуск
```bash
git clone https://github.com/your-org/n8n-ai.git
cd n8n-ai
pnpm install
pnpm run dev
```
UI: `http://localhost:5678` (n8n) и `http://localhost:3000` (AI-панель).

### 5.3 Тесты
```bash
pnpm test   # unit + lints
pnpm e2e    # регрессия golden flows (Playwright)
```

---

## 6. Процесс разработки
| Стадия | Инструменты |
|--------|-------------|
| Lint   | ESLint + Prettier (strict) |
| Types  | TypeScript `strict` mode |
| Commits| Conventional Commits |
| Branch | Trunk-based + feature-flags |
| CI     | GitHub Actions: lint → unit → build → Validate/Simulate |
| CD     | (опц.) PR preview stack |

### 6.1 Чек-лист PR
1. Зелёный CI.
2. Обновлённые доки / миграции схем.
3. Тесты.
4. Запись в changelog.

---

## 7. План спринтов (12 недель)
### Неделя 0 — Инициализация
* Scaffold репозиториев, dev-stack, базовые схемы.

### Спринт 1 (1-2 нед) — Вертикальный срез 0
* Introspect API v0, Graph `add_node`, валидация OperationBatch.
* AI-панель MVP: Describe → HTTP GET → diff → Apply/Undo.
* 10 golden flows + CI.

### Спринт 2 (3-4 нед) — Связи и валидация
* Ops: `connect`, `set_params`, `delete`, `annotate`.
* Предвалидация, линты v0, Canvas diff.

### Спринт 3 (5-7 нед) — Динамика и симуляция
* sandbox `loadOptions`, Simulate API, Critic v1, автодополнение `={{ }}`.

### Спринт 4 (8-9 нед) — Workflow Map
* Индекс зависимостей, REST/WS, Map Tab.

### Спринт 5 (10-11 нед) — Governance, Git, рефакторинг
* Политики diff, аудит, Git PR, refactor ops.

### Неделя 12 — Полировка
* Перф, UX, Secrets Wizard v1, Explain-node, доки, демо.

---

## 8. API (кратко)
* `GET /introspect/nodes`
* `POST /graph/:id/batch`
* `POST /graph/:id/validate`
* `POST /graph/:id/simulate`
* SSE `/events`

---

## 9. Тестирование
* Vitest unit.
* Playwright e2e golden flows.
* Snapshot диффов.

---

## 10. Безопасность и управление
* Only credentialRef.
* Политики diff.
* Аудит (userId, promptHash, diffHash, модель, cost).
* Undo/Redo как стек diff-ов.

---

## 11. Гайд по вкладу
1. Форк/клон.
2. `pnpm install && pnpm run dev`.
3. Conventional Commits.
4. Тесты.
5. PR c шаблоном.

---

## 12. Лицензия
Apache-2.0 + notice для AI-компонент.

---

## 13. Дальнейший роадмап
* Yield/Resume расширение Wait-ноды.
* SLA алерты, прогноз стоимости.
* Файн-тюн на публичных воркфлоу.
* Локализация запросов.

---

_© 2024 проект n8n-ai_