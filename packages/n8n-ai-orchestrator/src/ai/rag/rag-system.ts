import type { VectorStore, SearchResult, VectorDocument } from './vector-store.js';
import { QdrantVectorStore } from './qdrant-store.js';
import { DocumentProcessor } from './document-processor.js';
import type { AIProvider } from '../providers/base.js';
import type { INodeTypeDescription } from 'n8n-workflow';

export interface RAGConfig {
  vectorStore: {
    type: 'qdrant';
    url: string;
    apiKey?: string;
    collectionName: string;
  };
  embedder: AIProvider;
  topK?: number;
  minScore?: number;
}

export interface RAGContext {
  query: string;
  nodeTypes?: string[];
  workflowContext?: any;
  filter?: Record<string, any>;
  deduplicate?: boolean;
  maxTokens?: number;
}

export class RAGSystem {
  private vectorStore: VectorStore;
  private config: RAGConfig;
  private isInitialized = false;

  constructor(config: RAGConfig) {
    this.config = config;
    
    // Initialize vector store
    if (config.vectorStore.type === 'qdrant') {
      this.vectorStore = new QdrantVectorStore(
        {
          url: config.vectorStore.url,
          apiKey: config.vectorStore.apiKey,
          collectionName: config.vectorStore.collectionName,
        },
        config.embedder
      );
    } else {
      throw new Error(`Unsupported vector store type: ${config.vectorStore.type}`);
    }
  }

  /**
   * Initialize the RAG system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if ((this.vectorStore as any).createCollection) {
      await (this.vectorStore as any).createCollection({ vectors: { size: 1536, distance: 'Cosine' } });
    } else if (typeof (this.vectorStore as any).ensureCollection === 'function') {
      await (this.vectorStore as any).ensureCollection();
    }
    // optional count
    if (typeof (this.vectorStore as any).count === 'function') {
      const count = await (this.vectorStore as any).count();
      if (count === 0) {
        // optionally seed
      }
    }
    this.isInitialized = true;
  }

  async ensureCollection(): Promise<void> {
    if ((this.vectorStore as any).createCollection) {
      await (this.vectorStore as any).createCollection({ vectors: { size: 1536, distance: 'Cosine' } });
    }
  }

  /**
   * Index node types into the vector store
   */
  async indexNodeTypes(nodes: INodeTypeDescription[]): Promise<void> {
    await this.initialize();
    
    const documents = [];
    for (const node of nodes) {
      const nodeDocs = DocumentProcessor.processNodeType(node);
      documents.push(...nodeDocs);
    }
    
    // Chunk large documents
    const chunkedDocs = [];
    for (const doc of documents) {
      chunkedDocs.push(...DocumentProcessor.chunkDocument(doc));
    }
    
    // Index in batches
    const batchSize = 100;
    for (let i = 0; i < chunkedDocs.length; i += batchSize) {
      const batch = chunkedDocs.slice(i, i + batchSize);
      await this.vectorStore.upsert(batch);
      
    }
  }

  /**
   * Index workflow examples
   */
  async indexWorkflowExample(workflow: any, metadata: {
    title: string;
    description?: string;
    tags?: string[];
  }): Promise<void> {
    await this.initialize();
    
    const doc = DocumentProcessor.processWorkflowExample(workflow, metadata);
    const chunks = DocumentProcessor.chunkDocument(doc);
    
    await this.vectorStore.upsert(chunks);
  }

  /**
   * Search for relevant context
   */
  async search(arg1: RAGContext | string, arg2?: { limit?: number }): Promise<any> {
    await this.initialize();
    try {
      if (typeof arg1 === 'string') {
        const vector = await this.config.embedder.embed({ texts: [arg1] });
        const results = await (this.vectorStore as any).search(vector, (arg2?.limit ?? this.config.topK) || 5, undefined);
        return (results as any[]).map((r: any) => ({ id: r.id, score: r.score, content: r.payload?.content ?? r.content }));
      }
      const context = arg1 as RAGContext;
      const vector = await this.config.embedder.embed({ texts: [context.query] });
      const filter: Record<string, any> = context.filter ? { ...context.filter } : {};
      if (context.nodeTypes && context.nodeTypes.length > 0) {
        filter.nodeType = { $in: context.nodeTypes };
      }
      const results = await (this.vectorStore as any).search(vector, this.config.topK || 5, Object.keys(filter).length ? filter : undefined);
      return results as unknown as SearchResult[];
    } catch {
      return typeof arg1 === 'string' ? [] : [];
    }
  }

