export class QdrantVectorStore {
    config;
    embedder;
    vectorSize;
    constructor(config, embedder) {
        this.config = config;
        this.embedder = embedder;
        this.vectorSize = config.vectorSize || 1536; // Default for OpenAI embeddings
    }
    async ensureCollection() {
        const headers = {
            'Content-Type': 'application/json',
        };
        if (this.config.apiKey) {
            headers['api-key'] = this.config.apiKey;
        }
        // Check if collection exists
        const checkResponse = await fetch(`${this.config.url}/collections/${this.config.collectionName}`, { headers });
        if (checkResponse.status === 404) {
            // Create collection
            const createResponse = await fetch(`${this.config.url}/collections/${this.config.collectionName}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({
                    vectors: {
                        size: this.vectorSize,
                        distance: 'Cosine',
                    },
                }),
            });
            if (!createResponse.ok) {
                throw new Error(`Failed to create Qdrant collection: ${createResponse.statusText}`);
            }
            // Create indexes for metadata fields
            await this.createIndexes();
        }
    }
    async createIndexes() {
        const headers = {
            'Content-Type': 'application/json',
        };
        if (this.config.apiKey) {
            headers['api-key'] = this.config.apiKey;
        }
        // Create payload indexes for common filters
        const indexes = ['source', 'type', 'nodeType'];
        for (const field of indexes) {
            await fetch(`${this.config.url}/collections/${this.config.collectionName}/index`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({
                    field_name: field,
                    field_schema: 'keyword',
                }),
            });
        }
    }
    async upsert(documents) {
        const headers = {
            'Content-Type': 'application/json',
        };
        if (this.config.apiKey) {
            headers['api-key'] = this.config.apiKey;
        }
        // Generate embeddings for documents without them
        const docsToEmbed = documents.filter(doc => !doc.embedding);
        if (docsToEmbed.length > 0) {
            const texts = docsToEmbed.map(doc => doc.content);
            const { embeddings } = await this.embedder.embed({ texts });
            docsToEmbed.forEach((doc, i) => {
                doc.embedding = embeddings[i];
            });
        }
        // Convert to Qdrant points
        const points = documents.map(doc => ({
            id: doc.id,
            vector: doc.embedding,
            payload: {
                content: doc.content,
                ...doc.metadata,
                lastUpdated: doc.metadata.lastUpdated?.toISOString() || new Date().toISOString(),
            },
        }));
        // Upsert points
        const response = await fetch(`${this.config.url}/collections/${this.config.collectionName}/points`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                points,
            }),
        });
        if (!response.ok) {
            throw new Error(`Failed to upsert documents: ${response.statusText}`);
        }
    }
    async search(query, options) {
        const headers = {
            'Content-Type': 'application/json',
        };
        if (this.config.apiKey) {
            headers['api-key'] = this.config.apiKey;
        }
        // Generate embedding for query
        const { embeddings } = await this.embedder.embed({ texts: [query] });
        const queryVector = embeddings[0];
        // Build filter
        const filter = options?.filter ? {
            must: Object.entries(options.filter).map(([key, value]) => ({
                key,
                match: { value },
            })),
        } : undefined;
        // Search
        const response = await fetch(`${this.config.url}/collections/${this.config.collectionName}/points/search`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                vector: queryVector,
                limit: options?.topK || 10,
                filter,
                with_payload: true,
                score_threshold: options?.minScore,
            }),
        });
        if (!response.ok) {
            throw new Error(`Search failed: ${response.statusText}`);
        }
        const data = await response.json();
        return data.result.map((point) => ({
            document: {
                id: point.id,
                content: point.payload.content,
                metadata: {
                    source: point.payload.source,
                    type: point.payload.type,
                    nodeType: point.payload.nodeType,
                    title: point.payload.title,
                    url: point.payload.url,
                    lastUpdated: point.payload.lastUpdated ? new Date(point.payload.lastUpdated) : undefined,
                },
            },
            score: point.score,
        }));
    }
    async delete(ids) {
        const headers = {
            'Content-Type': 'application/json',
        };
        if (this.config.apiKey) {
            headers['api-key'] = this.config.apiKey;
        }
        const response = await fetch(`${this.config.url}/collections/${this.config.collectionName}/points/delete`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                points: ids,
            }),
        });
        if (!response.ok) {
            throw new Error(`Delete failed: ${response.statusText}`);
        }
    }
    async get(id) {
        const headers = {
            'Content-Type': 'application/json',
        };
        if (this.config.apiKey) {
            headers['api-key'] = this.config.apiKey;
        }
        const response = await fetch(`${this.config.url}/collections/${this.config.collectionName}/points/${id}`, { headers });
        if (response.status === 404) {
            return null;
        }
        if (!response.ok) {
            throw new Error(`Get failed: ${response.statusText}`);
        }
        const data = await response.json();
        const point = data.result;
        return {
            id: point.id,
            content: point.payload.content,
            metadata: {
                source: point.payload.source,
                type: point.payload.type,
                nodeType: point.payload.nodeType,
                title: point.payload.title,
                url: point.payload.url,
                lastUpdated: point.payload.lastUpdated ? new Date(point.payload.lastUpdated) : undefined,
            },
        };
    }
    async count(filter) {
        const headers = {
            'Content-Type': 'application/json',
        };
        if (this.config.apiKey) {
            headers['api-key'] = this.config.apiKey;
        }
        const body = {};
        if (filter) {
            body.filter = {
                must: Object.entries(filter).map(([key, value]) => ({
                    key,
                    match: { value },
                })),
            };
        }
        const response = await fetch(`${this.config.url}/collections/${this.config.collectionName}/points/count`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            throw new Error(`Count failed: ${response.statusText}`);
        }
        const data = await response.json();
        return data.result.count;
    }
}
