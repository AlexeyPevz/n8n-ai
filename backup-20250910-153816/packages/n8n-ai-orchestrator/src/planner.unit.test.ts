import { describe, it, expect } from 'vitest';
import { SimplePlanner } from './planner.js';

describe('SimplePlanner', () => {
  it('generates HTTP workflow for API prompts', async () => {
    const p = new SimplePlanner();
    const res = await p.plan({ prompt: 'Create HTTP GET to https://jsonplaceholder.typicode.com/users' });
    expect(res.version).toBe('v1');
    expect(Array.isArray(res.ops)).toBe(true);
    const add = res.ops.find(op => (op as any).op === 'add_node') as any;
    expect(add?.node?.type).toBe('n8n-nodes-base.httpRequest');
  });

  it('defaults to GET when method is unspecified', async () => {
    const p = new SimplePlanner();
    const res = await p.plan({ prompt: 'fetch api https://api.example.com' });
    const add = res.ops.find(op => (op as any).op === 'add_node') as any;
    expect(add?.node?.parameters?.method).toBe('GET');
  });
});

