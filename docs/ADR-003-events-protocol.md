# ADR-003: Протокол событий (SSE)

Дата: 2025-09-01
Статус: Proposed

## Контекст
Нужен поток статусов исполнения и прогресса сборки.

## Решение
- SSE `/events` с `sequenceId`, heartbeat 15s, retry с экспонентой.
- События: workflow_start/finish/error, node_start/finish, build_progress.
- Поля: `{ sequenceId, ts, type, workflowId, nodeId?, payload }`.

## Последствия
- Упорядоченность по sequenceId; возможен лёгкий replay из памяти (опц.).
