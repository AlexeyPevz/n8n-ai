import Fastify from "fastify";
import cors from "@fastify/cors";
import { OperationBatchSchema } from "@n8n-ai/schemas";
import { SimplePlanner } from "./planner.js";
import { patternMatcher } from "./pattern-matcher.js";
import { graphManager } from "./graph-manager.js";
const server = Fastify({ logger: true });
// Тolerant JSON parser: treat empty body as {}
server.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try {
        if (!body || (typeof body === 'string' && body.trim() === '')) {
            done(null, {});
            return;
        }
        const parsed = typeof body === 'string' ? JSON.parse(body) : body;
        done(null, parsed);
    }
    catch (err) {
        done(err);
    }
});
await server.register(cors, { origin: true });
// Health endpoint
server.get('/api/v1/ai/health', async () => ({ status: 'ok', ts: Date.now() }));
// Простой прокси для n8n-ai-hooks Introspect API
server.get("/introspect/nodes", async () => {
    // Пытаемся проксировать в n8n-ai-hooks, если доступен
    const hooksBase = process.env.N8N_URL ?? "http://localhost:5678";
    try {
        const resp = await fetch(`${hooksBase}/api/v1/ai/introspect/nodes`);
        if (resp.ok) {
            const data = await resp.json();
            const nodes = Array.isArray(data) ? data : (data.nodes ?? []);
            if (Array.isArray(nodes) && nodes.length > 0)
                return nodes;
        }
    }
    catch (e) {
        server.log.warn({ error: e }, "Hooks introspect not available, falling back to static list");
    }
    // Фолбэк: статический список основных нод для MVP
    return [
        {
            name: "HTTP Request",
            type: "n8n-nodes-base.httpRequest",
            typeVersion: 4,
            parameters: {
                method: { enum: ["GET", "POST", "PUT", "DELETE"] },
                url: { type: "string", required: true },
                authentication: { enum: ["none", "basicAuth", "headerAuth", "oAuth2"] },
                responseFormat: { enum: ["json", "text", "binary"] }
            }
        },
        {
            name: "Webhook",
            type: "n8n-nodes-base.webhook",
            typeVersion: 1,
            parameters: {
                httpMethod: { enum: ["GET", "POST", "PUT", "DELETE"] },
                path: { type: "string", required: true }
            }
        },
        {
            name: "Schedule Trigger",
            type: "n8n-nodes-base.scheduleTrigger",
            typeVersion: 1,
            parameters: {
                rule: { type: "object" }
            }
        },
        {
            name: "Manual Trigger",
            type: "n8n-nodes-base.manualTrigger",
            typeVersion: 1,
            parameters: {}
        },
        {
            name: "Code",
            type: "n8n-nodes-base.code",
            typeVersion: 2,
            parameters: {
                language: { enum: ["javaScript", "python"] },
                jsCode: { type: "string" }
            }
        },
        {
            name: "Set",
            type: "n8n-nodes-base.set",
            typeVersion: 1,
            parameters: {
                keepOnlySet: { type: "boolean" },
                values: { type: "collection" }
            }
        }
    ];
});
const planner = new SimplePlanner();
server.post("/plan", async (req) => {
    const prompt = req.body?.prompt ?? "";
    try {
        const batch = await planner.plan({ prompt });
        const parsed = OperationBatchSchema.safeParse(batch);
        if (!parsed.success) {
            server.log.error({ prompt, issues: parsed.error.format() }, "Generated plan failed schema validation");
            throw new Error("invalid_generated_operation_batch");
        }
        server.log.info({ prompt, operationsCount: parsed.data.ops.length }, "Plan created");
        return parsed.data;
    }
    catch (error) {
        server.log.error({ error, prompt }, "Planning failed");
        throw error;
    }
});
server.post("/graph/:id/batch", async (req) => {
    const { id: workflowId } = req.params;
    // Авто-создание воркфлоу, если он отсутствует
    if (!graphManager.getWorkflow(workflowId)) {
        graphManager.createWorkflow(workflowId, `Workflow ${workflowId}`);
    }
    const parsed = OperationBatchSchema.safeParse(req.body);
    if (!parsed.success) {
        return { ok: false, error: "invalid_operation_batch", issues: parsed.error.format() };
    }
    // Применяем операции через GraphManager
    const result = graphManager.applyBatch(workflowId, parsed.data);
    if (result.success) {
        server.log.info({
            workflowId,
            appliedOperations: result.appliedOperations,
            undoId: result.undoId
        }, "Operations applied successfully");
        return {
            ok: true,
            undoId: result.undoId,
            appliedOperations: result.appliedOperations
        };
    }
    else {
        server.log.error({ workflowId, error: result.error }, "Failed to apply operations");
        return {
            ok: false,
            error: result.error
        };
    }
});
server.post("/graph/:id/validate", async (req) => {
    const { id: workflowId } = req.params;
    const validationResult = graphManager.validate(workflowId);
    return {
        ok: validationResult.valid,
        lints: validationResult.lints
    };
});
server.post("/graph/:id/simulate", async (req) => {
    const { id: workflowId } = req.params;
    const simulationResult = graphManager.simulate(workflowId);
    return simulationResult;
});
server.post("/graph/:id/undo", async (req) => {
    const { id: workflowId } = req.params;
    const { undoId } = req.body || {};
    const result = graphManager.undo(workflowId, undoId);
    if (result.success) {
        server.log.info({ workflowId, undoId: result.undoId }, "Undo successful");
        return {
            ok: true,
            undoId: result.undoId,
            undoneOperations: result.appliedOperations
        };
    }
    else {
        return { ok: false, error: result.error };
    }
});
server.post("/graph/:id/redo", async (req) => {
    const { id: workflowId } = req.params;
    const result = graphManager.redo(workflowId);
    if (result.success) {
        server.log.info({ workflowId }, "Redo successful");
        return {
            ok: true,
            redoneOperations: result.appliedOperations
        };
    }
    else {
        return { ok: false, error: result.error };
    }
});
// Endpoint для получения текущего состояния воркфлоу
server.get("/graph/:id", async (req) => {
    const { id: workflowId } = req.params;
    const workflow = graphManager.getWorkflow(workflowId);
    if (workflow) {
        return { ok: true, workflow };
    }
    else {
        return { ok: false, error: 'Workflow not found' };
    }
});
server.get("/patterns", async () => {
    const categories = patternMatcher.getCategories();
    return {
        categories,
        totalPatterns: patternMatcher['patterns'].length,
        examples: categories.slice(0, 5).map(cat => ({
            category: cat,
            patterns: patternMatcher.suggestByCategory(cat).slice(0, 3).map(p => ({
                name: p.name,
                keywords: p.keywords,
                nodeCount: p.nodes.length
            }))
        }))
    };
});
server.post("/suggest", async (req) => {
    const { prompt, category } = req.body;
    if (category) {
        const patterns = patternMatcher.suggestByCategory(category);
        return {
            category,
            patterns: patterns.map(p => ({
                name: p.name,
                description: `Workflow with ${p.nodes.length} nodes: ${p.nodes.map(n => n.name).join(' → ')}`
            }))
        };
    }
    const matches = patternMatcher.findMatchingPatterns(prompt);
    return {
        prompt,
        suggestions: matches.slice(0, 5).map(m => ({
            pattern: m.pattern.name,
            score: m.score,
            matchedKeywords: m.matchedKeywords,
            preview: m.pattern.nodes.map(n => n.name).join(' → ')
        }))
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
async function start() {
    let port = Number(process.env.PORT ?? 3000);
    try {
        await server.listen({ port, host: '0.0.0.0' });
    }
    catch (err) {
        if (err?.code === 'EADDRINUSE') {
            server.log.warn({ port }, 'Port in use, retrying on 0');
            port = 0;
            await server.listen({ port, host: '0.0.0.0' });
        }
        else {
            server.log.error(err);
            process.exit(1);
        }
    }
}
start();
