#!/bin/bash

# Script to index n8n documentation into the RAG system

echo "📚 Starting n8n documentation indexing..."

# Check if Qdrant is running
if ! curl -s http://localhost:6333/readyz > /dev/null; then
  echo "❌ Qdrant is not running. Start it with: docker compose up -d qdrant"
  exit 1
fi

# Check AI configuration
if [ -z "$AI_API_KEY" ]; then
  echo "⚠️  AI_API_KEY not set. Loading from .env..."
  if [ -f .env ]; then
    export $(cat .env | grep -E '^AI_' | xargs)
  else
    echo "❌ No .env file found. Please configure AI provider."
    exit 1
  fi
fi

# Enable AI features if not already
echo "🔧 Enabling AI features..."
if [ -f scripts/enable-ai.sh ]; then
  bash scripts/enable-ai.sh > /dev/null 2>&1
fi

# Build the project
echo "🔨 Building project..."
pnpm -C packages/n8n-ai-orchestrator build

# Run the indexer
echo "🚀 Running document indexer..."
cd packages/n8n-ai-orchestrator
npx tsx src/ai/rag/indexer.ts

echo "✅ Documentation indexing complete!"