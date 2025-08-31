import type { AIProvider } from './base.js';
import { OpenAIProvider } from './openai.js';
import type { AIProviderConfig } from '../config.js';

export class AIProviderFactory {
  static create(config: AIProviderConfig): AIProvider {
    switch (config.provider) {
      case 'openai':
        if (!config.apiKey) {
          throw new Error('OpenAI API key is required');
        }
        return new OpenAIProvider({
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          model: config.model,
        });
      
      case 'anthropic':
        // TODO: Implement Anthropic provider
        throw new Error('Anthropic provider not yet implemented');
      
      case 'ollama':
        // TODO: Implement Ollama provider
        throw new Error('Ollama provider not yet implemented');
      
      default:
        throw new Error(`Unknown AI provider: ${config.provider}`);
    }
  }
}