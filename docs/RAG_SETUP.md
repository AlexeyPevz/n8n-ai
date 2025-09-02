# 🧠 RAG System Setup Guide

## Overview

The RAG (Retrieval Augmented Generation) system enhances AI workflow generation by providing contextual knowledge about n8n nodes, best practices, and workflow patterns.

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│   User Query    │────▶│  RAG Search  │────▶│   Qdrant    │
└─────────────────┘     └──────────────┘     └─────────────┘
                               │                      │
                               ▼                      ▼
                        ┌──────────────┐     ┌─────────────┐
                        │  AI Planner  │◀────│  Knowledge  │
                        └──────────────┘     │    Base     │
                               │             └─────────────┘
                               ▼
                        ┌──────────────┐
                        │   Workflow   │
                        └──────────────┘
```

## Quick Start

### 1. Start Qdrant

```bash
make rag-start
# or
docker run -d --name qdrant -p 6333:6333 qdrant/qdrant
```

### 2. Populate Knowledge Base

```bash
make rag-populate
# or
cd packages/n8n-ai-orchestrator
npx tsx scripts/populate-rag.ts
```

### 3. Enable RAG in Server

```bash
export QDRANT_URL=http://localhost:6333
export RAG_ENABLED=true
pnpm dev
```

## Knowledge Sources

The RAG system indexes knowledge from multiple sources:

### 1. Built-in n8n Nodes
- Node descriptions and parameters
- Input/output schemas
- Common configurations

### 2. Workflow Patterns
- HTTP API integrations
- Scheduled data syncs
- Webhook processing
- Error handling patterns

### 3. External Templates
- [n8n-workflows](https://github.com/n8n-io/n8n-workflows) - Official templates
- [n8n-templates-library](https://github.com/n8n-io/n8n-templates-library) - Community templates

### 4. Best Practices
- Error handling strategies
- Performance optimization
- Security guidelines
- Naming conventions

## Automated Updates

### GitHub Actions

The `.github/workflows/update-rag.yml` workflow automatically:
- Runs daily at 2 AM UTC
- Fetches latest templates from GitHub
- Updates the knowledge base
- Creates backups

### Manual Update

```bash
# Update from GitHub templates
GITHUB_TOKEN=your-token make rag-populate

# Update specific repository
cd packages/n8n-ai-orchestrator
TEMPLATE_REPO=owner/repo npx tsx scripts/populate-rag.ts
```

## Configuration

### Environment Variables

```bash
# Qdrant configuration
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your-key # Optional, for cloud Qdrant

# RAG features
RAG_ENABLED=true # Enable RAG system
RAG_COLLECTION=n8n-knowledge # Collection name
RAG_SEARCH_LIMIT=5 # Max search results

# GitHub integration
GITHUB_TOKEN=your-token # For higher API limits
```

### AI Provider for Embeddings

The RAG system needs an AI provider for generating embeddings:

```bash
# Option 1: OpenAI (recommended)
OPENAI_API_KEY=your-key
AI_PROVIDER=openai

# Option 2: OpenRouter
OPENROUTER_API_KEY=your-key
AI_PROVIDER=openrouter

# Option 3: Mock (testing only)
AI_PROVIDER=mock
```

## Usage in AI Planner

When RAG is enabled, the AI planner automatically:

1. **Searches relevant context** for user queries
2. **Includes node documentation** in prompts
3. **Suggests similar workflows** from templates
4. **Applies best practices** from knowledge base

Example enhanced prompt:
```
User: "Create workflow to sync PostgreSQL to Google Sheets daily"

RAG Context:
- PostgreSQL node documentation
- Google Sheets node parameters
- Similar template: "Database to Spreadsheet Sync"
- Best practice: Use Split in Batches for large datasets
```

## Monitoring

### Check RAG Status

```bash
# Via API
curl http://localhost:3000/api/v1/ai/rag/status

# Response
{
  "enabled": true,
  "documents": 1523,
  "collections": ["n8n-knowledge"],
  "lastUpdate": "2024-01-15T10:30:00Z"
}
```

### Search Test

```bash
# Test search
curl -X POST http://localhost:3000/api/v1/ai/rag/search \
  -H "Content-Type: application/json" \
  -d '{"query": "HTTP request authentication"}'
```

## Troubleshooting

### RAG System Empty

```bash
# Check Qdrant is running
curl http://localhost:6333/collections

# Re-populate
make rag-populate
```

### Embedding Errors

```bash
# Check AI provider
echo $AI_PROVIDER
echo $OPENAI_API_KEY

# Use mock provider for testing
AI_PROVIDER=mock make rag-populate
```

### Performance Issues

```bash
# Optimize collection
curl -X POST http://localhost:6333/collections/n8n-knowledge/points/optimize

# Reduce search limit
export RAG_SEARCH_LIMIT=3
```

## Development

### Adding Custom Knowledge

```typescript
// In populate-rag.ts
const customDocs = [
  {
    title: 'Custom Integration Guide',
    content: 'Your documentation here',
    metadata: {
      type: 'guide',
      category: 'custom'
    }
  }
];

await ragSystem.addDocuments(customDocs);
```

### Testing RAG Integration

```typescript
// In your tests
import { RAGSystem } from './ai/rag/rag-system.js';

const ragSystem = new RAGSystem({
  vectorStore: { type: 'memory' }, // In-memory for tests
  embedder: mockEmbedder
});

await ragSystem.addDocuments([...testDocs]);
const results = await ragSystem.search('test query');
```

## Best Practices

1. **Regular Updates**: Schedule weekly updates for templates
2. **Quality Control**: Review auto-imported templates
3. **Custom Knowledge**: Add organization-specific patterns
4. **Performance**: Monitor query times and optimize
5. **Backup**: Regular backups of Qdrant data

## Future Enhancements

- [ ] Real-time template updates via webhooks
- [ ] Multi-language documentation support
- [ ] Workflow success rate tracking
- [ ] User feedback integration
- [ ] Advanced semantic search with reranking