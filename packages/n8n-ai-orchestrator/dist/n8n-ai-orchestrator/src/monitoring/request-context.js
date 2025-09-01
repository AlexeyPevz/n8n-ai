import { randomUUID } from 'node:crypto';
export async function registerRequestContext(server) {
    // Attach request context and child logger on request
    server.addHook('onRequest', (req, reply, done) => {
        const headerId = req.headers['x-request-id'];
        const requestId = (Array.isArray(headerId) ? headerId[0] : headerId) || randomUUID();
        const ctx = {
            requestId,
            userId: req.headers['x-user-id'],
            sessionId: req.headers['x-session-id'],
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        };
        req.ctx = ctx;
        reply.header('x-request-id', requestId);
        // Bind child logger with context fields
        // @ts-ignore fastify logger typings
        req.log = req.log.child({ requestId, userId: ctx.userId, sessionId: ctx.sessionId });
        done();
    });
    // Log structured request/response summary
    server.addHook('onResponse', (req, reply, done) => {
        try {
            const ctx = req.ctx;
            const durationMs = Date.now() - (req.startTime || Date.now());
            // @ts-ignore logger child exists
            req.log.info({
                requestId: ctx?.requestId,
                method: req.method,
                url: req.url,
                statusCode: reply.statusCode,
                durationMs,
                userId: ctx?.userId,
                sessionId: ctx?.sessionId,
            }, 'request_completed');
        }
        finally {
            done();
        }
    });
}
