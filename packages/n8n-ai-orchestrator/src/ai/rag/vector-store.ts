export interface VectorDocument {
  id: string;
  content: string;
  metadata: {
    source: string;
    type: 'node-doc' | 'example' | 'guide' | 'api-doc';
    nodeType?: string;
    title?: string;
    url?: string;
    lastUpdated?: Date;
    originalId?: string;
    chunkIndex?: number;
  };
  embedding?: number[];
}

export interface SearchResult {
  document: VectorDocument;
  score: number;
}

export interface VectorStore {
  /**
   * Add or update documents in the store
   */
  upsert(documents: VectorDocument[]): Promise<void>;
  
  /**
   * Search for similar documents
   */
  search(query: string, options?: {
    topK?: number;
    filter?: Record<string, any>;
    minScore?: number;
  }): Promise<SearchResult[]>;
  
  /**
   * Delete documents by ID
   */
  delete(ids: string[]): Promise<void>;
  
  /**
   * Get document by ID
   */
  get(id: string): Promise<VectorDocument | null>;
  
  /**
   * Count documents in store
   */
  count(filter?: Record<string, any>): Promise<number>;
  
  /**
   * Create collection if not exists
   */
  ensureCollection(): Promise<void>;
}