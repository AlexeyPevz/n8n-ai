export interface AIProviderConfig {
  provider: 'openai' | 'anthropic' | 'ollama';
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIConfig {
  providers: {
    primary: AIProviderConfig;
    fallback?: AIProviderConfig;
  };
  features: {
    rag: {
      enabled: boolean;
      collectionName: string;
      topK: number;
    };
    caching: {
      enabled: boolean;
      ttlSeconds: number;
    };
    streaming: boolean;
  };
  prompts: {
    systemPrompt: string;
    plannerTemplate: string;
    criticTemplate: string;
  };
}

export function getAIConfig(): AIConfig {
  return {
    providers: {
      primary: {
        provider: (process.env.AI_PROVIDER as any) || 'openai',
        apiKey: process.env.AI_API_KEY,
        baseUrl: process.env.AI_BASE_URL,
        model: process.env.AI_MODEL || 'gpt-4-turbo-preview',
        temperature: Number(process.env.AI_TEMPERATURE || 0.3),
        maxTokens: Number(process.env.AI_MAX_TOKENS || 4000),
      },
      fallback: process.env.AI_FALLBACK_PROVIDER ? {
        provider: process.env.AI_FALLBACK_PROVIDER as any,
        apiKey: process.env.AI_FALLBACK_API_KEY,
        model: process.env.AI_FALLBACK_MODEL || 'claude-3-sonnet-20240229',
      } : undefined,
    },
    features: {
      rag: {
        enabled: process.env.AI_RAG_ENABLED === 'true',
        collectionName: process.env.AI_RAG_COLLECTION || 'n8n-docs',
        topK: Number(process.env.AI_RAG_TOP_K || 5),
      },
      caching: {
        enabled: process.env.AI_CACHE_ENABLED !== 'false',
        ttlSeconds: Number(process.env.AI_CACHE_TTL || 3600),
      },
      streaming: process.env.AI_STREAMING === 'true',
    },
    prompts: {
      systemPrompt: process.env.AI_SYSTEM_PROMPT || getDefaultSystemPrompt(),
      plannerTemplate: process.env.AI_PLANNER_TEMPLATE || getDefaultPlannerTemplate(),
      criticTemplate: process.env.AI_CRITIC_TEMPLATE || getDefaultCriticTemplate(),
    },
  };
}

function getDefaultSystemPrompt(): string {
  return `You are an expert n8n workflow automation assistant. Your role is to help users create, modify, and optimize n8n workflows.

Key principles:
1. Always produce valid n8n workflow operations that follow the schema
2. Prefer simple, maintainable solutions over complex ones
3. Use appropriate nodes for each task (HTTP Request for APIs, Schedule Trigger for cron, etc.)
4. Ensure proper error handling and data validation
5. Follow n8n best practices for performance and reliability

You have access to the following node types and their schemas:
{nodeSchemas}

When creating workflows:
- Start with appropriate trigger nodes
- Connect nodes logically
- Set required parameters
- Add helpful annotations
- Consider error cases`;
}

function getDefaultPlannerTemplate(): string {
  return `Given the user request: "{prompt}"

And the current workflow state:
{currentWorkflow}

Available nodes:
{availableNodes}

Generate a plan to fulfill this request as a series of operations.
Think step by step:
1. What is the user trying to achieve?
2. What nodes are needed?
3. How should they be connected?
4. What parameters need to be set?

Respond with a valid OperationBatch JSON object.`;
}

function getDefaultCriticTemplate(): string {
  return `Review this workflow for issues:
{workflow}

Validation errors found:
{errors}

Suggest fixes for these issues. Focus on:
1. Missing required parameters
2. Invalid connections
3. Type mismatches
4. Best practices violations

Respond with a valid OperationBatch JSON object containing fix operations.`;
}