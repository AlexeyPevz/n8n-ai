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

