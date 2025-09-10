#!/usr/bin/env tsx
/**
 * Script to populate RAG system with n8n documentation and workflow templates
 */

import { RAGSystem } from '../src/ai/rag/rag-system.js';
import { DocumentIndexer } from '../src/ai/rag/indexer.js';
import { getAIConfig } from '../src/ai/config.js';
import { AIProviderFactory } from '../src/ai/providers/factory.js';
import fetch from 'node-fetch';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Template repositories to parse
const TEMPLATE_REPOS = [
  {
    owner: 'n8n-io',
    repo: 'n8n-workflows',
    description: 'Official n8n workflow templates'
  },
  {
    owner: 'n8n-io', 
    repo: 'n8n-templates-library',
    description: 'Community workflow templates'
  }
];

async function fetchGitHubTemplates(owner: string, repo: string) {
  console.log(`📦 Fetching templates from ${owner}/${repo}...`);
  
  try {
    // Fetch workflow files from GitHub
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          // Add token if available
          ...(process.env.GITHUB_TOKEN ? {
            'Authorization': `token ${process.env.GITHUB_TOKEN}`
          } : {})
        }
      }
    );

    if (!response.ok) {
      console.warn(`⚠️  Failed to fetch from ${owner}/${repo}: ${response.statusText}`);
      return [];
    }

    const contents = await response.json() as any[];
    const workflows = [];

    // Filter JSON files
    for (const file of contents) {
      if (file.name.endsWith('.json') && file.type === 'file') {
        try {
          const fileResponse = await fetch(file.download_url);
          const workflow = await fileResponse.json();
          
          // Validate it's a workflow
          if (workflow.nodes && Array.isArray(workflow.nodes)) {
            workflows.push({
              name: file.name.replace('.json', ''),
              description: workflow.description || '',
              workflow: workflow,
              source: `${owner}/${repo}`,
              tags: workflow.tags || []
            });
          }
        } catch (e) {
          console.warn(`⚠️  Failed to parse ${file.name}`);
        }
      }
    }

    console.log(`✅ Found ${workflows.length} workflows in ${owner}/${repo}`);
    return workflows;
  } catch (error) {
    console.error(`❌ Error fetching from ${owner}/${repo}:`, error);
    return [];
  }
}

async function loadLocalDocumentation() {
  console.log('📚 Loading local n8n documentation...');
  
  const docs = [];
  
  // Try to find n8n node documentation
  const possiblePaths = [
    // If n8n is installed as dependency
    path.join(__dirname, '../../../../node_modules/n8n/dist/nodes'),
    path.join(__dirname, '../../../../node_modules/@n8n/nodes-base/dist/nodes'),
    // If running in n8n workspace
    path.join(__dirname, '../../../../packages/nodes-base/nodes'),
    // Custom documentation directory
    path.join(__dirname, '../docs/nodes')
  ];

  for (const docsPath of possiblePaths) {
    try {
      const files = await fs.readdir(docsPath);
      console.log(`📁 Found documentation at ${docsPath}`);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const content = await fs.readFile(path.join(docsPath, file), 'utf-8');
            const doc = JSON.parse(content);
            
            if (doc.displayName) {
              docs.push({
                title: `${doc.displayName} Node Documentation`,
                content: JSON.stringify(doc, null, 2),
                metadata: {
                  nodeType: doc.name,
                  category: doc.categories?.[0] || 'Other',
                  version: doc.version
                }
              });
            }
          } catch (e) {
            // Skip invalid files
          }
        }
      }
    } catch (e) {
      // Directory doesn't exist, skip
    }
  }

  console.log(`✅ Loaded ${docs.length} documentation files`);
  return docs;
}

