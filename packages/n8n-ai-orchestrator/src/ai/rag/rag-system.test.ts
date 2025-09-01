import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RAGSystem } from './rag-system.js';
import { QdrantVectorStore } from './qdrant-store.js';
import type { AIProvider } from '../providers/base.js';

vi.mock('./qdrant-store.js');

describe('RAGSystem', () => {
  let ragSystem: RAGSystem;
  let mockVectorStore: any;
  let mockEmbedder: any;

  beforeEach(() => {
    mockVectorStore = {
      search: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      createCollection: vi.fn(),
    };

    mockEmbedder = {
      embed: vi.fn(),
      complete: vi.fn(),
    };

    vi.mocked(QdrantVectorStore).mockImplementation(() => mockVectorStore);

    ragSystem = new RAGSystem({
      vectorStore: {
        type: 'qdrant',
        url: 'http://localhost:6333',
        collectionName: 'test_collection',
      },
      embedder: mockEmbedder,
      topK: 5,
    });
  });

  describe('context retrieval', () => {
    it('should retrieve relevant context for query', async () => {
      const mockResults = [
        {
          id: '1',
          score: 0.95,
          payload: {
            content: 'The HTTP Request node allows you to make API calls.',
            type: 'node_description',
            nodeType: 'n8n-nodes-base.httpRequest',
          },
        },
        {
          id: '2',
          score: 0.85,
          payload: {
            content: 'Use webhook nodes to receive incoming HTTP requests.',
            type: 'node_description',
            nodeType: 'n8n-nodes-base.webhook',
          },
        },
      ];

      mockEmbedder.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      mockVectorStore.search.mockResolvedValue(mockResults);

      const context = await ragSystem.getContext({
        query: 'How to make HTTP requests?',
        nodeTypes: ['httpRequest', 'webhook'],
      });

      expect(mockEmbedder.embed).toHaveBeenCalledWith('How to make HTTP requests?');
      expect(mockVectorStore.search).toHaveBeenCalledWith(
        [0.1, 0.2, 0.3],
        5,
        expect.objectContaining({
          nodeType: { $in: ['httpRequest', 'webhook'] },
        })
      );
      expect(context).toContain('HTTP Request node');
      expect(context).toContain('webhook nodes');
    });

    it('should handle empty results', async () => {
      mockEmbedder.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      mockVectorStore.search.mockResolvedValue([]);

      const context = await ragSystem.getContext({
        query: 'Unknown topic',
      });

      expect(context).toBe('');
    });

    it('should filter by metadata', async () => {
      mockEmbedder.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      mockVectorStore.search.mockResolvedValue([
        {
          id: '1',
          score: 0.9,
          payload: {
            content: 'Advanced workflow features',
            type: 'tutorial',
            difficulty: 'advanced',
          },
        },
      ]);

      await ragSystem.getContext({
        query: 'workflow features',
        filter: { difficulty: 'advanced' },
      });

      expect(mockVectorStore.search).toHaveBeenCalledWith(
        expect.any(Array),
        5,
        { difficulty: 'advanced' }
      );
    });

    it('should include workflow context', async () => {
      const workflowContext = {
        nodes: [
          { id: '1', type: 'webhook', name: 'Webhook' },
          { id: '2', type: 'httpRequest', name: 'API Call' },
        ],
        connections: {
          '1': { main: [[{ node: '2', type: 'main', index: 0 }]] },
        },
      };

      mockEmbedder.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      mockVectorStore.search.mockResolvedValue([
        {
          id: '1',
          score: 0.9,
          payload: {
            content: 'Connect webhook to HTTP request for API integrations.',
            type: 'pattern',
          },
        },
      ]);

      const context = await ragSystem.getContext({
        query: 'improve my workflow',
        workflowContext,
      });

      expect(context).toContain('Current workflow has');
      expect(context).toContain('2 nodes');
      expect(context).toContain('Connect webhook to HTTP request');
    });
  });

  describe('document indexing', () => {
    it('should index documents', async () => {
      const documents = [
        {
          id: 'doc1',
          content: 'HTTP Request node documentation',
          metadata: {
            type: 'node_doc',
            nodeType: 'httpRequest',
          },
        },
        {
          id: 'doc2',
          content: 'Webhook trigger documentation',
          metadata: {
            type: 'node_doc',
            nodeType: 'webhook',
          },
        },
      ];

      mockEmbedder.embed
        .mockResolvedValueOnce([0.1, 0.2, 0.3])
        .mockResolvedValueOnce([0.4, 0.5, 0.6]);

      await ragSystem.indexDocuments(documents);

      expect(mockEmbedder.embed).toHaveBeenCalledTimes(2);
      expect(mockVectorStore.upsert).toHaveBeenCalledWith([
        {
          id: 'doc1',
          vector: [0.1, 0.2, 0.3],
          payload: {
            content: 'HTTP Request node documentation',
            type: 'node_doc',
            nodeType: 'httpRequest',
          },
        },
        {
          id: 'doc2',
          vector: [0.4, 0.5, 0.6],
          payload: {
            content: 'Webhook trigger documentation',
            type: 'node_doc',
            nodeType: 'webhook',
          },
        },
      ]);
    });

    it('should chunk large documents', async () => {
      const largeContent = 'A'.repeat(5000); // Large document
      const documents = [
        {
          id: 'large-doc',
          content: largeContent,
          metadata: { type: 'tutorial' },
        },
      ];

      mockEmbedder.embed.mockResolvedValue([0.1, 0.2, 0.3]);

      await ragSystem.indexDocuments(documents, { chunkSize: 1000, chunkOverlap: 100 });

      // Should create multiple chunks
      expect(mockVectorStore.upsert).toHaveBeenCalled();
      const calls = mockVectorStore.upsert.mock.calls[0][0];
      expect(calls.length).toBeGreaterThan(1);
      expect(calls[0].id).toContain('large-doc-chunk-0');
    });
  });

  describe('semantic search', () => {
    it('should perform semantic search', async () => {
      mockEmbedder.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      mockVectorStore.search.mockResolvedValue([
        {
          id: '1',
          score: 0.95,
          payload: { content: 'Result 1', type: 'doc' },
        },
        {
          id: '2',
          score: 0.85,
          payload: { content: 'Result 2', type: 'doc' },
        },
      ]);

      const results = await ragSystem.search('test query', { limit: 10 });

      expect(results).toHaveLength(2);
      expect(results[0].score).toBe(0.95);
      expect(results[0].content).toBe('Result 1');
    });
  });

  describe('context optimization', () => {
    it('should deduplicate similar results', async () => {
      mockEmbedder.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      mockVectorStore.search.mockResolvedValue([
        {
          id: '1',
          score: 0.95,
          payload: { content: 'HTTP Request node makes API calls.', type: 'doc' },
        },
        {
          id: '2',
          score: 0.94,
          payload: { content: 'HTTP Request node is used for API calls.', type: 'doc' },
        },
        {
          id: '3',
          score: 0.85,
          payload: { content: 'Webhook node receives HTTP requests.', type: 'doc' },
        },
      ]);

      const context = await ragSystem.getContext({
        query: 'API calls',
        deduplicate: true,
      });

      // Should remove very similar content
      const lines = context.split('\n').filter(l => l.trim());
      expect(lines.length).toBeLessThan(3);
    });

    it('should respect token limits', async () => {
      mockEmbedder.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      mockVectorStore.search.mockResolvedValue([
        {
          id: '1',
          score: 0.95,
          payload: { content: 'A'.repeat(1000), type: 'doc' },
        },
        {
          id: '2',
          score: 0.85,
          payload: { content: 'B'.repeat(1000), type: 'doc' },
        },
      ]);

      const context = await ragSystem.getContext({
        query: 'test',
        maxTokens: 500,
      });

      // Should truncate to fit token limit
      expect(context.length).toBeLessThan(1500);
    });
  });

  describe('collection management', () => {
    it('should create collection if not exists', async () => {
      await ragSystem.ensureCollection();

      expect(mockVectorStore.createCollection).toHaveBeenCalledWith({
        vectors: {
          size: expect.any(Number),
          distance: 'Cosine',
        },
      });
    });

    it('should get collection stats', async () => {
      mockVectorStore.count.mockResolvedValue(150);

      const stats = await ragSystem.getStats();

      expect(stats).toMatchObject({
        documentCount: 150,
        collectionName: 'test_collection',
        vectorStore: 'qdrant',
      });
    });
  });

  describe('error handling', () => {
    it('should handle embedding errors gracefully', async () => {
      mockEmbedder.embed.mockRejectedValue(new Error('Embedding failed'));

      const context = await ragSystem.getContext({
        query: 'test query',
      });

      expect(context).toBe('');
    });

    it('should handle vector store errors', async () => {
      mockEmbedder.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      mockVectorStore.search.mockRejectedValue(new Error('Search failed'));

      const context = await ragSystem.getContext({
        query: 'test query',
      });

      expect(context).toBe('');
    });
  });
});