import { describe, it, expect, beforeAll } from 'vitest';

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

async function req(path: string, init?: RequestInit): Promise<any> {
  const r = await fetch(`${API_BASE}${path}`, { headers: { 'Content-Type': 'application/json' }, ...init });
  const json = await r.json();
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return json;
}

describe('REST aliases Critic', () => {
  beforeAll(async () => { await req('/patterns'); });

  it('critic runs via /rest/ai/graph/:id/critic', async () => {
    const plan = await req('/plan', { method: 'POST', body: JSON.stringify({ prompt: 'HTTP GET JSONPlaceholder' }) });
    await req('/rest/ai/graph/cflow/batch', { method: 'POST', body: JSON.stringify(plan) });
    const critic = await req('/rest/ai/graph/cflow/critic', { method: 'POST', body: JSON.stringify({}) });
    expect(critic).toHaveProperty('before');
    expect(critic).toHaveProperty('after');
  });
});

