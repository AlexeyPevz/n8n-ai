import type { FastifyRequest, FastifyReply } from 'fastify';
import { PaginationHelper, type PaginationOptions } from './pagination-system.js';

export interface PaginatedRequest extends FastifyRequest {
  pagination: PaginationOptions;
}

/**
 * Fastify plugin for pagination
 */
export async function paginationPlugin(fastify: any, options: any) {
  // Add pagination to request
  fastify.decorateRequest('pagination', null);
  
  // Pre-handler to parse pagination params
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    
    const pagination: PaginationOptions = {
      page: query.page ? parseInt(query.page) : undefined,
      limit: query.limit ? parseInt(query.limit) : undefined,
      cursor: query.cursor,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder === 'asc' || query.sortOrder === 'desc' ? query.sortOrder : undefined,
      filter: query.filter ? tryParseJSON(query.filter) : undefined,
    };
    
    (request as PaginatedRequest).pagination = pagination;
  });
  
  // Add pagination helpers to reply
  fastify.decorateReply('paginate', function(
    this: FastifyReply,
    data: any[],
    total: number,
    options?: Partial<PaginationOptions>
  ) {
    const request = this.request as PaginatedRequest;
    const paginationOptions = { ...request.pagination, ...options };
    const baseUrl = `${request.protocol}://${request.hostname}${request.url.split('?')[0]}`;
    
    const response = PaginationHelper.createResponse(
      data,
      total,
      paginationOptions,
      baseUrl
    );
    
    // Set pagination headers
    this.header('X-Total-Count', total.toString());
    this.header('X-Page', response.meta.page.toString());
    this.header('X-Limit', response.meta.limit.toString());
    this.header('X-Total-Pages', response.meta.totalPages.toString());
    
    if (response.links?.next) {
      this.header('X-Next-Page', response.links.next);
    }
    if (response.links?.prev) {
      this.header('X-Prev-Page', response.links.prev);
    }
    
    return response;
  });
}

/**
 * Validate pagination parameters
 */
export function validatePagination(request: PaginatedRequest): {
  valid: boolean;
  errors?: string[];
} {
  const errors: string[] = [];
  const { page, limit, sortOrder } = request.pagination;
  
  if (page !== undefined && (page < 1 || !Number.isInteger(page))) {
    errors.push('Page must be a positive integer');
  }
  
  if (limit !== undefined) {
    if (limit < 1 || !Number.isInteger(limit)) {
      errors.push('Limit must be a positive integer');
    }
    if (limit > PaginationHelper.MAX_LIMIT) {
      errors.push(`Limit cannot exceed ${PaginationHelper.MAX_LIMIT}`);
    }
  }
  
  if (sortOrder !== undefined && sortOrder !== 'asc' && sortOrder !== 'desc') {
    errors.push('Sort order must be "asc" or "desc"');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Parse JSON safely
 */
function tryParseJSON(str: string): any {
  try {
    return JSON.parse(str);
  } catch {
    return undefined;
  }
}

/**
 * Create paginated route handler
 */
export function paginatedRoute<T>(
  handler: (request: PaginatedRequest, reply: FastifyReply) => Promise<{
    data: T[];
    total: number;
    options?: Partial<PaginationOptions>;
  }>
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const paginatedRequest = request as PaginatedRequest;
    
    // Validate pagination
    const validation = validatePagination(paginatedRequest);
    if (!validation.valid) {
      return reply.status(400).send({
        error: 'Invalid pagination parameters',
        details: validation.errors,
      });
    }
    
    try {
      const result = await handler(paginatedRequest, reply);
      return (reply as any).paginate(result.data, result.total, result.options);
    } catch (error) {
      throw error;
    }
  };
}

/**
 * Streaming response for very large datasets
 */
export async function streamLargeDataset<T>(
  reply: FastifyReply,
  dataGenerator: AsyncGenerator<T>,
  options?: {
    contentType?: string;
    separator?: string;
    transform?: (item: T) => string;
  }
) {
  const contentType = options?.contentType || 'application/x-ndjson';
  const separator = options?.separator || '\n';
  const transform = options?.transform || JSON.stringify;
  
  reply.type(contentType);
  reply.raw.writeHead(200, {
    'Content-Type': contentType,
    'Transfer-Encoding': 'chunked',
    'Cache-Control': 'no-cache',
  });
  
  let count = 0;
  
  try {
    for await (const item of dataGenerator) {
      const line = transform(item) + separator;
      reply.raw.write(line);
      count++;
      
      // Flush periodically
      if (count % 100 === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
  } finally {
    reply.raw.end();
  }
}

/**
 * Cursor-based pagination helper
 */
export class CursorPaginator<T> {
  constructor(
    private getCursor: (item: T) => string,
    private compareCursor: (a: string, b: string) => number
  ) {}
  
  /**
   * Get page of items after cursor
   */
  getPage(
    items: T[],
    cursor?: string,
    limit: number = PaginationHelper.DEFAULT_LIMIT
  ): {
    items: T[];
    nextCursor?: string;
    prevCursor?: string;
  } {
    let startIndex = 0;
    
    if (cursor) {
      startIndex = items.findIndex(item => 
        this.compareCursor(this.getCursor(item), cursor) > 0
      );
      
      if (startIndex === -1) {
        return { items: [] };
      }
    }
    
    const pageItems = items.slice(startIndex, startIndex + limit);
    
    const result: {
      items: T[];
      nextCursor?: string;
      prevCursor?: string;
    } = { items: pageItems };
    
    // Set next cursor
    if (startIndex + limit < items.length) {
      result.nextCursor = this.getCursor(items[startIndex + limit - 1]);
    }
    
    // Set prev cursor
    if (startIndex > 0) {
      result.prevCursor = this.getCursor(items[Math.max(0, startIndex - limit)]);
    }
    
    return result;
  }
}

/**
 * Batch processor for large operations
 */
export class BatchProcessor<T, R> {
  constructor(
    private batchSize: number = 100,
    private processor: (batch: T[]) => Promise<R[]>
  ) {}
  
  /**
   * Process items in batches
   */
  async processAll(
    items: T[],
    options?: {
      onProgress?: (processed: number, total: number) => void;
      onBatchComplete?: (batchIndex: number, results: R[]) => void;
      concurrency?: number;
    }
  ): Promise<R[]> {
    const results: R[] = [];
    const total = items.length;
    const batches = Math.ceil(total / this.batchSize);
    const concurrency = options?.concurrency || 1;
    
    // Process batches with concurrency control
    const batchPromises: Promise<void>[] = [];
    let processed = 0;
    
    for (let i = 0; i < batches; i++) {
      const batchStart = i * this.batchSize;
      const batchEnd = Math.min(batchStart + this.batchSize, total);
      const batch = items.slice(batchStart, batchEnd);
      
      const batchPromise = (async () => {
        const batchResults = await this.processor(batch);
        results.push(...batchResults);
        
        processed += batch.length;
        options?.onProgress?.(processed, total);
        options?.onBatchComplete?.(i, batchResults);
      })();
      
      batchPromises.push(batchPromise);
      
      // Control concurrency
      if (batchPromises.length >= concurrency) {
        await Promise.race(batchPromises);
        batchPromises.splice(
          batchPromises.findIndex(p => p instanceof Promise && (p as any).isFulfilled),
          1
        );
      }
    }
    
    // Wait for remaining batches
    await Promise.all(batchPromises);
    
    return results;
  }
}