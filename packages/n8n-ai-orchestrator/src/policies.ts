export interface PolicyOptions {
  maxNodesAdded?: number;
  maxOpsPerBatch?: number;
  maxPayloadBytes?: number;
  domainBlacklist?: string[];
}

export interface PolicyViolation {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export function enforcePolicies(batch: { ops: Array<Record<string, any>> }, currentGraph: { nodes: Array<{ type: string; name: string; parameters?: Record<string, unknown> }> }, options?: PolicyOptions): PolicyViolation[] {
  const violations: PolicyViolation[] = [];
  const cfg: Required<PolicyOptions> = {
    maxNodesAdded: options?.maxNodesAdded ?? 20,
    maxOpsPerBatch: options?.maxOpsPerBatch ?? 500,
    maxPayloadBytes: options?.maxPayloadBytes ?? 256 * 1024,
    domainBlacklist: options?.domainBlacklist ?? []
  } as Required<PolicyOptions>;

  // 1) Размер батча
  try {
    const payloadSize = Buffer.byteLength(JSON.stringify(batch), 'utf8');
    if (payloadSize > cfg.maxPayloadBytes) {
      violations.push({ code: 'payload_too_large', message: `Batch payload exceeds ${cfg.maxPayloadBytes} bytes`, details: { payloadSize } });
    }
  } catch {}

  // 2) Количество операций
  if (batch.ops.length > cfg.maxOpsPerBatch) {
    violations.push({ code: 'too_many_ops', message: `Operation count exceeds ${cfg.maxOpsPerBatch}`, details: { ops: batch.ops.length } });
  }

  // 3) Добавленные ноды
  const addedNodes = batch.ops.filter((op) => op.op === 'add_node');
  if (addedNodes.length > cfg.maxNodesAdded) {
    violations.push({ code: 'too_many_nodes_added', message: `Added nodes exceed ${cfg.maxNodesAdded}`, details: { addedNodes: addedNodes.length } });
  }

  // 4) Доменный blacklist для HTTP Request
  const blocked: string[] = [];
  for (const op of batch.ops) {
    if (op.op === 'add_node' && op.node?.type === 'n8n-nodes-base.httpRequest') {
      const url = op.node?.parameters?.url as string | undefined;
      if (url && isBlocked(url, cfg.domainBlacklist)) blocked.push(url);
    }
    if (op.op === 'set_params') {
      const url = (op.parameters?.url ?? op.parameters?.baseUrl) as string | undefined;
      if (url && isBlocked(url, cfg.domainBlacklist)) blocked.push(url);
    }
  }
  if (blocked.length > 0) {
    violations.push({ code: 'domain_blacklist', message: 'URLs match domain blacklist', details: { urls: blocked } });
  }

  // 5) Наличие триггера в графе (требование проекта)
  const hasTrigger = currentGraph.nodes.some((n) => n.type.includes('Trigger') || n.type.includes('webhook'));
  if (!hasTrigger) {
    violations.push({ code: 'missing_trigger', message: 'Graph must contain at least one trigger node' });
  }

  return violations;
}

function isBlocked(url: string, patterns: string[]): boolean {
  try {
    const u = new URL(url, 'http://placeholder');
    const host = u.host || '';
    return patterns.some((p) => matchGlob(host, p));
  } catch {
    return false;
  }
}

function matchGlob(text: string, pattern: string): boolean {
  // очень простая поддержка '*.domain' / 'domain'
  if (pattern.startsWith('*.')) {
    const suf = pattern.slice(1); // '.domain'
    return text.endsWith(suf);
  }
  return text === pattern;
}