# Отчет о завершении Спринта 2

## Дата: 2025-10-05

### Цели спринта (3-4 недели)
- ✅ Добавить операции графа: `connect`, `set_params`, `delete`, `annotate`.
- ✅ Предвалидация (types/enums/required) + линты v0 (missing trigger, dangling branches).
- ✅ Заглушка Execution Events (SSE).
- ➖ Canvas diff цвета и «Changes» панель — реализованы в виде списочного превью c цветовой индикацией; полноценный canvas планируется в Sprint 3.

### Что реализовано
- `@n8n-ai/schemas`: расширенные Zod-схемы операций и графа.
- `@n8n-ai-orchestrator`:
  - `graph-manager.ts`: применение батчей, undo/redo, предвалидация, линты v0, симуляция и p95 оценка.
  - API: `/graph/:id/batch|undo|redo|get|validate|simulate`, `/events` (SSE heartbeat + build_progress).
  - Тесты: unit и e2e сценарии для полного цикла HTTP GET.
- `@n8n-ai-panel`: превью диффа, подсчет операций, кнопки Apply/Undo/Test, индикатор прогресса по SSE.
- Документация и OpenAPI обновлены; ADR-002/003 помечены Accepted.

### Acceptance Criteria
- Минимальный ETL собирается через дифф — подтверждено в e2e и golden flows.
- Ошибки уровня error блокируют Apply — реализовано откатом батча при неуспешной валидации.
- SSE отдаёт heartbeat каждые 15s — реализовано.
- Визуализация изменений — списочная; цвета присутствуют, canvas — в плане на Sprint 3.

### Известные ограничения
- `n8n-ai-hooks` содержит заглушки для `validate/simulate`; бизнес-логика сосредоточена в оркестраторе. Для интеграции с реальным n8n рекомендуется делегирование вызовов к оркестратору.
- Canvas diff — частично: списочный UI вместо canvas. Будет доработано в Sprint 3.

### Рекомендации
1. Делегировать validate/simulate в hooks к оркестратору для единообразия результатов.
2. Реализовать canvas-дифф в панели.
3. Начать подготовку к Sprint 3: sandbox `loadOptions`, Critic v1, улучшение симуляции.

---

**Вывод**: Спринт 2 выполнен. Требует косметического улучшения UI (canvas), но Acceptance достигнут.

