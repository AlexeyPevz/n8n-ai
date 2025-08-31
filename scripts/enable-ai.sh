#!/bin/bash

# Script to enable AI features in n8n-ai

echo "🤖 Enabling AI features in n8n-ai..."

# Update tsconfig to include AI files
echo "📝 Updating TypeScript configuration..."
sed -i 's/"src\/ai\/\*\*\/\*"//g' packages/n8n-ai-orchestrator/tsconfig.json

# Enable imports in planner.ts
echo "🔧 Enabling AI imports in planner..."
sed -i 's|// import { AIPlanner }|import { AIPlanner }|g' packages/n8n-ai-orchestrator/src/planner.ts
sed -i 's|// import { getAIConfig }|import { getAIConfig }|g' packages/n8n-ai-orchestrator/src/planner.ts
sed -i 's|// private aiPlanner|private aiPlanner|g' packages/n8n-ai-orchestrator/src/planner.ts
sed -i 's|// const config = getAIConfig|const config = getAIConfig|g' packages/n8n-ai-orchestrator/src/planner.ts
sed -i 's|// if (config.providers|if (config.providers|g' packages/n8n-ai-orchestrator/src/planner.ts
sed -i 's|//   this.aiPlanner|  this.aiPlanner|g' packages/n8n-ai-orchestrator/src/planner.ts
sed -i 's|// if (this.aiPlanner)|if (this.aiPlanner)|g' packages/n8n-ai-orchestrator/src/planner.ts
sed -i 's|//   try {|  try {|g' packages/n8n-ai-orchestrator/src/planner.ts
sed -i 's|//     return await|    return await|g' packages/n8n-ai-orchestrator/src/planner.ts
sed -i 's|//   } catch|  } catch|g' packages/n8n-ai-orchestrator/src/planner.ts
sed -i 's|//     console.warn|    console.warn|g' packages/n8n-ai-orchestrator/src/planner.ts
sed -i 's|//   }|  }|g' packages/n8n-ai-orchestrator/src/planner.ts
sed -i 's|// }|  }|g' packages/n8n-ai-orchestrator/src/planner.ts

# Enable imports in server.ts
echo "🔧 Enabling AI imports in server..."
sed -i 's|// import { ModelSelector }|import { ModelSelector }|g' packages/n8n-ai-orchestrator/src/server.ts
sed -i 's|// server.post<{ Body:|server.post<{ Body:|g' packages/n8n-ai-orchestrator/src/server.ts
sed -i 's|//   const { prompt }|  const { prompt }|g' packages/n8n-ai-orchestrator/src/server.ts
sed -i 's|//   if (!prompt)|  if (!prompt)|g' packages/n8n-ai-orchestrator/src/server.ts
sed -i 's|//     return { error:|    return { error:|g' packages/n8n-ai-orchestrator/src/server.ts
sed -i 's|//   const recommendation|  const recommendation|g' packages/n8n-ai-orchestrator/src/server.ts
sed -i 's|//   const requirements|  const requirements|g' packages/n8n-ai-orchestrator/src/server.ts
sed -i 's|//   return {|  return {|g' packages/n8n-ai-orchestrator/src/server.ts
sed -i 's|//     recommendation,|    recommendation,|g' packages/n8n-ai-orchestrator/src/server.ts
sed -i 's|//     requirements,|    requirements,|g' packages/n8n-ai-orchestrator/src/server.ts
sed -i 's|//     availableModels:|    availableModels:|g' packages/n8n-ai-orchestrator/src/server.ts
sed -i 's|//   };|  };|g' packages/n8n-ai-orchestrator/src/server.ts
sed -i 's|// });|});|g' packages/n8n-ai-orchestrator/src/server.ts

echo "✅ AI features enabled!"
echo ""
echo "⚠️  Don't forget to:"
echo "1. Set your AI provider API key in .env"
echo "2. Run 'pnpm install' to install dependencies"
echo "3. Rebuild the project with 'pnpm build'"
echo ""
echo "Example .env configuration:"
echo "AI_PROVIDER=openrouter"
echo "AI_API_KEY=your-api-key"
echo "AI_MODEL=anthropic/claude-3-opus"