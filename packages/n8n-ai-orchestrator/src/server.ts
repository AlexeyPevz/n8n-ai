import Fastify from "fastify";
import cors from "@fastify/cors";
import { OperationBatchSchema } from "@n8n-ai/schemas";
import { SimplePlanner } from "./planner.js";
import { patternMatcher } from "./pattern-matcher.js";

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

const planner = new SimplePlanner();

server.post<{ Body: { prompt?: string } }>("/plan", async (req) => {
  const prompt = req.body?.prompt ?? "";
  
  try {
    const batch = await planner.plan({ prompt });
    server.log.info({ prompt, operationsCount: batch.ops.length }, "Plan created");
    return batch;
  } catch (error) {
    server.log.error({ error, prompt }, "Planning failed");
    throw error;
  }
});

server.post<{
  Params: { id: string };
  Body: unknown;
}>("/graph/:id/batch", async (req) => {
  const parsed = OperationBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return { ok: false, error: "invalid_operation_batch", issues: parsed.error.format() };
  }
  return { ok: true, undoId: `undo_${Date.now()}` };
});

server.post<{ Params: { id: string } }>("/graph/:id/validate", async () => {
  return {
    ok: true,
    lints: [
      { code: "missing_trigger", level: "warn", message: "No trigger node detected" }
    ]
  };
});

server.post<{ Params: { id: string } }>("/graph/:id/simulate", async () => {
  return {
    ok: true,
    stats: { nodesVisited: 5, estimatedDurationMs: 1200 }
  };
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

server.post<{ Body: { prompt: string, category?: string } }>("/suggest", async (req) => {
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
  const send = (event: string, data: unknown) => {
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

