# Environment Variables

Key variables and examples (see `.env.example`):

- N8N_URL — base URL to n8n (hooks)
- HOOKS_FETCH_RETRIES, HOOKS_FETCH_TIMEOUT_MS — proxy timeouts
- SECURITY_* — security presets (API keys, rate limits, CORS, headers)
- QDRANT_URL, QDRANT_API_KEY — vector store
- OPENROUTER_* — AI provider keys
- CRITIC_MAX_TRIES — auto-fix attempts
- USE_HOOKS, USE_HOOKS_* — delegate to hooks for validate/simulate

Populate `.env` in compose or export in shell before start.