async function createSystemPrompts() {
  return [
    {
      title: 'n8n Workflow Best Practices',
      content: `
        When creating n8n workflows, follow these best practices:
        
        1. **Error Handling**: Always add error workflows for critical paths
        2. **Rate Limiting**: Use Split in Batches node for API calls
        3. **Credentials**: Store sensitive data in credentials, not in nodes
        4. **Naming**: Use descriptive names for nodes and workflows
        5. **Testing**: Test with small data sets first
        6. **Monitoring**: Add logging nodes for debugging
        
        Common patterns:
        - Webhook → Process → Response (for APIs)
        - Schedule → Fetch → Transform → Store (for ETL)
        - Trigger → Condition → Action (for automation)
      `,
      metadata: {
        type: 'guide',
        category: 'best-practices'
      }
    },
    {
      title: 'Common n8n Node Combinations',
      content: `
        Frequently used node combinations:
        
        1. **API Integration**:
           - Webhook → HTTP Request → Set → Respond to Webhook
        
        2. **Data Processing**:
           - Schedule → Database → Code → Aggregate → Database
        
        3. **Notifications**:
           - Trigger → IF → Slack/Email/Telegram
        
        4. **File Processing**:
           - Trigger → Read File → Transform → Write File
        
        5. **Error Handling**:
           - Error Trigger → Format Error → Send Notification
      `,
      metadata: {
        type: 'patterns',
        category: 'common-patterns'
      }
    }
  ];
}

async function main() {
  console.log('🚀 Starting RAG population...\n');

  // Check if Qdrant is running
  const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
  try {
    const response = await fetch(`${qdrantUrl}/collections`);
    if (!response.ok) {
      console.error('❌ Qdrant is not running. Please start it first:');
      console.error('   docker run -p 6333:6333 qdrant/qdrant');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Cannot connect to Qdrant at', qdrantUrl);
    console.error('   Please start Qdrant or set QDRANT_URL environment variable');
    process.exit(1);
  }

  // Initialize AI provider
  const config = getAIConfig();
  let provider;
  
  try {
    provider = AIProviderFactory.create(config.providers.primary);
  } catch (error) {
    console.warn('⚠️  No AI provider configured. Using mock embeddings.');
    // Create mock provider for testing
    provider = {
      complete: async () => ({ content: 'mock' }),
      embed: async ({ texts }: { texts: string[] }) => ({
        embeddings: texts.map(() => Array(1536).fill(0).map(() => Math.random()))
      })
    } as any;
  }

  // Initialize RAG system
  const ragSystem = new RAGSystem({
    vectorStore: {
      type: 'qdrant',
      url: qdrantUrl,
      collectionName: 'n8n-knowledge'
    },
    embedder: provider
  });

  await ragSystem.initialize();
  
  const indexer = new DocumentIndexer(ragSystem);

  // 1. Index built-in nodes
  console.log('\n📦 Indexing built-in n8n nodes...');
  try {
    await indexer.indexBuiltinNodes();
    console.log('✅ Built-in nodes indexed');
  } catch (error) {
    console.warn('⚠️  Failed to index built-in nodes:', error);
  }

  // 2. Index common patterns
  console.log('\n🎨 Indexing common workflow patterns...');
  await indexer.indexCommonPatterns();
  console.log('✅ Common patterns indexed');

  // 3. Load local documentation
  console.log('\n📚 Loading documentation...');
  const docs = await loadLocalDocumentation();
  for (const doc of docs) {
    await ragSystem.addDocuments([doc]);
  }

  // 4. Add system prompts and guides
  console.log('\n📝 Adding guides and best practices...');
  const prompts = await createSystemPrompts();
  for (const prompt of prompts) {
    await ragSystem.addDocuments([prompt]);
  }

  // 5. Fetch templates from GitHub
  console.log('\n🌐 Fetching workflow templates from GitHub...');
  let totalTemplates = 0;
  
  for (const repo of TEMPLATE_REPOS) {
    const templates = await fetchGitHubTemplates(repo.owner, repo.repo);
    
    for (const template of templates) {
      await indexer.indexWorkflowTemplate(
        template.workflow,
        template.name,
        template.tags
      );
      totalTemplates++;
    }
  }

  // 6. Summary
  console.log('\n✨ RAG population completed!');
  console.log(`📊 Summary:`);
  console.log(`   - Built-in nodes indexed`);
  console.log(`   - ${docs.length} documentation files`);
  console.log(`   - ${prompts.length} guides and best practices`);
  console.log(`   - ${totalTemplates} workflow templates`);
  
  // Test the system
  console.log('\n🧪 Testing RAG system...');
  const testQuery = 'How to make HTTP requests in n8n?';
  const results = await ragSystem.search(testQuery, 3);
  console.log(`\nTest query: "${testQuery}"`);
  console.log(`Found ${results.length} relevant documents`);
  
  process.exit(0);
}

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});