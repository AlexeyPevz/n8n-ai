# OpenRouter Integration Guide

## Overview

OpenRouter provides unified access to 50+ AI models through a single API, making it perfect for n8n-ai. You can test different models, optimize costs, and access the latest AI capabilities without managing multiple API keys.

## Quick Start

1. **Get API Key**: Sign up at https://openrouter.ai and create an API key

2. **Configure n8n-ai**:
```bash
AI_PROVIDER=openrouter
AI_API_KEY=sk-or-v1-your-key-here
AI_MODEL=anthropic/claude-3-opus
```

## Available Models

### Top Recommendations by Use Case

#### 🚀 Best Overall Performance
```bash
AI_MODEL=anthropic/claude-3-opus      # Best reasoning & code
AI_MODEL=openai/gpt-4-turbo          # Excellent for complex workflows
AI_MODEL=google/gemini-pro            # Good balance of speed & quality
```

#### 💰 Cost-Effective Options
```bash
AI_MODEL=anthropic/claude-3-haiku     # Fast & cheap
AI_MODEL=mistralai/mixtral-8x7b       # Open source, good quality
AI_MODEL=meta-llama/llama-3-70b       # Free credits available
```

#### 🎯 Specialized Models
```bash
# Code Generation
AI_MODEL=phind/phind-codellama-34b-v2
AI_MODEL=deepseek/deepseek-coder-33b-instruct
AI_MODEL=wizardlm/wizardcoder-33b-v1.1

# With Internet Access
AI_MODEL=perplexity/pplx-70b-online

# Long Context (200k+ tokens)
AI_MODEL=anthropic/claude-3-opus
AI_MODEL=anthropic/claude-3-sonnet
```

## Model Selection API

n8n-ai includes an intelligent model selector that recommends the best model for your task:

```bash
curl -X POST http://localhost:3000/ai/recommend-model \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a complex data pipeline with error handling"
  }'
```

Response:
```json
{
  "recommendation": {
    "model": "anthropic/claude-3-opus",
    "reason": "Selected for excellent code generation, strong reasoning"
  },
  "requirements": {
    "needsCode": true,
    "needsReasoning": true,
    "needsSpeed": false,
    "needsBudget": false,
    "needsLongContext": false,
    "needsJson": true
  }
}
```

## Usage Examples

### Basic Workflow Generation
```bash
# Using Claude 3 Opus (best quality)
AI_PROVIDER=openrouter
AI_MODEL=anthropic/claude-3-opus
curl -X POST http://localhost:3000/plan \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a workflow that monitors GitHub issues and creates Jira tickets"
  }'
```

### Cost-Optimized Setup
```bash
# Primary: Fast & cheap for simple tasks
AI_PROVIDER=openrouter
AI_MODEL=anthropic/claude-3-haiku

# Fallback: High quality for complex tasks
AI_FALLBACK_PROVIDER=openrouter
AI_FALLBACK_MODEL=anthropic/claude-3-opus
```

### Testing Different Models
```bash
# Test with different models
for model in "anthropic/claude-3-opus" "google/gemini-pro" "mistralai/mixtral-8x7b"; do
  echo "Testing with $model"
  AI_MODEL=$model curl -X POST http://localhost:3000/plan \
    -H "Content-Type: application/json" \
    -d '{"prompt": "Create HTTP workflow"}'
done
```

## Cost Comparison

| Model | Cost per 1M tokens | Quality | Speed |
|-------|-------------------|---------|-------|
| Claude 3 Opus | $15/$75 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| GPT-4 Turbo | $10/$30 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Claude 3 Haiku | $0.25/$1.25 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Mixtral 8x7B | $0.50/$0.50 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Llama 3 70B | Free tier available | ⭐⭐⭐⭐ | ⭐⭐⭐ |

## Advanced Configuration

### Site Attribution
OpenRouter allows you to set site information for better analytics:

```bash
OPENROUTER_SITE_URL=https://your-n8n-instance.com
OPENROUTER_SITE_NAME=My n8n AI
```

### Rate Limits
OpenRouter has generous rate limits, but you can configure fallbacks:

```bash
# Primary model with fallback
AI_PROVIDER=openrouter
AI_MODEL=anthropic/claude-3-opus
AI_FALLBACK_PROVIDER=openrouter
AI_FALLBACK_MODEL=google/gemini-pro
```

### Model-Specific Parameters
Some models have specific requirements:

```javascript
// For models that don't support JSON mode natively
const response = await planner.plan({
  prompt: "Create workflow",
  // The planner will handle JSON extraction automatically
});
```

## Troubleshooting

### Common Issues

1. **"Model not found"**
   - Check model name matches exactly (case-sensitive)
   - Use full model path: `provider/model-name`

2. **"Insufficient credits"**
   - Add credits at https://openrouter.ai/credits
   - Some models offer free tiers

3. **"JSON parsing failed"**
   - Some models don't support JSON mode
   - The system will attempt to extract JSON from text response

### Debug Mode
Enable detailed logging:
```bash
LOG_LEVEL=debug
AI_DEBUG=true
```

## Best Practices

1. **Start with Claude 3 Haiku** for testing (fast & cheap)
2. **Use Claude 3 Opus or GPT-4** for production (best quality)
3. **Set up fallbacks** for reliability
4. **Monitor token usage** via the metrics endpoint
5. **Use the model recommendation API** for optimal selection

## Links

- OpenRouter Dashboard: https://openrouter.ai/dashboard
- API Keys: https://openrouter.ai/keys
- Model List: https://openrouter.ai/models
- Pricing: https://openrouter.ai/pricing
- Credits: https://openrouter.ai/credits