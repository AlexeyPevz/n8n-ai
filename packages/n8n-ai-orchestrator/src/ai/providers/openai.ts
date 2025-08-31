import { AIProvider, type AICompletionRequest, type AICompletionResponse, type AIEmbeddingRequest, type AIEmbeddingResponse } from './base.js';

interface OpenAIConfig {
  apiKey: string;
  baseUrl?: string;
  model: string;
  embeddingModel?: string;
}

export class OpenAIProvider extends AIProvider {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private embeddingModel: string;

  constructor(config: OpenAIConfig) {
    super(config);
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.model = config.model;
    this.embeddingModel = config.embeddingModel || 'text-embedding-3-small';
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.3,
        max_tokens: request.maxTokens ?? 4000,
        response_format: request.responseFormat === 'json' ? { type: 'json_object' } : undefined,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    
    return {
      content: data.choices[0].message.content,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
      model: data.model,
    };
  }

  async embed(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.embeddingModel,
        input: request.texts,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    
    return {
      embeddings: data.data.map((item: any) => item.embedding),
      usage: data.usage ? {
        totalTokens: data.usage.total_tokens,
      } : undefined,
    };
  }
}