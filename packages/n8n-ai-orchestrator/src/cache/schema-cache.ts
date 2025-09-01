import { z } from 'zod';
import crypto from 'crypto';

// Schema for cached node description
const CachedNodeDescriptionSchema = z.object({
  name: z.string(),
  type: z.string(),
  typeVersion: z.number(),
  description: z.string().optional(),
  icon: z.string().optional(),
  group: z.array(z.string()).optional(),
  inputs: z.array(z.string()).optional(),
  outputs: z.array(z.string()).optional(),
  properties: z.array(z.any()), // INodeProperties[]
  credentials: z.array(z.any()).optional(),
  webhooks: z.array(z.any()).optional(),
  cachedAt: z.string().datetime(),
  hash: z.string(),
});

type CachedNodeDescription = z.infer<typeof CachedNodeDescriptionSchema>;

// Cache statistics
interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  lastReset: Date;
}

export class SchemaCache {
  private cache = new Map<string, CachedNodeDescription>();
  private accessOrder: string[] = [];
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    lastReset: new Date(),
  };
  
  constructor(
    private maxSize: number = 1000,
    private ttl: number = 3600000 // 1 hour in milliseconds
  ) {}
  
  /**
   * Get node description from cache
   */
  get(nodeType: string, version?: number): CachedNodeDescription | null {
    const key = this.makeKey(nodeType, version);
    const cached = this.cache.get(key);
    
    if (!cached) {
      this.stats.misses++;
      return null;
    }
    
    // Check TTL
    const age = Date.now() - new Date(cached.cachedAt).getTime();
    if (age > this.ttl) {
      this.delete(key);
      this.stats.misses++;
      return undefined as any;
    }
    
    // Update access order (LRU)
    this.updateAccessOrder(key);
    this.stats.hits++;
    
    return cached;
  }
  
  /**
   * Set node description in cache
   */
  set(nodeType: string, versionOrDesc: number | any | undefined, maybeDesc?: any): void {
    const version = typeof versionOrDesc === 'number' || versionOrDesc === undefined ? (versionOrDesc as number | undefined) : undefined;
    const description = version !== undefined ? maybeDesc : versionOrDesc;
    const key = this.makeKey(nodeType, version);
    
    // Create cached entry
    const cached: CachedNodeDescription = {
      ...description,
      typeVersion: version || description.typeVersion || description.version || 1,
      cachedAt: new Date().toISOString(),
      hash: this.computeHash(description),
    };
    
    // Check cache size
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }
    
    this.cache.set(key, cached);
    this.updateAccessOrder(key);
    this.stats.size = this.cache.size;
  }

  /**
   * Invalidate cache entry if hash does not match
   */
  invalidate(nodeType: string, expectedHash: string, version?: number): boolean {
    const key = this.makeKey(nodeType, version);
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (entry.hash !== expectedHash) {
      this.delete(key);
      return true;
    }
    return false;
  }
  
  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.accessOrder = this.accessOrder.filter(k => k !== key);
      this.stats.size = this.cache.size;
    }
    return deleted;
  }
  
  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.stats.size = 0;
    this.stats.lastReset = new Date();
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.evictions = 0;
  }
  
  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }
  
  /**
   * Get hit rate
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? this.stats.hits / total : 0;
  }
  
  /**
   * Warm cache with frequently used nodes
   */
  async warmUp(nodeTypes: Array<{ type: string; version?: number; description: any }>): Promise<void> {
    for (const node of nodeTypes) {
      this.set(node.type, node.version, node.description);
    }
  }

  /**
   * Warm cache via introspect API and list of node type ids
   */
  async warmCache(introspect: (type: string) => Promise<any>, types: string[]): Promise<void> {
    for (const t of types) {
      try {
        const desc = await introspect(t);
        if (desc) {
          const fullType = desc.type ?? `n8n-nodes-base.${t}`;
          this.set(fullType, (desc as any).typeVersion ?? (desc as any).version ?? undefined, desc);
        }
      } catch {
        // ignore single-node errors during pre-warm
      }
    }
  }
  
  /**
   * Get all cached node types
   */
  getCachedTypes(): string[] {
    return Array.from(this.cache.keys());
  }
  
  /**
   * Check if node type is cached
   */
  has(nodeType: string, version?: number): boolean {
    const key = this.makeKey(nodeType, version);
    const cached = this.cache.get(key);
    
    if (!cached) return false;
    
    // Check TTL
    const age = Date.now() - new Date(cached.cachedAt).getTime();
    return age <= this.ttl;
  }
  
  /**
   * Get cache size in bytes (approximate)
   */
  getSizeInBytes(): number {
    let size = 0;
    for (const [key, value] of this.cache) {
      size += key.length * 2; // UTF-16
      size += JSON.stringify(value).length * 2;
    }
    return size;
  }
  
  /**
   * Export cache for persistence
   */
  export(): Record<string, CachedNodeDescription> {
    const exported: Record<string, CachedNodeDescription> = {};
    
    for (const [key, value] of this.cache) {
      // Only export non-expired entries
      const age = Date.now() - new Date(value.cachedAt).getTime();
      if (age <= this.ttl) {
        exported[key] = value;
      }
    }
    
    return exported;
  }
  
  /**
   * Import cache from persistence
   */
  import(data: Record<string, CachedNodeDescription>): void {
    this.clear();
    
    for (const [key, value] of Object.entries(data)) {
      const age = Date.now() - new Date(value.cachedAt).getTime();
      if (age <= this.ttl) {
        this.cache.set(key, value);
        this.accessOrder.push(key);
      }
    }
    
    this.stats.size = this.cache.size;
  }
  
  // Private methods
  
  private makeKey(nodeType: string, version?: number): string {
    return version ? `${nodeType}@${version}` : nodeType;
  }
  
  private updateAccessOrder(key: string): void {
    // Remove from current position
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    // Add to end (most recently used)
    this.accessOrder.push(key);
  }
  
  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;
    
    // Remove least recently used
    const lru = this.accessOrder.shift()!;
    this.cache.delete(lru);
    this.stats.evictions++;
    this.stats.size = this.cache.size;
  }
  
  private computeHash(obj: any): string {
    const keys = obj && typeof obj === 'object' ? Object.keys(obj).sort() : undefined;
    const json = JSON.stringify(obj ?? {}, keys);
    return crypto.createHash('sha256').update(json).digest('hex').substring(0, 16);
  }
}

