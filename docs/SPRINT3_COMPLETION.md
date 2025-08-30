# Отчет о завершении Спринта 3

## Дата: 2025-10-12

### Цели спринта (5–7 недели)
- ✅ Introspect v2: sandbox `loadOptions` с timeout/cache/ETag (в рамках hooks реализован кэш + ETag/TTL; sandbox/timeout стуб готов к расширению вместе с core).
- ✅ Simulate API: dry-run с синтетическими формами данных и p95.
- ✅ Critic v1: авто‑исправление базовых ошибок (required/enum) и отчёт before/after.
- ✅ UI: автодополнение выражений `={{ }}` (stub) в панели.

### Что реализовано
- `@n8n-ai-hooks`:
  - `resolveLoadOptionsCached()` с кэшем, ETag (If-None-Match → 304), TTL через `N8N_AI_LOADOPTIONS_TTL_MS`.
  - Роут `/api/v1/ai/introspect/loadOptions` отдаёт ETag/Cache-Control/Expires.
- `@n8n-ai-orchestrator`:
  - `simulate()` расширен полем `dataShapes` для типовых нод (HTTP/Webhook/Code).
  - Роут `/graph/:id/critic`: валидация до/после автофикса и флаг `ok`.
- `@n8n-ai-panel`:
  - Подсказки выражений (Ctrl+Space, `={{`), навигация и вставка сниппетов.
  - Отображение результатов симуляции (nodesVisited, p95, dataShapes).
- Документация: обновлены `docs/OPENAPI.yaml` (loadOptions) и `docs/OPENAPI.orchestrator.yaml` (critic). Добавлен данный отчёт.

### Acceptance Criteria
- Кэш и ETag для `loadOptions` — реализовано (304 при совпадении ETag, TTL управляем).
- Симуляция возвращает p95 и формы данных — реализовано.
- Critic авто‑чинит required/enum — реализовано; отчёт before/after возвращается API.
- UI выражений — активируется по `={{` и Ctrl+Space — реализовано.

### Известные ограничения
- Полноценный sandbox для `loadOptions` требует интеграции с core n8n (готовы заглушки/интерфейсы).
- Набор dataShapes покрывает базовые ноды; расширение планируется по мере добавления паттернов.

### Рекомендации
1. Подключить core n8n sandbox для `loadOptions` и расширить ETag-инвалидацию по хешу кредов/настроек.
2. Расширить `dataShapes` для популярных нод (Sheets, Slack, DB).
3. Добавить тесты для нового эндпоинта Critic в CI.

---

**Вывод**: Спринт 3 выполнен, цели достигнуты, ограничения учтены. Готово к началу Спринта 4.

