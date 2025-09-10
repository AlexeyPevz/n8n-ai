import type { AIProvider } from './base.js';
import { OpenAIProvider } from './openai.js';
import { OpenRouterProvider } from './openrouter.js';
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
      
      case 'openrouter':
        if (!config.apiKey) {
          throw new Error('OpenRouter API key is required');
        }
        return new OpenRouterProvider({
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          model: config.model,
          siteUrl: config.siteUrl,
          siteName: config.siteName,
        });
      
      case 'anthropic':
        throw new Error('Anthropic provider not yet implemented. Please use OpenAI or OpenRouter.');
      
      case 'ollama':
        throw new Error('Ollama provider not yet implemented. Please use OpenAI or OpenRouter.');
      
      default:
        throw new Error(`Unknown AI provider: ${config.provider}`);
    }
  }
}