// Singleton instance
let schemaCache: SchemaCache | null = null;

export function getSchemaCache(): SchemaCache {
  if (!schemaCache) {
    const maxSize = parseInt(process.env.SCHEMA_CACHE_SIZE || '1000');
    const ttl = parseInt(process.env.SCHEMA_CACHE_TTL || '3600000');
    schemaCache = new SchemaCache(maxSize, ttl);
  }
  return schemaCache;
}

// Pre-warm with common nodes
export async function warmSchemaCache(): Promise<void> {
  const cache = getSchemaCache();
  
  const hotNodes = [
    {
      type: 'n8n-nodes-base.httpRequest',
      version: 4,
      description: {
        displayName: 'HTTP Request',
        name: 'httpRequest',
        icon: 'fa:globe',
        group: ['input'],
        version: 4,
        description: 'Makes HTTP requests',
        defaults: { name: 'HTTP Request' },
        inputs: ['main'],
        outputs: ['main'],
        properties: [
          {
            displayName: 'Method',
            name: 'method',
            type: 'options',
            options: [
              { name: 'GET', value: 'GET' },
              { name: 'POST', value: 'POST' },
              { name: 'PUT', value: 'PUT' },
              { name: 'DELETE', value: 'DELETE' },
            ],
            default: 'GET',
          },
          {
            displayName: 'URL',
            name: 'url',
            type: 'string',
            default: '',
            required: true,
          },
        ],
      },
    },
    {
      type: 'n8n-nodes-base.webhook',
      version: 1,
      description: {
        displayName: 'Webhook',
        name: 'webhook',
        icon: 'fa:globe',
        group: ['trigger'],
        version: 1,
        description: 'Starts workflow on webhook call',
        defaults: { name: 'Webhook' },
        inputs: [],
        outputs: ['main'],
        webhooks: [{ name: 'default', httpMethod: 'POST', responseMode: 'onReceived' }],
        properties: [
          {
            displayName: 'Path',
            name: 'path',
            type: 'string',
            default: '',
            required: true,
          },
          {
            displayName: 'Method',
            name: 'httpMethod',
            type: 'options',
            options: [
              { name: 'GET', value: 'GET' },
              { name: 'POST', value: 'POST' },
            ],
            default: 'POST',
          },
        ],
      },
    },
    {
      type: 'n8n-nodes-base.set',
      version: 1,
      description: {
        displayName: 'Set',
        name: 'set',
        icon: 'fa:pen',
        group: ['transform'],
        version: 1,
        description: 'Sets values',
        defaults: { name: 'Set' },
        inputs: ['main'],
        outputs: ['main'],
        properties: [
          {
            displayName: 'Keep Only Set',
            name: 'keepOnlySet',
            type: 'boolean',
            default: false,
          },
          {
            displayName: 'Values',
            name: 'values',
            type: 'collection',
            default: {},
          },
        ],
      },
    },
  ];
  
  await cache.warmUp(hotNodes);
}