  /**
   * Get context for prompt enhancement
   */
  async getContext(context: RAGContext): Promise<string> {
    const results = await this.search(context);
    if (!Array.isArray(results) || results.length === 0) return '';
    // Deduplicate
    let items = results.map((r: any) => ({ score: r.score, content: r.payload?.content || r.content || '', meta: r.payload || {} }));
    if (context.deduplicate) {
      const unique: typeof items = [];
      for (const it of items) {
        if (!unique.some(u => similarity(u.content, it.content) > 0.3)) unique.push(it);
      }
      items = unique.slice(0, 2);
    }
    const sections = items.slice(0, 2).map((it) => it.content);
    const header = context.workflowContext ? `Current workflow has ${Array.isArray((context.workflowContext as any).nodes) ? (context.workflowContext as any).nodes.length : 0} nodes` : '';
    let out = header ? [header, '', ...sections].join('\n') : sections.join('\n\n');
    if (context.maxTokens && out.length >= context.maxTokens * 3) out = out.slice(0, context.maxTokens * 3 - 1);
    return out;
  }

  /**
   * Public helper to upsert documents without exposing the underlying store
   */
  async upsertDocuments(documents: VectorDocument[]): Promise<void> {
    await this.initialize();
    const items: any[] = [];
    for (const d of documents) {
      const vector = await this.config.embedder.embed({ texts: [d.content] });
      items.push({ id: d.id, vector, payload: d.metadata ? { ...d.metadata, content: d.content } : { content: d.content } });
    }
    await (this.vectorStore as any).upsert(items);
  }

  async indexDocuments(documents: VectorDocument[], opts?: { chunkSize?: number; chunkOverlap?: number }): Promise<void> {
    await this.initialize();
    const chunkSize = opts?.chunkSize ?? 2000;
    const chunkOverlap = opts?.chunkOverlap ?? 200;
    const chunks: VectorDocument[] = [];
    for (const d of documents) {
      if (d.content.length <= chunkSize) {
        chunks.push(d);
      } else {
        let idx = 0;
        let part = 0;
        while (idx < d.content.length) {
          const sub = d.content.slice(idx, idx + chunkSize);
          chunks.push({ id: `${d.id}-chunk-${part++}`, content: sub, metadata: d.metadata });
          idx += chunkSize - chunkOverlap;
        }
      }
    }
    await this.upsertDocuments(chunks);
  }

  /**
   * Generate enhanced prompt with RAG context
   */
  async enhancePrompt(originalPrompt: string, context?: Partial<RAGContext>): Promise<string> {
    const ragContext: RAGContext = {
      query: originalPrompt,
      ...context,
    };
    
    const contextText = await this.getContext(ragContext);
    
    if (!contextText) {
      return originalPrompt;
    }
    
    return [
      contextText,
      '',
      'User request:',
      originalPrompt,
    ].join('\n');
  }

  /**
   * Get statistics about the vector store
   */
  async getStats(): Promise<{
    documentCount: number;
    collectionName: string;
    vectorStore: string;
  }> {
    await this.initialize();
    const total = await (this.vectorStore as any).count();
    return { documentCount: total, collectionName: this.config.vectorStore.collectionName, vectorStore: this.config.vectorStore.type };
  }

  async getCollectionStats(): Promise<{ documentCount: number; collectionName: string; vectorStore: string }> {
    const total = typeof (this.vectorStore as any).count === 'function' ? await (this.vectorStore as any).count() : 0;
    return { documentCount: total, collectionName: (this.config.vectorStore as any).collectionName, vectorStore: this.config.vectorStore.type };
  }

  /**
   * Clear all documents from the vector store
   */
  async clear(): Promise<void> {
    await this.initialize();
    
    // In production, this would require confirmation
    // Clearing all documents from vector store
    
    // Qdrant doesn't have a clear method, so we'd need to recreate the collection
    // For now, we'll leave this as a placeholder
    throw new Error('Clear operation not implemented for safety');
  }
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const setA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const setB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  const inter = new Set([...setA].filter(x => setB.has(x))).size;
  const union = new Set([...setA, ...setB]).size;
  return union ? inter / union : 0;
}