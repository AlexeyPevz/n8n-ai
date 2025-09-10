import { vi } from 'vitest';

// Provide a minimal fetch mock if not already mocked in tests
if (!(globalThis as any).fetch) {
  (globalThis as any).fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
}

// jsdom doesn't implement WebSocket fully; provide a noop stub to avoid console noise
if (!(globalThis as any).WebSocket) {
  class WS {
    onopen?: () => void;
    onmessage?: (ev: any) => void;
    onerror?: (ev: any) => void;
    onclose?: () => void;
    constructor() {}
    close() { this.onclose && this.onclose(); }
    send(_msg: unknown) {}
  }
  (globalThis as any).WebSocket = WS as any;
}
