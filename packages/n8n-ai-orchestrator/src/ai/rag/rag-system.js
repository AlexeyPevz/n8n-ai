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
        if (this.vectorStore.createCollection) {
            await this.vectorStore.createCollection({ vectors: { size: 1536, distance: 'Cosine' } });
        }
        else if (typeof this.vectorStore.ensureCollection === 'function') {
            await this.vectorStore.ensureCollection();
        }
        // optional count
        if (typeof this.vectorStore.count === 'function') {
            const count = await this.vectorStore.count();
            if (count === 0) {
                // optionally seed
            }
        }
        this.isInitialized = true;
    }
    async ensureCollection() {
        if (this.vectorStore.createCollection) {
            await this.vectorStore.createCollection({ vectors: { size: 1536, distance: 'Cosine' } });
        }
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
    async search(arg1, arg2) {
        await this.initialize();
        try {
            if (typeof arg1 === 'string') {
                const vector = await this.config.embedder.embed({ texts: [arg1] });
                const results = await this.vectorStore.search(vector, (arg2?.limit ?? this.config.topK) || 5, undefined);
                return results.map((r) => ({ id: r.id, score: r.score, content: r.payload?.content ?? r.content }));
            }
            const context = arg1;
            const vector = await this.config.embedder.embed({ texts: [context.query] });
            const filter = context.filter ? { ...context.filter } : {};
            if (context.nodeTypes && context.nodeTypes.length > 0) {
                filter.nodeType = { $in: context.nodeTypes };
            }
            const results = await this.vectorStore.search(vector, this.config.topK || 5, Object.keys(filter).length ? filter : undefined);
            return results;
        }
        catch {
            return typeof arg1 === 'string' ? [] : [];
        }
    }
    /**
     * Get context for prompt enhancement
     */
    async getContext(context) {
        const results = await this.search(context);
        if (!Array.isArray(results) || results.length === 0)
            return '';
        // Deduplicate
        let items = results.map((r) => ({ score: r.score, content: r.payload?.content || r.content || '', meta: r.payload || {} }));
        if (context.deduplicate) {
            const unique = [];
            for (const it of items) {
                if (!unique.some(u => similarity(u.content, it.content) > 0.3))
                    unique.push(it);
            }
            items = unique.slice(0, 2);
        }
        const sections = items.slice(0, 2).map((it) => it.content);
        const header = context.workflowContext ? `Current workflow has ${Array.isArray(context.workflowContext.nodes) ? context.workflowContext.nodes.length : 0} nodes` : '';
        let out = header ? [header, '', ...sections].join('\n') : sections.join('\n\n');
        if (context.maxTokens && out.length >= context.maxTokens * 3)
            out = out.slice(0, context.maxTokens * 3 - 1);
        return out;
    }
    /**
     * Public helper to upsert documents without exposing the underlying store
     */
    async upsertDocuments(documents) {
        await this.initialize();
        const items = [];
        for (const d of documents) {
            const vector = await this.config.embedder.embed({ texts: [d.content] });
            items.push({ id: d.id, vector, payload: d.metadata ? { ...d.metadata, content: d.content } : { content: d.content } });
        }
        await this.vectorStore.upsert(items);
    }
    async indexDocuments(documents, opts) {
        await this.initialize();
        const chunkSize = opts?.chunkSize ?? 2000;
        const chunkOverlap = opts?.chunkOverlap ?? 200;
        const chunks = [];
        for (const d of documents) {
            if (d.content.length <= chunkSize) {
                chunks.push(d);
            }
            else {
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
        return { documentCount: total, collectionName: this.config.vectorStore.collectionName, vectorStore: this.config.vectorStore.type };
    }
    async getCollectionStats() {
        const total = typeof this.vectorStore.count === 'function' ? await this.vectorStore.count() : 0;
        return { documentCount: total, collectionName: this.config.vectorStore.collectionName, vectorStore: this.config.vectorStore.type };
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
function similarity(a, b) {
    if (!a || !b)
        return 0;
    const setA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
    const setB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
    const inter = new Set([...setA].filter(x => setB.has(x))).size;
    const union = new Set([...setA, ...setB]).size;
    return union ? inter / union : 0;
}
