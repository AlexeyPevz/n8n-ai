# Frequently Asked Questions

## General

### What is n8n-ai?

n8n-ai is an AI-first extension for n8n that allows users to create workflows using natural language. Instead of manually dragging and connecting nodes, you can describe what you want to achieve, and the AI will generate the workflow for you.

### Is this a fork of n8n?

No, n8n-ai is designed as an extension that works alongside n8n. It uses a minimal hook system to integrate with n8n without modifying the core codebase significantly.

### What AI providers are supported?

Currently supported:
- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude 3)
- OpenRouter (access to multiple models)

### Do I need an AI API key?

Yes, to use the AI features you'll need an API key from one of the supported providers. The system can work without AI for manual workflow creation.

## Installation

### What are the system requirements?

- Node.js >= 20.0.0
- pnpm >= 8.15.0
- 2GB RAM minimum
- 1GB disk space

### Can I run this on Windows?

Yes, but we recommend using WSL2 for the best experience. Native Windows support is tested but may have path-related issues.

### Do I need Docker?

Docker is optional but recommended for production deployments. You can run everything natively with Node.js.

## Usage

### How do I create my first workflow?

1. Start the orchestrator: `pnpm start`
2. Send a POST request to `/plan` with your prompt
3. Apply the returned operations to create the workflow

Example:
```bash
curl -X POST http://localhost:3000/plan \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Create a webhook that saves data to Google Sheets"}'
```

### Can I edit AI-generated workflows?

Yes! The AI generates standard n8n workflows that can be edited manually. You can also ask the AI to modify existing workflows.

### How accurate is the AI?

The AI uses Schema-Guided Reasoning (SGR) to ensure all generated workflows are structurally valid. However, you should always review and test generated workflows before using them in production.

### What happens if the AI makes a mistake?

- All operations are validated before applying
- Full undo/redo support
- Preview changes before applying
- Manual editing always available

## Troubleshooting

### The server won't start

1. Check if port 3000 is already in use
2. Ensure all dependencies are installed: `pnpm install`
3. Build the project: `pnpm build`
4. Check logs for specific errors

### "Module not found" errors

```bash
# Clean reinstall
rm -rf node_modules packages/*/node_modules
pnpm install
pnpm build
```

### TypeScript errors

Make sure you're using the correct Node.js version (20+) and have built all packages:
```bash
pnpm build
```

### AI responses are slow

- Check your API key is valid
- Consider using a faster model (e.g., Claude 3 Haiku)
- Enable Redis caching for better performance

## Security

### Is my data safe?

- All data stays in your infrastructure
- AI providers only receive anonymized prompts
- Credentials are never sent to AI
- Full audit logging available

### Can I use this in production?

Yes, with proper configuration:
- Enable authentication (`ENABLE_AUTH=true`)
- Use strong API tokens
- Enable rate limiting
- Set up monitoring

### Are workflows encrypted?

Workflows are stored in plain JSON by default. For encryption:
- Use encrypted file systems
- Enable Redis encryption
- Implement database encryption

## Development

### How do I contribute?

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

### How do I add a new AI provider?

1. Implement the `AIProvider` interface
2. Add configuration in `planner.ts`
3. Update environment variables
4. Add tests

### Can I extend the pattern library?

Yes! Add new patterns to `extended-patterns.ts` following the existing format. Patterns help the AI recognize common workflow types.

## Performance

### How many workflows can it handle?

The in-memory graph manager can handle thousands of workflows. For larger deployments:
- Enable Redis for caching
- Use PostgreSQL for persistence
- Implement pagination

### What about rate limits?

Default rate limits:
- `/plan`: 10 requests/minute
- `/graph/*/batch`: 30 requests/minute
- Other endpoints: 60 requests/minute

Adjust via environment variables.

### Can it scale horizontally?

Yes, the orchestrator is stateless and can be scaled with a load balancer. Use Redis for shared state.

## Integration

### Does it work with n8n.cloud?

Currently designed for self-hosted n8n. Cloud support is on the roadmap.

### Can I use existing n8n workflows?

Yes! The system can read and modify existing workflows. Use the introspection API to discover available nodes.

### What about custom nodes?

Custom nodes are supported if they follow n8n's node structure. The AI might need examples to use them effectively.

## Future

### What's on the roadmap?

- n8n.cloud integration
- More AI providers
- Visual workflow designer integration
- Advanced refactoring tools
- Workflow testing automation

### Will this be open source forever?

Yes, the core functionality will remain open source. Enterprise features may be available as paid add-ons.

### How can I get support?

- GitHub Issues for bugs
- Discussions for questions
- Discord community (coming soon)
- Commercial support available