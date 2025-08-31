import { OPENROUTER_MODELS } from './providers/openrouter.js';

export interface ModelCapabilities {
  codeGeneration: number;  // 0-10
  reasoning: number;       // 0-10
  speed: number;          // 0-10
  costEfficiency: number; // 0-10
  contextLength: number;  // max tokens
  jsonMode: boolean;      // supports structured output
}

export const MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  // OpenAI
  'openai/gpt-4-turbo-preview': {
    codeGeneration: 10,
    reasoning: 10,
    speed: 7,
    costEfficiency: 3,
    contextLength: 128000,
    jsonMode: true,
  },
  'openai/gpt-4': {
    codeGeneration: 9,
    reasoning: 9,
    speed: 6,
    costEfficiency: 2,
    contextLength: 8192,
    jsonMode: true,
  },
  'openai/gpt-3.5-turbo': {
    codeGeneration: 7,
    reasoning: 7,
    speed: 9,
    costEfficiency: 8,
    contextLength: 16384,
    jsonMode: true,
  },
  
  // Anthropic
  'anthropic/claude-3-opus': {
    codeGeneration: 10,
    reasoning: 10,
    speed: 6,
    costEfficiency: 2,
    contextLength: 200000,
    jsonMode: false,
  },
  'anthropic/claude-3-sonnet': {
    codeGeneration: 9,
    reasoning: 9,
    speed: 8,
    costEfficiency: 5,
    contextLength: 200000,
    jsonMode: false,
  },
  'anthropic/claude-3-haiku': {
    codeGeneration: 7,
    reasoning: 7,
    speed: 10,
    costEfficiency: 9,
    contextLength: 200000,
    jsonMode: false,
  },
  
  // Google
  'google/gemini-pro': {
    codeGeneration: 8,
    reasoning: 8,
    speed: 8,
    costEfficiency: 7,
    contextLength: 32768,
    jsonMode: true,
  },
  
  // Meta
  'meta-llama/llama-3-70b-instruct': {
    codeGeneration: 8,
    reasoning: 8,
    speed: 7,
    costEfficiency: 10,
    contextLength: 8192,
    jsonMode: false,
  },
  'meta-llama/codellama-70b-instruct': {
    codeGeneration: 9,
    reasoning: 7,
    speed: 6,
    costEfficiency: 10,
    contextLength: 16384,
    jsonMode: false,
  },
  
  // Mistral
  'mistralai/mixtral-8x7b-instruct': {
    codeGeneration: 8,
    reasoning: 8,
    speed: 8,
    costEfficiency: 9,
    contextLength: 32768,
    jsonMode: false,
  },
  
  // Specialized
  'phind/phind-codellama-34b-v2': {
    codeGeneration: 10,
    reasoning: 7,
    speed: 7,
    costEfficiency: 8,
    contextLength: 16384,
    jsonMode: false,
  },
  'deepseek/deepseek-coder-33b-instruct': {
    codeGeneration: 9,
    reasoning: 6,
    speed: 7,
    costEfficiency: 9,
    contextLength: 16384,
    jsonMode: false,
  },
};

export interface TaskRequirements {
  needsCode?: boolean;
  needsReasoning?: boolean;
  needsSpeed?: boolean;
  needsBudget?: boolean;
  needsLongContext?: boolean;
  needsJson?: boolean;
}

export class ModelSelector {
  /**
   * Select the best model based on task requirements
   */
  static selectModel(requirements: TaskRequirements): string {
    let scores: Array<{ model: string; score: number }> = [];
    
    for (const [model, caps] of Object.entries(MODEL_CAPABILITIES)) {
      let score = 0;
      let factors = 0;
      
      if (requirements.needsCode) {
        score += caps.codeGeneration;
        factors++;
      }
      
      if (requirements.needsReasoning) {
        score += caps.reasoning;
        factors++;
      }
      
      if (requirements.needsSpeed) {
        score += caps.speed;
        factors++;
      }
      
      if (requirements.needsBudget) {
        score += caps.costEfficiency;
        factors++;
      }
      
      if (requirements.needsLongContext) {
        score += caps.contextLength > 32000 ? 10 : 5;
        factors++;
      }
      
      if (requirements.needsJson && !caps.jsonMode) {
        score -= 2; // Penalty for no JSON mode
      }
      
      if (factors > 0) {
        scores.push({ model, score: score / factors });
      }
    }
    
    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);
    
    return scores[0]?.model || 'openai/gpt-3.5-turbo';
  }
  
  /**
   * Analyze prompt to determine requirements
   */
  static analyzePrompt(prompt: string): TaskRequirements {
    const promptLower = prompt.toLowerCase();
    
    return {
      needsCode: /\b(code|script|function|api|integration|webhook)\b/.test(promptLower),
      needsReasoning: /\b(analyze|decide|compare|optimize|complex)\b/.test(promptLower),
      needsSpeed: /\b(quick|fast|simple|basic)\b/.test(promptLower),
      needsBudget: /\b(cheap|budget|cost|free)\b/.test(promptLower),
      needsLongContext: prompt.length > 500 || /\b(long|detailed|comprehensive)\b/.test(promptLower),
      needsJson: true, // Always need JSON for n8n operations
    };
  }
  
  /**
   * Get model recommendation with explanation
   */
  static recommend(prompt: string): { model: string; reason: string } {
    const requirements = this.analyzePrompt(prompt);
    const model = this.selectModel(requirements);
    const caps = MODEL_CAPABILITIES[model];
    
    let reasons = [];
    if (requirements.needsCode && caps.codeGeneration >= 8) {
      reasons.push('excellent code generation');
    }
    if (requirements.needsReasoning && caps.reasoning >= 8) {
      reasons.push('strong reasoning');
    }
    if (requirements.needsSpeed && caps.speed >= 8) {
      reasons.push('fast response');
    }
    if (requirements.needsBudget && caps.costEfficiency >= 8) {
      reasons.push('cost effective');
    }
    
    return {
      model,
      reason: `Selected ${model} for ${reasons.join(', ')}`,
    };
  }
}