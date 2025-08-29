# Diff Policies

## Limits
- Max nodes added per batch: 20
- Max total ops per batch: 500
- Payload size limit: 256KB
- Domain blacklist: configurable (e.g., *.internal)
- Required: at least one trigger node in graph

## Validation
- Prevalidation rejects enum/required mismatch (error) и dangling branches (warn).
- Policy violations return 4xx with `code=policy_violation`.
