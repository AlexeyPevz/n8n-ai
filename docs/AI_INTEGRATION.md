# AI Integration Guide

## Overview

n8n-ai supports multiple AI providers for intelligent workflow generation. The system uses AI to understand natural language prompts and generate appropriate n8n workflow operations.

## Configuration

### Environment Variables

```bash
# Primary AI Provider
AI_PROVIDER=openai              # Options: openai, anthropic, ollama
AI_API_KEY=your-api-key         # API key for the provider
AI_MODEL=gpt-4-turbo-preview    # Model to use
AI_TEMPERATURE=0.3              # Lower = more deterministic
AI_MAX_TOKENS=4000              # Max response length

# Fallback Provider (optional)
AI_FALLBACK_PROVIDER=anthropic
AI_FALLBACK_API_KEY=your-key
AI_FALLBACK_MODEL=claude-3-sonnet-20240229
```

### Supported Providers

#### OpenAI
- Models: gpt-4-turbo-preview, gpt-4, gpt-3.5-turbo
- Best for: Complex reasoning, code generation
- Cost: Higher

#### Anthropic (Coming Soon)
- Models: claude-3-opus, claude-3-sonnet, claude-3-haiku
- Best for: Long context, safety
- Cost: Medium to high

#### Ollama (Coming Soon)
- Models: llama2, mistral, codellama
- Best for: Local deployment, privacy
- Cost: Free (self-hosted)

## Architecture

```
User Prompt
    ↓
AI Planner
    ↓
LLM Provider → Generate Operations
    ↓
Schema Validation
    ↓
Operation Batch
```

## Usage

### Basic Workflow Generation

```bash
curl -X POST http://localhost:3000/plan \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a workflow that fetches weather data every morning and sends it to Slack"
  }'
```

### With Context

```bash
curl -X POST http://localhost:3000/plan \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Add error handling to this workflow",
    "currentWorkflow": { ... },
    "availableNodes": ["n8n-nodes-base.errorTrigger", ...]
  }'
```

## Prompt Engineering Tips

### Be Specific
❌ "Create API workflow"
✅ "Create a workflow that calls the GitHub API to fetch repository stars and saves them to Google Sheets"

### Include Details
❌ "Send email"
✅ "Send an email using Gmail when a new order is created in WooCommerce, include order details and customer info"

### Specify Triggers
❌ "Process data"
✅ "Every day at 9 AM, fetch data from PostgreSQL, transform it, and upload to S3"

## Troubleshooting

### AI Not Responding
1. Check API key is set correctly
2. Verify network connectivity
3. Check rate limits
4. Review logs for errors

### Poor Results
1. Make prompts more specific
2. Provide examples in prompt
3. Use current workflow context
4. Try different temperature settings

### Validation Errors
1. AI output may need refinement
2. Use the Critic feature for auto-fix
3. Check node parameter requirements

## Cost Management

### Token Usage Monitoring
- Token usage is logged for each request
- Monitor via `/metrics` endpoint
- Set up alerts for high usage

### Optimization Tips
1. Use caching for repeated queries
2. Implement RAG to reduce context size
3. Use smaller models for simple tasks
4. Batch similar requests

## Security

### API Key Management
- Never commit API keys
- Use environment variables
- Rotate keys regularly
- Monitor usage for anomalies

### Data Privacy
- User prompts are sent to AI provider
- No workflow data is stored by providers
- Consider self-hosted options for sensitive data

## Future Enhancements

1. **RAG System**: Context-aware suggestions using n8n documentation
2. **Fine-tuning**: Custom models trained on n8n workflows
3. **Streaming**: Real-time generation for complex workflows
4. **Multi-modal**: Support for image/diagram input