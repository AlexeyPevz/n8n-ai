import { QdrantVectorStore } from './qdrant-store.js';
import { DocumentProcessor } from './document-processor.js';
export class RAGSystem {
    vectorStore;
    config;
    isInitialized = false;
    constructor(config) {
        this.config = config;
        // Initialize vector store
        if (config.vectorStore.type === 'qdrant') {
            this.vectorStore = new QdrantVectorStore({
                url: config.vectorStore.url,
                apiKey: config.vectorStore.apiKey,
                collectionName: config.vectorStore.collectionName,
            }, config.embedder);
        }
        else {
            throw new Error(`Unsupported vector store type: ${config.vectorStore.type}`);
        }
    }
    /**
     * Initialize the RAG system
     */
    async initialize() {
        if (this.isInitialized)
            return;
        await this.vectorStore.ensureCollection();
        // Check if we need to populate initial data
        const count = await this.vectorStore.count();
        if (count === 0) {
            // In production, this would load initial n8n documentation
            // await this.populateInitialData();
        }
        this.isInitialized = true;
    }
    /**
     * Index node types into the vector store
     */
    async indexNodeTypes(nodes) {
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
    async indexWorkflowExample(workflow, metadata) {
        await this.initialize();
        const doc = DocumentProcessor.processWorkflowExample(workflow, metadata);
        const chunks = DocumentProcessor.chunkDocument(doc);
        await this.vectorStore.upsert(chunks);
    }
    /**
     * Search for relevant context
     */
    async search(context) {
        await this.initialize();
        const filter = {};
        // Filter by node types if specified
        if (context.nodeTypes && context.nodeTypes.length > 0) {
            filter.nodeType = { $in: context.nodeTypes };
        }
        // Search
        const results = await this.vectorStore.search(context.query, {
            topK: this.config.topK || 5,
            minScore: this.config.minScore || 0.7,
            filter: Object.keys(filter).length > 0 ? filter : undefined,
        });
        return results;
    }
    /**
     * Get context for prompt enhancement
     */
    async getContext(context) {
        const results = await this.search(context);
        if (results.length === 0) {
            return '';
        }
        // Format results for prompt
        const sections = results.map((result, index) => {
            const { document } = result;
            const source = document.metadata.title || document.metadata.source;
            return [
                `[${index + 1}] ${source} (relevance: ${(result.score * 100).toFixed(1)}%)`,
                document.content,
                '',
            ].join('\n');
        });
        return [
            'Relevant n8n documentation:',
            '---',
            ...sections,
            '---',
        ].join('\n');
    }
    /**
     * Public helper to upsert documents without exposing the underlying store
     */
    async upsertDocuments(documents) {
        await this.initialize();
        await this.vectorStore.upsert(documents);
    }
    /**
     * Generate enhanced prompt with RAG context
     */
    async enhancePrompt(originalPrompt, context) {
        const ragContext = {
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
    async getStats() {
        await this.initialize();
        const total = await this.vectorStore.count();
        // Count by type
        const types = ['node-doc', 'example', 'guide', 'api-doc'];
        const byType = {};
        for (const type of types) {
            byType[type] = await this.vectorStore.count({ type });
        }
        // Count by source
        const sources = ['node-description', 'node-property', 'workflow-example', 'guide'];
        const bySource = {};
        for (const source of sources) {
            bySource[source] = await this.vectorStore.count({ source });
        }
        return {
            totalDocuments: total,
            byType,
            bySource,
        };
    }
    /**
     * Clear all documents from the vector store
     */
    async clear() {
        await this.initialize();
        // In production, this would require confirmation
        console.warn('Clearing all documents from vector store...');
        // Qdrant doesn't have a clear method, so we'd need to recreate the collection
        // For now, we'll leave this as a placeholder
        throw new Error('Clear operation not implemented for safety');
    }
}
