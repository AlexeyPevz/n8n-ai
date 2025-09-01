export interface DiffPoliciesConfig {
  maxAddNodes: number;
  domainBlacklist: string[];
}

export function getDiffPolicies(): DiffPoliciesConfig {
  const maxAddNodes = Number(process.env.DIFF_POLICY_MAX_ADD_NODES ?? 10);
  const domainBlacklist = (process.env.DIFF_POLICY_DOMAIN_BLACKLIST ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return { maxAddNodes, domainBlacklist };
}

export function validateEnv(): void {
  const required: string[] = [
    // none strictly required for dev; keep placeholders for prod hardening
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
  const num = (name: string, def: number): number => {
    const v = process.env[name];
    if (v === undefined) return def;
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error(`Invalid number env ${name}: ${v}`);
    return n;
  };
  // Validate a few numeric envs to fail-fast on typos
  num('HOOKS_FETCH_RETRIES', 2);
  num('HOOKS_FETCH_TIMEOUT_MS', 3000);
  num('SECURITY_RATE_LIMIT', 100);
  num('SECURITY_RATE_WINDOW', 60000);
}

