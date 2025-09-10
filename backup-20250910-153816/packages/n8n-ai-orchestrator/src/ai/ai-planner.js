import { OperationBatchSchema } from '@n8n-ai/schemas';
import { AIProviderFactory } from './providers/factory.js';
import { getAIConfig } from './config.js';
import { RAGSystem } from './rag/rag-system.js';
import { appMetrics as metrics } from '../monitoring/app-metrics.js';
export class AIPlanner {
    provider;
    config;
    nodeSchemaCache = new Map();
    ragSystem;
    constructor(config) {
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
    async plan(context) {
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
        }
        catch (error) {
            // Log error to metrics
            metrics?.ai.planningErrors.inc({ provider: this.config.providers.primary.model, error_type: 'planning_failed' });
            // Fallback to pattern matching if AI fails
            if (this.config.providers.fallback) {
                return this.fallbackPlan(context);
            }
            throw error;
        }
    }
    async getRelevantNodeSchemas(context) {
        if (!context.introspectAPI)
            return [];
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
                }
                else {
                    const schema = await context.introspectAPI.getNodeType?.(nodeType);
                    if (schema) {
                        this.nodeSchemaCache.set(nodeType, schema);
                        schemas.push(schema);
                    }
                }
            }
            catch {
                // ignore individual schema errors
            }
        }
        return schemas;
    }
    buildSystemPrompt(nodeSchemas, template) {
        const schemasStr = nodeSchemas.map(schema => `- ${schema.name}: ${schema.description || 'No description'}`).join('\n');
        const promptTemplate = template || this.config.prompts.systemPrompt;
        return promptTemplate.replace('{nodeSchemas}', schemasStr);
    }
    async buildUserPrompt(context, template) {
        const promptTemplate = template || 'Plan for: {prompt}';
        return promptTemplate
            .replace('{prompt}', context.prompt)
            .replace('{currentWorkflow}', JSON.stringify(context.currentWorkflow || {}, null, 2))
            .replace('{availableNodes}', (context.availableNodes || []).join(', '));
    }
    parseResponse(content) {
        const codeBlockMatch = content.match(/```json[\r\n]+([\s\S]*?)```/i) || content.match(/```[\r\n]+([\s\S]*?)```/i);
        const jsonText = codeBlockMatch ? codeBlockMatch[1] : content;
        const parsed = JSON.parse(jsonText);
        const result = OperationBatchSchema.parse(parsed);
        return result;
    }
    async fallbackPlan(context) {
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
        };
    }
}
