import { describe, it, expect, beforeAll } from 'vitest';

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

async function req(path: string, init?: RequestInit): Promise<any> {
  const r = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', 'x-user-id': 'e2e-user' },
    ...init,
  });
  const json = await r.json();
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return json;
}

describe('REST audit logs', () => {
  beforeAll(async () => { await req('/patterns'); });

  it('logs batch apply and exposes via /rest/ai/audit/logs', async () => {
    const plan = await req('/plan', { method: 'POST', body: JSON.stringify({ prompt: 'HTTP GET JSONPlaceholder' }) });
    const apply = await req('/rest/ai/graph/audit-demo/batch', { method: 'POST', body: JSON.stringify(plan) });
    expect(apply.ok).toBe(true);
    const audit = await req('/rest/ai/audit/logs');
    expect(Array.isArray(audit.items)).toBe(true);
    const has = audit.items.some((e: any) => e.workflowId === 'audit-demo' && e.userId === 'e2e-user');
    expect(has).toBe(true);
  });
});

