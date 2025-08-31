import type { OperationBatch } from '@n8n-ai/schemas';
import { OperationBatchSchema } from '@n8n-ai/schemas';
import type { AIProvider } from './providers/base.js';
import { AIProviderFactory } from './providers/factory.js';
import { getAIConfig, type AIConfig } from './config.js';
import type { IntrospectAPI } from '../../../n8n-ai-hooks/introspect-api.js';
import { RAGSystem } from './rag/rag-system.js';

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
      // Get node schemas if we have introspect API
      const nodeSchemas = await this.getRelevantNodeSchemas(context);
      
      // Build the prompt
      const systemPrompt = this.buildSystemPrompt(nodeSchemas);
      const userPrompt = await this.buildUserPrompt(context);
      
      // Call AI
      const response = await this.provider.complete({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: this.config.providers.primary.temperature,
        maxTokens: this.config.providers.primary.maxTokens,
        responseFormat: 'json',
      });
      
      // Parse and validate response
      const operations = this.parseResponse(response.content);
      
      // Log token usage for monitoring
      if (response.usage) {
        console.info('AI token usage:', response.usage);
      }
      
      return operations;
    } catch (error) {
      console.error('AI planning failed:', error);
      
      // Fallback to pattern matching if AI fails
      if (this.config.providers.fallback) {
        return this.fallbackPlan(context);
      }
      
      throw error;
    }
  }

  private async getRelevantNodeSchemas(context: AIPlannerContext): Promise<any[]> {
    if (!context.introspectAPI) return [];
    
    // For now, return common nodes. In future, use RAG to find relevant ones
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
    
    const schemas = [];
    for (const nodeType of commonNodes) {
      try {
        if (this.nodeSchemaCache.has(nodeType)) {
          schemas.push(this.nodeSchemaCache.get(nodeType));
        } else {
          const schema = await context.introspectAPI.getNodeType(nodeType);
          if (schema) {
            this.nodeSchemaCache.set(nodeType, schema);
            schemas.push(schema);
          }
        }
      } catch (error) {
        console.warn(`Failed to get schema for ${nodeType}:`, error);
      }
    }
    
    return schemas;
  }

  private buildSystemPrompt(nodeSchemas: any[]): string {
    const schemasStr = nodeSchemas.map(schema => 
      `- ${schema.name}: ${schema.description || 'No description'}`
    ).join('\n');
    
    return this.config.prompts.systemPrompt.replace('{nodeSchemas}', schemasStr);
  }

  private async buildUserPrompt(context: AIPlannerContext): Promise<string> {
    let prompt = this.config.prompts.plannerTemplate
      .replace('{prompt}', context.prompt)
      .replace('{currentWorkflow}', JSON.stringify(context.currentWorkflow || {}, null, 2))
      .replace('{availableNodes}', (context.availableNodes || []).join(', '));
    
    // Add RAG context if available
    if (this.ragSystem) {
      try {
        const ragContext = await this.ragSystem.getContext({
          query: context.prompt,
          nodeTypes: context.availableNodes,
          workflowContext: context.currentWorkflow,
        });
        
        if (ragContext) {
          prompt = ragContext + '\n\n' + prompt;
        }
      } catch (error) {
        console.warn('Failed to get RAG context:', error);
      }
    }
    
    // Add examples for better results
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
    },
    {
      "op": "connect",
      "from": "Manual Trigger",
      "to": "HTTP Request",
      "index": 0
    }
  ]
}`;
    
    return prompt;
  }

  private parseResponse(content: string): OperationBatch {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      
      const parsed = JSON.parse(jsonStr);
      
      // Validate with schema
      const validated = OperationBatchSchema.parse(parsed);
      
      return validated;
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      console.error('Raw response:', content);
      
      // Try to extract operations even if format is wrong
      const fallback: OperationBatch = {
        version: 'v1',
        ops: [],
      };
      
      // Look for operation-like structures
      const addNodeMatch = content.match(/"op"\s*:\s*"add_node"/);
      if (addNodeMatch) {
        // AI tried to create operations but format was wrong
        throw new Error('AI response format invalid. Please try again with clearer instructions.');
      }
      
      return fallback;
    }
  }

  private async fallbackPlan(context: AIPlannerContext): Promise<OperationBatch> {
    // Simple pattern-based fallback
    const promptLower = context.prompt.toLowerCase();
    
    if (promptLower.includes('http') || promptLower.includes('api')) {
      return {
        version: 'v1',
        ops: [
          {
            op: 'add_node',
            node: {
              id: 'http-1',
              name: 'HTTP Request',
              type: 'n8n-nodes-base.httpRequest',
              typeVersion: 4,
              position: [600, 300],
              parameters: {
                method: 'GET',
                url: 'https://api.example.com/data',
                responseFormat: 'json',
              },
            },
          },
          {
            op: 'connect',
            from: 'Manual Trigger',
            to: 'HTTP Request',
          },
        ],
      };
    }
    
    return {
      version: 'v1',
      ops: [],
    };
  }
}