import type { OperationBatch } from '@n8n-ai/schemas';
import { OperationBatchSchema } from '@n8n-ai/schemas';
import type { AIProvider } from './providers/base.js';
import { AIProviderFactory } from './providers/factory.js';
import { getAIConfig, type AIConfig } from './config.js';
// Use minimal type to avoid cross-project TS coupling
type IntrospectAPI = any;
import { RAGSystem } from './rag/rag-system.js';
import { PromptEngineer, SYSTEM_PROMPTS, PLANNER_TEMPLATES } from './prompts/prompt-templates.js';
import { ChainOfThoughtPlanner } from './prompts/chain-of-thought.js';
import { PromptOptimizer } from './prompts/prompt-optimizer.js';
import { appMetrics as metrics } from '../monitoring/app-metrics.js';

export interface AIPlannerContext {
  prompt: string;
  currentWorkflow?: any;
  availableNodes?: string[];
  introspectAPI?: IntrospectAPI;
}

export class AIPlanner {
  private provider: AIProvider;
  private config: AIConfig;
  private nodeSchemaCache: Map<string, any> = new Map();
  private ragSystem?: RAGSystem;

  constructor(config?: AIConfig) {
    this.config = config || getAIConfig();
    this.provider = AIProviderFactory.create(this.config.providers.primary);
    
    // Initialize RAG system if enabled
    if (this.config.features.rag.enabled && process.env.QDRANT_URL) {
      this.ragSystem = new RAGSystem({
        vectorStore: {
          type: 'qdrant',
          url: process.env.QDRANT_URL,
          apiKey: process.env.QDRANT_API_KEY,
          collectionName: this.config.features.rag.collectionName,
        },
        embedder: this.provider,
        topK: this.config.features.rag.topK,
      });
    }
  }

  async plan(context: AIPlannerContext): Promise<OperationBatch> {
    try {
      // Use provided simple templates in config for tests
      const nodeSchemas = await this.getRelevantNodeSchemas(context);
      const systemTemplate = this.config.prompts.systemPrompt;
      const plannerTemplate = this.config.prompts.plannerTemplate;

      const systemPrompt = this.buildSystemPrompt(nodeSchemas, systemTemplate);
      const userPrompt = await this.buildUserPrompt(context, plannerTemplate);
      
      // Call AI
      const response = await this.provider.complete({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        maxTokens: this.config.providers.primary.maxTokens,
        responseFormat: 'json',
      });
      
      // Parse and validate response
      const operations = this.parseResponse(response.content);
      
      // Track token usage in metrics
      if (response.usage && metrics) {
        metrics.ai.tokenUsage.inc({ provider: this.config.providers.primary.model, type: 'total' }, response.usage.totalTokens || 0);
      }
      
      return operations;
    } catch (error) {
      // Log error to metrics
      metrics?.ai.planningErrors.inc({ provider: this.config.providers.primary.model, error_type: 'planning_failed' });
      
      // Fallback to pattern matching if AI fails
      if (this.config.providers.fallback) {
        return this.fallbackPlan(context);
      }
      
      throw error;
    }
  }

  private async getRelevantNodeSchemas(context: AIPlannerContext): Promise<any[]> {
    if (!context.introspectAPI) return [];
    
    const commonNodes = [
      'n8n-nodes-base.manualTrigger',
      'n8n-nodes-base.httpRequest',
      'n8n-nodes-base.webhook',
      'n8n-nodes-base.scheduleTrigger',
      'n8n-nodes-base.set',
      'n8n-nodes-base.if',
      'n8n-nodes-base.code',
      'n8n-nodes-base.merge',
      'n8n-nodes-base.splitInBatches',
    ];
    
    const schemas: any[] = [];
    for (const nodeType of commonNodes) {
      try {
        if (this.nodeSchemaCache.has(nodeType)) {
          schemas.push(this.nodeSchemaCache.get(nodeType));
        } else {
          const schema = await (context.introspectAPI as any).getNodeType?.(nodeType);
          if (schema) {
            this.nodeSchemaCache.set(nodeType, schema);
            schemas.push(schema);
          }
        }
      } catch {
        // ignore individual schema errors
      }
    }
    
    return schemas;
  }

  private buildSystemPrompt(nodeSchemas: any[], template?: string): string {
    const schemasStr = nodeSchemas.map(schema => 
      `- ${schema.name}: ${schema.description || 'No description'}`
    ).join('\n');
    
    const promptTemplate = template || this.config.prompts.systemPrompt;
    return promptTemplate.replace('{nodeSchemas}', schemasStr);
  }

  private async buildUserPrompt(context: AIPlannerContext, template?: string): Promise<string> {
    const promptTemplate = template || 'Plan for: {prompt}';
    return promptTemplate
      .replace('{prompt}', context.prompt)
      .replace('{currentWorkflow}', JSON.stringify(context.currentWorkflow || {}, null, 2))
      .replace('{availableNodes}', (context.availableNodes || []).join(', '));
  }

  private parseResponse(content: string): OperationBatch {
    const codeBlockMatch = content.match(/```json[\r\n]+([\s\S]*?)```/i) || content.match(/```[\r\n]+([\s\S]*?)```/i);
    const jsonText = codeBlockMatch ? codeBlockMatch[1] : content;
    const parsed = JSON.parse(jsonText);
    const result = OperationBatchSchema.parse(parsed);
    return result;
  }

  private async fallbackPlan(context: AIPlannerContext): Promise<OperationBatch> {
    const nodeId = 'http-1';
    return {
      version: 'v1',
      ops: [
        {
          op: 'add_node',
          node: {
            id: nodeId,
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 4,
            position: [600, 300],
            parameters: { method: 'GET', url: 'https://example.com', responseFormat: 'json' },
          },
        },
        { op: 'annotate', name: 'fallback', text: 'Basic HTTP Request created' },
      ],
    } as unknown as OperationBatch;
  }
}