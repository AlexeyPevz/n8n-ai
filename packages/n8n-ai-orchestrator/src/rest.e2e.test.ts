import { describe, it, expect } from 'vitest';

const BASE = process.env.TEST_BASE || 'http://127.0.0.1:3000';

async function j<T = any>(res: Response): Promise<T> {
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error(`Invalid JSON: ${text}`); }
}

describe('REST E2E', () => {
  it('health returns ok', async () => {
    const res = await fetch(`${BASE}/api/v1/ai/health`);
    expect(res.ok).toBe(true);
    const body = await j(res);
    expect(body.status).toBe('ok');
  });

  it('introspect nodes returns array', async () => {
    const res = await fetch(`${BASE}/introspect/nodes`);
    expect(res.ok).toBe(true);
    const body = await j(res);
    expect(Array.isArray(body)).toBe(true);
  });

  it('plan creates batch for simple prompt', async () => {
    const res = await fetch(`${BASE}/plan`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: 'make http get to jsonplaceholder' }) });
    expect(res.ok).toBe(true);
    const body = await j(res);
    expect(body).toHaveProperty('version');
    expect(Array.isArray(body.ops)).toBe(true);
  });

  it('graph batch apply/validate basic flow', async () => {
    const wf = 'wf-e2e';
    const batch = { version: 'v1', ops: [ { op: 'add_node', node: { id: 'manual', name: 'Manual Trigger', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [250,300] } } ] } as any;
    const apply = await fetch(`${BASE}/graph/${wf}/batch`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(batch) });
    expect(apply.ok).toBe(true);
    const applied = await j(apply);
    expect(applied.ok).toBe(true);
    const validate = await fetch(`${BASE}/graph/${wf}/validate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(batch) });
    expect(validate.ok).toBe(true);
    const val = await j(validate);
    expect(val).toHaveProperty('ok');
  });
});

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
    try {
      await req('/api/v1/ai/health');
    } catch (error) {
      console.error('Server not running. Use: pnpm test:rest:e2e');
      throw error;
    }
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

