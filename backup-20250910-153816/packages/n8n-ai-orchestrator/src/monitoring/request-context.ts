import type { FastifyInstance, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';

export interface RequestContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    ctx?: RequestContext;
  }
}

export async function registerRequestContext(server: FastifyInstance): Promise<void> {
  // Attach request context and child logger on request
  server.addHook('onRequest', (req, reply, done) => {
    const headerId = req.headers['x-request-id'];
    const requestId = (Array.isArray(headerId) ? headerId[0] : headerId) || randomUUID();

    const ctx: RequestContext = {
      requestId,
      userId: (req.headers['x-user-id'] as string | undefined),
      sessionId: (req.headers['x-session-id'] as string | undefined),
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    };
    req.ctx = ctx;
    reply.header('x-request-id', requestId);

    // Bind child logger with context fields
    // @ts-ignore fastify logger typings
    (req as any).log = (req as any).log.child({ requestId, userId: ctx.userId, sessionId: ctx.sessionId });
    done();
  });

  // Log structured request/response summary
  server.addHook('onResponse', (req, reply, done) => {
    try {
      const ctx = req.ctx;
      const durationMs = Date.now() - ((req as any).startTime || Date.now());
      // @ts-ignore logger child exists
      (req as any).log.info({
        requestId: ctx?.requestId,
        method: req.method,
        url: req.url,
        statusCode: reply.statusCode,
        durationMs,
        userId: ctx?.userId,
        sessionId: ctx?.sessionId,
      }, 'request_completed');
    } finally {
      done();
    }
  });
}

