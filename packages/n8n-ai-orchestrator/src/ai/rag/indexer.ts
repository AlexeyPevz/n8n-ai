import { RAGSystem } from './rag-system.js';
import { DocumentProcessor } from './document-processor.js';
import type { AIProvider } from '../providers/base.js';
import { AIProviderFactory } from '../providers/factory.js';
import { getAIConfig } from '../config.js';
// @ts-ignore - workspace import
import { loadBuiltinNodes } from '../../hooks-import';

export class DocumentIndexer {
  private ragSystem: RAGSystem;

  constructor(ragSystem: RAGSystem) {
    this.ragSystem = ragSystem;
  }

  /**
   * Index all builtin n8n nodes
   */
  async indexBuiltinNodes(): Promise<void> {
    // Using structured logs would be preferable in production
    const nodes = loadBuiltinNodes();
    
    
    const nodeDescriptions = nodes.map((n: any) => n.description).filter(Boolean);
    
    
    await this.ragSystem.indexNodeTypes(nodeDescriptions);
    
  }

  /**
   * Index common workflow patterns
   */
  async indexCommonPatterns(): Promise<void> {
    const patterns = [
      {
        title: 'HTTP API Integration',
        description: 'Fetch data from external APIs using HTTP Request node',
        workflow: {
          nodes: [
            {
              name: 'Manual Trigger',
              type: 'n8n-nodes-base.manualTrigger',
            },
            {
              name: 'HTTP Request',
              type: 'n8n-nodes-base.httpRequest',
            },
            {
              name: 'Set',
              type: 'n8n-nodes-base.set',
            },
          ],
          connections: {
            'Manual Trigger': {
              main: [[{ node: 'HTTP Request', type: 'main', index: 0 }]],
            },
            'HTTP Request': {
              main: [[{ node: 'Set', type: 'main', index: 0 }]],
            },
          },
        },
        tags: ['api', 'http', 'integration'],
      },
      {
        title: 'Scheduled Data Sync',
        description: 'Periodically sync data between systems',
        workflow: {
          nodes: [
            {
              name: 'Schedule Trigger',
              type: 'n8n-nodes-base.scheduleTrigger',
            },
            {
              name: 'Database',
              type: 'n8n-nodes-base.postgres',
            },
            {
              name: 'Transform',
              type: 'n8n-nodes-base.set',
            },
            {
              name: 'HTTP Request',
              type: 'n8n-nodes-base.httpRequest',
            },
          ],
          connections: {
            'Schedule Trigger': {
              main: [[{ node: 'Database', type: 'main', index: 0 }]],
            },
            'Database': {
              main: [[{ node: 'Transform', type: 'main', index: 0 }]],
            },
            'Transform': {
              main: [[{ node: 'HTTP Request', type: 'main', index: 0 }]],
            },
          },
        },
        tags: ['schedule', 'sync', 'database', 'etl'],
      },
      {
        title: 'Webhook Processing',
        description: 'Receive and process webhook data',
        workflow: {
          nodes: [
            {
              name: 'Webhook',
              type: 'n8n-nodes-base.webhook',
            },
            {
              name: 'IF',
              type: 'n8n-nodes-base.if',
            },
            {
              name: 'Process Valid',
              type: 'n8n-nodes-base.code',
            },
            {
              name: 'Handle Error',
              type: 'n8n-nodes-base.respondToWebhook',
            },
          ],
          connections: {
            'Webhook': {
              main: [[{ node: 'IF', type: 'main', index: 0 }]],
            },
            'IF': {
              main: [
                [{ node: 'Process Valid', type: 'main', index: 0 }],
                [{ node: 'Handle Error', type: 'main', index: 0 }],
              ],
            },
          },
        },
        tags: ['webhook', 'api', 'conditional', 'error-handling'],
      },
    ];

    
    
    for (const pattern of patterns) {
      await this.ragSystem.indexWorkflowExample(pattern.workflow, {
        title: pattern.title,
        description: pattern.description,
        tags: pattern.tags,
      });
    }
    
    
  }

  /**
   * Index n8n documentation guides
   */
  async indexGuides(): Promise<void> {
    const guides = [
      {
        title: 'Working with HTTP Requests',
        content: `
The HTTP Request node is one of the most versatile nodes in n8n. It allows you to:

1. Make GET, POST, PUT, DELETE, PATCH requests
2. Add headers and authentication
3. Send JSON, Form Data, or raw body
4. Handle responses and errors
5. Use expressions to make dynamic requests

Common patterns:
- Use expressions like {{$json.id}} to reference data from previous nodes
- Enable "Split Into Items" to process array responses individually
- Use "Retry on Fail" for unreliable APIs
- Add authentication via predefined credentials or custom headers
`,
        category: 'node-guide',
      },
      {
        title: 'Error Handling Best Practices',
        content: `
Proper error handling ensures your workflows are reliable:

1. Use the Error Trigger node to catch and handle errors
2. Add IF nodes to check for error conditions
3. Use the Stop and Error node to halt execution with custom messages
4. Enable "Continue On Fail" for non-critical nodes
5. Log errors using the Write Binary File or Send Email nodes

Error handling patterns:
- Wrap critical sections in Try-Catch patterns using Error Trigger
- Send notifications on failure
- Implement retry logic with Wait nodes
- Store error logs for debugging
`,
        category: 'best-practices',
      },
      {
        title: 'Working with Loops and Batches',
        content: `
n8n provides several ways to process data in loops:

1. Split In Batches node - Process large datasets in chunks
2. Loop Over Items - Automatic when node receives array
3. Execute Workflow node - For complex loop logic
4. Code node - Custom JavaScript loops

Performance tips:
- Use batching for API rate limits
- Set appropriate batch sizes (usually 10-100)
- Add Wait nodes between batches if needed
- Monitor memory usage with large datasets
`,
        category: 'advanced-guide',
      },
    ];

    
    
    for (const guide of guides) {
      const doc = DocumentProcessor.processGuide(guide.content, {
        title: guide.title,
        category: guide.category,
      });
      
      await this.ragSystem.upsertDocuments([doc]);
    }
    
    
  }

  /**
   * Get indexing statistics
   */
  async getStats(): Promise<any> {
    return this.ragSystem.getStats();
  }
}

/**
 * CLI tool to index documents
 */
export async function runIndexer(): Promise<void> {
  
  
  // Initialize AI provider
  const config = getAIConfig();
  const provider = AIProviderFactory.create(config.providers.primary);
  
  // Initialize RAG system
  const ragSystem = new RAGSystem({
    vectorStore: {
      type: 'qdrant',
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
      collectionName: config.features.rag.collectionName,
    },
    embedder: provider,
    topK: config.features.rag.topK,
  });
  
  const indexer = new DocumentIndexer(ragSystem);
  
  try {
    // Index everything
    await indexer.indexBuiltinNodes();
    await indexer.indexCommonPatterns();
    await indexer.indexGuides();
    
    // Show stats
    const stats = await indexer.getStats();
    
  } catch (error) {
    console.error('Indexing failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runIndexer();
}