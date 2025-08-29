# ADR-002: OperationBatch & Graph контракты

Дата: 2025-09-01
Статус: Proposed

## Контекст
Нужен унифицированный формат диффа и атомарное применение изменений.

## Решение
- OperationBatch v1: дискр. union (add_node, set_params, connect, delete, annotate).
- Инварианты: идемпотентность apply, optimistic-lock через graphVersion, атомарность батча,
  лимиты размеров (ops<=500, payload<=256KB), стабильные идентификаторы.

## Коды ошибок
- invalid_operation_batch
- prevalidation_failed
- conflict_graph_version
- policy_violation

## Последствия
- Безопасные автоповторы; простая история undo/redo по undoId.
