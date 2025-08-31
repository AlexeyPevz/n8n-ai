import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIPlanner } from './ai-planner.js';
import type { AIConfig } from './config.js';
import type { OperationBatch } from '@n8n-ai/schemas';

// Mock the provider factory
vi.mock('./providers/factory.js', () => ({
  AIProviderFactory: {
    create: vi.fn(() => ({
      complete: vi.fn(),
      embed: vi.fn(),
    })),
  },
}));

describe('AIPlanner', () => {
  let planner: AIPlanner;
  let mockProvider: any;
  
  const mockConfig: AIConfig = {
    providers: {
      primary: {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4',
        temperature: 0.3,
        maxTokens: 4000,
      },
    },
    features: {
      rag: { enabled: false, collectionName: 'test', topK: 5 },
      caching: { enabled: false, ttlSeconds: 3600 },
      streaming: false,
    },
    prompts: {
      systemPrompt: 'You are a test assistant. {nodeSchemas}',
      plannerTemplate: 'Plan for: {prompt}',
      criticTemplate: 'Fix: {errors}',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    planner = new AIPlanner(mockConfig);
    
    // Get the mocked provider
    const { AIProviderFactory } = await import('./providers/factory.js');
    mockProvider = (AIProviderFactory.create as any).mock.results[0].value;
  });

  it('should create a plan from AI response', async () => {
    const mockResponse: OperationBatch = {
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
              url: 'https://api.example.com',
            },
          },
        },
      ],
    };

    mockProvider.complete.mockResolvedValue({
      content: JSON.stringify(mockResponse),
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    });

    const result = await planner.plan({
      prompt: 'Create HTTP GET request',
    });

    expect(result).toEqual(mockResponse);
    expect(mockProvider.complete).toHaveBeenCalledWith({
      messages: [
        { role: 'system', content: 'You are a test assistant. ' },
        { role: 'user', content: expect.stringContaining('Create HTTP GET request') },
      ],
      temperature: 0.3,
      maxTokens: 4000,
      responseFormat: 'json',
    });
  });

  it('should handle AI response with markdown code blocks', async () => {
    const mockResponse: OperationBatch = {
      version: 'v1',
      ops: [{ op: 'annotate', name: 'test', text: 'annotation' }],
    };

    mockProvider.complete.mockResolvedValue({
      content: `Here's the operation batch:
\`\`\`json
${JSON.stringify(mockResponse, null, 2)}
\`\`\``,
    });

    const result = await planner.plan({ prompt: 'Add annotation' });
    expect(result).toEqual(mockResponse);
  });

  it('should handle AI errors gracefully', async () => {
    mockProvider.complete.mockRejectedValue(new Error('API rate limit'));

    await expect(planner.plan({ prompt: 'test' })).rejects.toThrow('API rate limit');
  });

  it('should use node schemas when introspect API is provided', async () => {
    const mockIntrospectAPI = {
      getNodeType: vi.fn().mockResolvedValue({
        name: 'n8n-nodes-base.httpRequest',
        description: 'Make HTTP requests',
      }),
    };

    mockProvider.complete.mockResolvedValue({
      content: JSON.stringify({ version: 'v1', ops: [] }),
    });

    await planner.plan({
      prompt: 'test',
      introspectAPI: mockIntrospectAPI,
    });

    expect(mockIntrospectAPI.getNodeType).toHaveBeenCalled();
    expect(mockProvider.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('n8n-nodes-base.httpRequest'),
          }),
        ]),
      })
    );
  });

  it('should validate response against schema', async () => {
    mockProvider.complete.mockResolvedValue({
      content: JSON.stringify({
        // Missing required 'version' field
        ops: [{ op: 'invalid' }],
      }),
    });

    await expect(planner.plan({ prompt: 'test' })).rejects.toThrow();
  });

  it('should use fallback for simple patterns when AI fails', async () => {
    // Create planner with fallback config
    const configWithFallback = {
      ...mockConfig,
      providers: {
        ...mockConfig.providers,
        fallback: {
          provider: 'openai' as const,
          apiKey: 'fallback-key',
          model: 'gpt-3.5-turbo',
        },
      },
    };
    
    const plannerWithFallback = new AIPlanner(configWithFallback);
    
    // Mock provider to fail
    mockProvider.complete.mockRejectedValue(new Error('Primary failed'));

    const result = await plannerWithFallback.plan({
      prompt: 'Create HTTP request to example.com',
    });

    // Should return a basic HTTP workflow
    expect(result.ops).toHaveLength(2);
    expect(result.ops[0]).toMatchObject({
      op: 'add_node',
      node: expect.objectContaining({
        type: 'n8n-nodes-base.httpRequest',
      }),
    });
  });
});