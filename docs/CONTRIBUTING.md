# Contributing

## Dev setup
- Node 20+, pnpm 8+, Docker, Docker Compose.
- `pnpm install` → `pnpm run dev` (compose + orchestrator + panel).

## Branching / Commits
- Trunk-based, короткие фича-ветки.
- Conventional Commits: feat/fix/docs/chore/refactor/test/perf/build.

## Quality gates
- TypeScript strict, ESLint+Prettier, unit tests (vitest), e2e (Playwright).
- CI: lint → unit → build → validate/simulate golden flows.

## PR checklist
- Зеленый CI, тесты обновлены, доки/схемы обновлены, Changelog (если уместно).
