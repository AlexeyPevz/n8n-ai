import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { OperationBatchSchema } from '@n8n-ai/schemas';
import { SimplePlanner } from '../planner.js';
import { patternMatcher } from '../pattern-matcher.js';
import { metrics, METRICS } from '../metrics.js';
import { AmbiguousPromptError } from '../error-handler.js';
import { ModelSelector } from '../ai/model-selector.js';

export async function registerPlannerRoutes(server: FastifyInstance): Promise<void> {
  const planner = new SimplePlanner();

  server.post<{ Body: { prompt?: string } }>('/plan', async (req) => {
    return metrics.measureAsync(METRICS.API_DURATION, async () => {
      metrics.increment(METRICS.API_REQUESTS, { endpoint: 'plan' });
      const prompt = req.body?.prompt ?? '';
      if (!prompt || prompt.trim().length < 3) {
        throw new AmbiguousPromptError('Prompt is empty or too vague', {
          suggestion: 'Уточните задачу: например, "Сделай HTTP GET на https://api.example.com и выведи JSON"',
          nextActions: ['ask_clarifying_question']
        });
      }
      const batch = await planner.plan({ prompt });
      const parsed = OperationBatchSchema.safeParse(batch);
      if (!parsed.success) {
        server.log.error({ prompt, issues: parsed.error.format() }, 'Generated plan failed schema validation');
        metrics.increment(METRICS.VALIDATION_ERRORS, { type: 'plan' });
        throw new Error('invalid_generated_operation_batch');
      }
      metrics.increment(METRICS.PLAN_OPERATIONS, { count: String(parsed.data.ops.length) });
      server.log.info({ prompt, operationsCount: parsed.data.ops.length }, 'Plan created');
      return parsed.data;
    }, { endpoint: 'plan' });
  });

  server.post<{ Body: { prompt: string, category?: string } }>('/suggest', async (req) => {
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

  server.get('/patterns', async () => {
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

  server.post<{ Body: { prompt: string } }>('/ai/recommend-model', async (req) => {
    const { prompt } = req.body;
    if (!prompt) {
      return { error: 'prompt is required' };
    }
    const recommendation = (ModelSelector as any).recommend ? (ModelSelector as any).recommend(prompt) : 'gpt-4o-mini';
    const requirements = (ModelSelector as any).analyzePrompt ? (ModelSelector as any).analyzePrompt(prompt) : { latency: 'medium', context: 'short' };
    return {
      recommendation,
      requirements,
      availableModels: Object.keys(((ModelSelector as any).MODEL_CAPABILITIES) || {}),
    };
  });
}

