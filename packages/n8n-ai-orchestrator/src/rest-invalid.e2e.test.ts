import { describe, it, expect, beforeAll } from 'vitest';

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

async function reqRaw(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
}

describe('REST aliases invalid batch', () => {
  beforeAll(async () => {
    await (await reqRaw('/patterns')).json();
  });

  it('rejects invalid batch via /rest/ai/graph/:id/batch', async () => {
    const r = await reqRaw('/rest/ai/graph/invalid-flow/batch', { method: 'POST', body: JSON.stringify({ ops: [{ op: 'add_node', node: { id: 'x' } }] }) });
    const json = await r.json();
    expect(r.ok).toBe(false);
    expect(json).toHaveProperty('error');
  });
});

