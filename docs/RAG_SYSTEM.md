# RAG (Retrieval-Augmented Generation) System

## Overview

The RAG system enhances AI-generated workflows by providing relevant n8n documentation context. It uses vector embeddings to find the most relevant information for each user request.

## Architecture

```
User Prompt
    ↓
RAG Search → Relevant Docs
    ↓
Enhanced Prompt
    ↓
LLM Generation
    ↓
Better Workflow
```

## Components

### 1. Vector Store (Qdrant)
- Stores document embeddings
- Enables semantic search
- Filters by node type, source, etc.

### 2. Document Processor
- Converts n8n nodes to searchable documents
- Chunks large documents
- Extracts metadata

### 3. RAG System
- Manages document indexing
- Performs similarity search
- Enhances prompts with context

## Setup

### Prerequisites
- Qdrant running (via docker-compose)
- AI provider configured (for embeddings)

### Configuration
```bash
# Enable RAG
AI_RAG_ENABLED=true
AI_RAG_COLLECTION=n8n-docs
AI_RAG_TOP_K=5

# Qdrant connection
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your-key-if-needed
```

### Initial Indexing
```bash
# Index n8n documentation
pnpm -C packages/n8n-ai-orchestrator tsx src/ai/rag/indexer.ts
```

## Usage

### Automatic Context Enhancement
When RAG is enabled, the AI planner automatically:
1. Searches for relevant documentation
2. Adds context to the prompt
3. Generates better workflows

### Manual Search
```bash
# Search for documentation
curl -X POST http://localhost:3000/rag/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "http request authentication",
    "topK": 5
  }'
```

### Index Management
```bash
# Get statistics
curl http://localhost:3000/rag/stats

# Re-index nodes
curl -X POST http://localhost:3000/rag/index/nodes

# Index custom documentation
curl -X POST http://localhost:3000/rag/index/guide \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Custom Guide",
    "content": "Guide content...",
    "category": "custom"
  }'
```

## Document Types

### 1. Node Documentation
- Automatically extracted from node descriptions
- Includes all properties and options
- Searchable by node type

### 2. Workflow Examples
- Common patterns and use cases
- Best practices
- Tagged for easy filtering

### 3. Guides
- How-to documentation
- Best practices
- Troubleshooting tips

### 4. API Documentation
- Node-specific API details
- Expression syntax
- Advanced features

## Performance Optimization

### Caching
- Embeddings are cached
- Search results cached for identical queries
- TTL configurable

### Batch Processing
- Documents indexed in batches
- Parallel embedding generation
- Progress tracking

### Memory Management
- Document chunking for large content
- Streaming for large result sets
- Automatic cleanup of old documents

## Extending the System

### Adding New Document Sources
1. Create document processor method
2. Define metadata schema
3. Implement indexing logic
4. Add to indexer

### Custom Vector Stores
1. Implement VectorStore interface
2. Add to RAG system factory
3. Configure in environment

### Custom Embeddings
1. Use different embedding models
2. Adjust vector dimensions
3. Fine-tune for n8n domain

## Troubleshooting

### No Results Found
- Check if documents are indexed
- Verify Qdrant is running
- Try broader search terms

### Poor Relevance
- Adjust minScore threshold
- Index more examples
- Improve document quality

### Performance Issues
- Reduce topK value
- Enable caching
- Optimize Qdrant configuration

## Future Enhancements

1. **Auto-indexing**: Automatically index new nodes
2. **User feedback**: Learn from corrections
3. **Multi-language**: Support non-English docs
4. **Version awareness**: Track n8n versions
5. **Dynamic updates**: Real-time doc updates