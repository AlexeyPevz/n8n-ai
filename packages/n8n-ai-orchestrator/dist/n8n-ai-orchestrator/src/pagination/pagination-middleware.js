import { PaginationHelper } from './pagination-system.js';
/**
 * Fastify plugin for pagination
 */
export async function paginationPlugin(fastify, options) {
    // Add pagination to request
    fastify.decorateRequest('pagination', null);
    // Pre-handler to parse pagination params
    fastify.addHook('preHandler', async (request, reply) => {
        const query = request.query;
        const pagination = {
            page: query.page ? parseInt(query.page) : undefined,
            limit: query.limit ? parseInt(query.limit) : undefined,
            cursor: query.cursor,
            sortBy: query.sortBy,
            sortOrder: query.sortOrder === 'asc' || query.sortOrder === 'desc' ? query.sortOrder : undefined,
            filter: query.filter ? tryParseJSON(query.filter) : undefined,
        };
        request.pagination = pagination;
    });
    // Add pagination helpers to reply
    fastify.decorateReply('paginate', function (data, total, options) {
        const request = this.request;
        const paginationOptions = { ...request.pagination, ...options };
        const baseUrl = `${request.protocol}://${request.hostname}${request.url.split('?')[0]}`;
        const response = PaginationHelper.createResponse(data, total, paginationOptions, baseUrl);
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
export function validatePagination(request) {
    const errors = [];
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
function tryParseJSON(str) {
    try {
        return JSON.parse(str);
    }
    catch {
        return undefined;
    }
}
/**
 * Create paginated route handler
 */
export function paginatedRoute(handler) {
    return async (request, reply) => {
        const paginatedRequest = request;
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
            return reply.paginate(result.data, result.total, result.options);
        }
        catch (error) {
            throw error;
        }
    };
}
/**
 * Streaming response for very large datasets
 */
export async function streamLargeDataset(reply, dataGenerator, options) {
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
    }
    finally {
        reply.raw.end();
    }
}
/**
 * Cursor-based pagination helper
 */
export class CursorPaginator {
    getCursor;
    compareCursor;
    constructor(getCursor, compareCursor) {
        this.getCursor = getCursor;
        this.compareCursor = compareCursor;
    }
    /**
     * Get page of items after cursor
     */
    getPage(items, cursor, limit = PaginationHelper.DEFAULT_LIMIT) {
        let startIndex = 0;
        if (cursor) {
            startIndex = items.findIndex(item => this.compareCursor(this.getCursor(item), cursor) > 0);
            if (startIndex === -1) {
                return { items: [] };
            }
        }
        const pageItems = items.slice(startIndex, startIndex + limit);
        const result = { items: pageItems };
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
export class BatchProcessor {
    batchSize;
    processor;
    constructor(batchSize = 100, processor) {
        this.batchSize = batchSize;
        this.processor = processor;
    }
    /**
     * Process items in batches
     */
    async processAll(items, options) {
        const results = [];
        const total = items.length;
        const batches = Math.ceil(total / this.batchSize);
        const concurrency = options?.concurrency || 1;
        // Process batches with concurrency control
        const batchPromises = [];
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
                batchPromises.splice(batchPromises.findIndex(p => p instanceof Promise && p.isFulfilled), 1);
            }
        }
        // Wait for remaining batches
        await Promise.all(batchPromises);
        return results;
    }
}
