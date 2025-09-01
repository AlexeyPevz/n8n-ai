import { AIProvider } from './base.js';
export class OpenRouterProvider extends AIProvider {
    apiKey;
    baseUrl;
    model;
    siteUrl;
    siteName;
    constructor(config) {
        super(config);
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1';
        this.model = config.model;
        this.siteUrl = config.siteUrl || process.env.OPENROUTER_SITE_URL;
        this.siteName = config.siteName || process.env.OPENROUTER_SITE_NAME || 'n8n-ai';
    }
    async complete(request) {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': this.siteUrl || 'http://localhost:3000',
            'X-Title': this.siteName,
        };
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: this.model,
                messages: request.messages,
                temperature: request.temperature ?? 0.3,
                max_tokens: request.maxTokens ?? 4000,
                // OpenRouter supports JSON mode for compatible models
                response_format: request.responseFormat === 'json' ? { type: 'json_object' } : undefined,
                // OpenRouter specific: transforms for better compatibility
                transforms: ['middle-out'],
            }),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenRouter API error: ${response.status} ${error}`);
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
    async embed(request) {
        // OpenRouter doesn't directly support embeddings, we need to use a specific embedding model
        // For now, we'll use OpenAI's embedding model through OpenRouter
        const embeddingModel = 'openai/text-embedding-3-small';
        const response = await fetch(`${this.baseUrl}/embeddings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                'HTTP-Referer': this.siteUrl || 'http://localhost:3000',
                'X-Title': this.siteName,
            },
            body: JSON.stringify({
                model: embeddingModel,
                input: request.texts,
            }),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenRouter API error: ${response.status} ${error}`);
        }
        const data = await response.json();
        return {
            embeddings: data.data.map((item) => item.embedding),
            usage: data.usage ? {
                totalTokens: data.usage.total_tokens,
            } : undefined,
        };
    }
}
// Popular models available on OpenRouter
export const OPENROUTER_MODELS = {
    // OpenAI Models
    'gpt-4-turbo': 'openai/gpt-4-turbo-preview',
    'gpt-4': 'openai/gpt-4',
    'gpt-3.5-turbo': 'openai/gpt-3.5-turbo',
    // Anthropic Models
    'claude-3-opus': 'anthropic/claude-3-opus',
    'claude-3-sonnet': 'anthropic/claude-3-sonnet',
    'claude-3-haiku': 'anthropic/claude-3-haiku',
    'claude-2.1': 'anthropic/claude-2.1',
    // Google Models
    'gemini-pro': 'google/gemini-pro',
    'gemini-pro-vision': 'google/gemini-pro-vision',
    'palm-2-chat': 'google/palm-2-chat-bison',
    // Meta Models
    'llama-3-70b': 'meta-llama/llama-3-70b-instruct',
    'llama-3-8b': 'meta-llama/llama-3-8b-instruct',
    'codellama-70b': 'meta-llama/codellama-70b-instruct',
    // Mistral Models
    'mistral-large': 'mistral/mistral-large',
    'mistral-medium': 'mistral/mistral-medium',
    'mixtral-8x7b': 'mistralai/mixtral-8x7b-instruct',
    // Other Open Models
    'nous-hermes-2': 'nousresearch/nous-hermes-2-mixtral-8x7b-dpo',
    'deepseek-coder': 'deepseek/deepseek-coder-33b-instruct',
    'phind-codellama': 'phind/phind-codellama-34b-v2',
    'wizardcoder': 'wizardlm/wizardcoder-33b-v1.1',
    // Specialized Models
    'perplexity-online': 'perplexity/pplx-70b-online', // With internet access
    'perplexity-chat': 'perplexity/pplx-70b-chat',
};
