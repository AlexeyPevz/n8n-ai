import Fastify from "fastify";
import cors from "@fastify/cors";
import { OperationBatchSchema } from "@n8n-ai/schemas";
const server = Fastify({ logger: true });
await server.register(cors, { origin: true });
server.get("/introspect/nodes", async () => {
    return [
        {
            name: "HTTP Request",
            type: "n8n-nodes-base.httpRequest",
            typeVersion: 4,
            parameters: {
                method: { enum: ["GET", "POST", "PUT", "DELETE"] }
            }
        }
    ];
});
server.post("/plan", async (req) => {
    const prompt = req.body?.prompt ?? "";
    // Very naive stub: return a deterministic small batch
    const batch = {
        version: "v1",
        ops: [
            {
                op: "add_node",
                node: {
                    id: "http-1",
                    name: "Fetch",
                    type: "n8n-nodes-base.httpRequest",
                    typeVersion: 4,
                    position: [600, 300],
                    parameters: { method: "GET", url: "https://jsonplaceholder.typicode.com/todos/1" }
                }
            },
            { op: "connect", from: "Manual Trigger", to: "Fetch", index: 0 },
            { op: "annotate", name: "Fetch", text: `Plan from prompt: ${prompt.slice(0, 64)}` }
        ]
    };
    return batch;
});
server.post("/graph/:id/batch", async (req) => {
    const parsed = OperationBatchSchema.safeParse(req.body);
    if (!parsed.success) {
        return { ok: false, error: "invalid_operation_batch", issues: parsed.error.format() };
    }
    return { ok: true, undoId: `undo_${Date.now()}` };
});
server.post("/graph/:id/validate", async () => {
    return {
        ok: true,
        lints: [
            { code: "missing_trigger", level: "warn", message: "No trigger node detected" }
        ]
    };
});
server.post("/graph/:id/simulate", async () => {
    return {
        ok: true,
        stats: { nodesVisited: 5, estimatedDurationMs: 1200 }
    };
});
server.get("/events", async (req, reply) => {
    reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
    });
    const send = (event, data) => {
        reply.raw.write(`event: ${event}\n`);
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    send("hello", { sequenceId: 1, ts: Date.now() });
    const interval = setInterval(() => {
        send("heartbeat", { ts: Date.now() });
    }, 15000);
    req.raw.on("close", () => clearInterval(interval));
    return reply;
});
const port = Number(process.env.PORT ?? 3000);
server.listen({ port, host: "0.0.0.0" }).catch((err) => {
    server.log.error(err);
    process.exit(1);
});
