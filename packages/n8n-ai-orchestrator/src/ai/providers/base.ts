import type { OperationBatch } from '@n8n-ai/schemas';

export interface AICompletionRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json' | 'text';
}

export interface AICompletionResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
}

export interface AIEmbeddingRequest {
  texts: string[];
  model?: string;
}

export interface AIEmbeddingResponse {
  embeddings: number[][];
  usage?: {
    totalTokens: number;
  };
}

export abstract class AIProvider {
  constructor(protected config: any) {}

  abstract complete(request: AICompletionRequest): Promise<AICompletionResponse>;
  
  abstract embed(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse>;

  /**
   * Parse LLM response and extract OperationBatch
   */
  protected parseOperationBatch(content: string): OperationBatch | null {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      
      // Clean up common LLM artifacts
      const cleaned = jsonStr
        .replace(/^[^{]*/, '') // Remove text before JSON
        .replace(/[^}]*$/, '') // Remove text after JSON
        .trim();
      
      const parsed = JSON.parse(cleaned);
      
      // Ensure it has the expected structure
      if (!parsed.ops || !Array.isArray(parsed.ops)) {
        return null;
      }
      
      return parsed as OperationBatch;
    } catch (error) {
      console.error('Failed to parse OperationBatch:', error);
      return null;
    }
  }

  /**
   * Format error for better LLM understanding
   */
  protected formatError(error: any): string {
    if (typeof error === 'string') return error;
    
    if (error.code && error.message) {
      return `Error ${error.code}: ${error.message}`;
    }
    
    if (error.message) return error.message;
    
    return JSON.stringify(error);
  }
}