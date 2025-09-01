import type { OperationBatch } from '@n8n-ai/schemas';
import { OperationBatchSchema } from '@n8n-ai/schemas';
import type { AIProvider } from './providers/base.js';
import { AIProviderFactory } from './providers/factory.js';
import { getAIConfig, type AIConfig } from './config.js';
import type { IntrospectAPI } from '../../../n8n-ai-hooks/introspect-api.js';
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
      // Analyze complexity
      const complexity = PromptEngineer.analyzeComplexity(context.prompt);
      const useChainOfThought = complexity !== 'simple';
      
      // Get node schemas if we have introspect API
      const nodeSchemas = await this.getRelevantNodeSchemas(context);
      
      // Select appropriate templates
      const systemTemplate = PromptEngineer.selectTemplate(
        { complexity, requestType: 'create' },
        'system'
      );
      const plannerTemplate = PromptEngineer.selectTemplate(
        { complexity, requestType: 'create' },
        'planner'
      );
      
      // Build prompts
      const systemPrompt = this.buildSystemPrompt(nodeSchemas, systemTemplate);
      let userPrompt = await this.buildUserPrompt(context, plannerTemplate);
      
      // Optimize prompt
      userPrompt = PromptOptimizer.optimize(userPrompt, {
        taskType: 'create',
        expectedOutput: 'OperationBatch JSON',
        constraints: [
          'Use only available node types',
          'Follow n8n connection rules',
          'Include proper error handling',
        ],
        examples: PromptOptimizer.generateContextualExamples('create', context.availableNodes || []),
      }, {
        useChainOfThought,
        includeConstraints: true,
        formatOutput: true,
        addExamples: complexity !== 'simple',
      });
      
      // Use chain of thought for complex requests
      if (useChainOfThought) {
        const thoughtSteps = ChainOfThoughtPlanner.decomposeRequest(context.prompt);
        const reasoning = ChainOfThoughtPlanner.generateReasoning(thoughtSteps);
        
        // Add reasoning to prompt
        userPrompt = reasoning + '\n\n' + userPrompt;
      }
      
      // Call AI
      const response = await this.provider.complete({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: complexity === 'simple' ? 0.3 : 0.5,
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
    const promptTemplate = template || this.config.prompts.plannerTemplate;
    let prompt = promptTemplate
      .replace('{prompt}', context.prompt)
      .replace('{currentWorkflow}', JSON.stringify(context.currentWorkflow || {}, null, 2))
      .replace('{availableNodes}', (context.availableNodes || []).join(', '));
    
    if (this.ragSystem) {
      try {
        const ragContext = await this.ragSystem.getContext({
          query: context.prompt,
          nodeTypes: context.availableNodes,
          workflowContext: context.currentWorkflow,
        });
        if (ragContext) prompt = ragContext + '\n\n' + prompt;
      } catch {}
    }
    
    prompt += `

Example response format:
{
  "version": "v1",
  "ops": [
    {
      "op": "add_node",
      "node": {
        "id": "http-1",
        "name": "HTTP Request",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4,
        "position": [600, 300],
        "parameters": {
          "method": "GET",
          "url": "https://api.example.com/data",
          "responseFormat": "json"
        }
      }
    }
  ]
}`;
    
    return prompt;
  }

  private parseResponse(content: string): OperationBatch {
    try {
      const parsed = JSON.parse(content);
      const result = OperationBatchSchema.parse(parsed);
      return result;
    } catch (error) {
      // Very minimal fallback safe batch
      return { version: 'v1', ops: [] } as OperationBatch;
    }
  }

  private async fallbackPlan(context: AIPlannerContext): Promise<OperationBatch> {
    return {
      version: 'v1',
      ops: [],
    };
  }
}