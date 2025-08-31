import { describe, it, expect, beforeAll } from 'vitest';

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

async function req(path: string, init?: RequestInit): Promise<any> {
  const r = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  const json = await r.json();
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return json;
}

describe('REST aliases e2e', () => {
  beforeAll(async () => {
    // ensure server up
    await req('/patterns');
  });

  it('plan → apply → validate → simulate via /rest/ai/*', async () => {
    const plan = await req('/plan', { method: 'POST', body: JSON.stringify({ prompt: 'HTTP GET JSONPlaceholder' }) });
    const apply = await req('/rest/ai/graph/rest-demo/batch', { method: 'POST', body: JSON.stringify(plan) });
    expect(apply.ok).toBe(true);
    const validate = await req('/rest/ai/graph/rest-demo/validate?autofix=1', { method: 'POST', body: JSON.stringify({}) });
    expect(validate).toHaveProperty('ok');
    const simulate = await req('/rest/ai/graph/rest-demo/simulate', { method: 'POST', body: JSON.stringify({}) });
    expect(simulate).toHaveProperty('ok');
  });
});

