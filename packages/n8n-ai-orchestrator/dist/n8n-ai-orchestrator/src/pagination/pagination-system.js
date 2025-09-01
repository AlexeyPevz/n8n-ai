export class PaginationHelper {
    static DEFAULT_LIMIT = 20;
    static MAX_LIMIT = 100;
    /**
     * Validate and normalize pagination options
     */
    static normalizeOptions(options) {
        const page = Math.max(1, options.page || 1);
        const limit = Math.min(this.MAX_LIMIT, Math.max(1, options.limit || this.DEFAULT_LIMIT));
        const sortBy = options.sortBy || 'createdAt';
        const sortOrder = options.sortOrder || 'desc';
        return {
            page,
            limit,
            cursor: options.cursor,
            sortBy,
            sortOrder,
            filter: options.filter,
        };
    }
    /**
     * Calculate offset for page-based pagination
     */
    static calculateOffset(page, limit) {
        return (page - 1) * limit;
    }
    /**
     * Create pagination metadata
     */
    static createMeta(options) {
        const totalPages = Math.ceil(options.total / options.limit);
        return {
            page: options.page,
            limit: options.limit,
            total: options.total,
            totalPages,
            hasNext: options.page < totalPages || !!options.nextCursor,
            hasPrev: options.page > 1 || !!options.prevCursor,
            nextCursor: options.nextCursor,
            prevCursor: options.prevCursor,
        };
    }
    /**
     * Create links for HATEOAS
     */
    static createLinks(baseUrl, meta, options) {
        const params = new URLSearchParams();
        if (options.limit && options.limit !== this.DEFAULT_LIMIT) {
            params.set('limit', options.limit.toString());
        }
        if (options.sortBy) {
            params.set('sortBy', options.sortBy);
        }
        if (options.sortOrder && options.sortOrder !== 'desc') {
            params.set('sortOrder', options.sortOrder);
        }
        if (options.filter) {
            params.set('filter', JSON.stringify(options.filter));
        }
        const buildUrl = (page, cursor) => {
            const urlParams = new URLSearchParams(params);
            if (page)
                urlParams.set('page', page.toString());
            if (cursor)
                urlParams.set('cursor', cursor);
            return `${baseUrl}?${urlParams.toString()}`;
        };
        const links = {
            self: buildUrl(meta.page),
        };
        if (meta.totalPages > 0) {
            links.first = buildUrl(1);
            links.last = buildUrl(meta.totalPages);
        }
        if (meta.hasNext) {
            links.next = meta.nextCursor
                ? buildUrl(undefined, meta.nextCursor)
                : buildUrl(meta.page + 1);
        }
        if (meta.hasPrev) {
            links.prev = meta.prevCursor
                ? buildUrl(undefined, meta.prevCursor)
                : buildUrl(meta.page - 1);
        }
        return links;
    }
    /**
     * Encode cursor
     */
    static encodeCursor(info) {
        return Buffer.from(JSON.stringify(info)).toString('base64url');
    }
    /**
     * Decode cursor
     */
    static decodeCursor(cursor) {
        try {
            const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
            return JSON.parse(decoded);
        }
        catch {
            return null;
        }
    }
    /**
     * Create paginated response
     */
    static createResponse(data, total, options, baseUrl, nextCursor, prevCursor) {
        const normalizedOptions = this.normalizeOptions(options);
        const meta = this.createMeta({
            page: normalizedOptions.page,
            limit: normalizedOptions.limit,
            total,
            currentCount: data.length,
            nextCursor,
            prevCursor,
        });
        const links = this.createLinks(baseUrl, meta, normalizedOptions);
        return {
            data,
            meta,
            links,
        };
    }
}
/**
 * In-memory paginator for arrays
 */
export class ArrayPaginator {
    items;
    getKey;
    getSortValue;
    constructor(items, getKey, getSortValue) {
        this.items = items;
        this.getKey = getKey;
        this.getSortValue = getSortValue;
    }
    paginate(options) {
        const normalized = PaginationHelper.normalizeOptions(options);
        // Apply filters
        let filtered = this.items;
        if (options.filter) {
            filtered = this.applyFilters(filtered, options.filter);
        }
        // Sort items
        const sorted = this.sortItems(filtered, normalized.sortBy, normalized.sortOrder);
        // Apply cursor-based pagination if cursor provided
        let paginated;
        let nextCursor;
        let prevCursor;
        if (options.cursor) {
            const result = this.applyCursorPagination(sorted, options.cursor, normalized.limit, normalized.sortOrder);
            paginated = result.items;
            nextCursor = result.nextCursor;
            prevCursor = result.prevCursor;
        }
        else {
            // Apply offset-based pagination
            const offset = PaginationHelper.calculateOffset(normalized.page, normalized.limit);
            paginated = sorted.slice(offset, offset + normalized.limit);
            // Generate cursors for next/prev if applicable
            if (offset + normalized.limit < sorted.length) {
                const nextItem = sorted[offset + normalized.limit];
                nextCursor = PaginationHelper.encodeCursor({
                    id: this.getKey(nextItem),
                    timestamp: Date.now(),
                    sortValue: this.getSortValue(nextItem),
                });
            }
            if (offset > 0) {
                const prevItem = sorted[Math.max(0, offset - 1)];
                prevCursor = PaginationHelper.encodeCursor({
                    id: this.getKey(prevItem),
                    timestamp: Date.now(),
                    sortValue: this.getSortValue(prevItem),
                });
            }
        }
        return PaginationHelper.createResponse(paginated, filtered.length, options, '', // baseUrl would be provided by the route handler
        nextCursor, prevCursor);
    }
    applyFilters(items, filters) {
        return items.filter(item => {
            for (const [key, value] of Object.entries(filters)) {
                const itemValue = item[key];
                // Handle different filter operators
                if (typeof value === 'object' && value !== null) {
                    if ('$in' in value && Array.isArray(value.$in)) {
                        if (!value.$in.includes(itemValue))
                            return false;
                    }
                    if ('$gt' in value && itemValue <= value.$gt)
                        return false;
                    if ('$gte' in value && itemValue < value.$gte)
                        return false;
                    if ('$lt' in value && itemValue >= value.$lt)
                        return false;
                    if ('$lte' in value && itemValue > value.$lte)
                        return false;
                    if ('$ne' in value && itemValue === value.$ne)
                        return false;
                    if ('$regex' in value && !new RegExp(value.$regex).test(itemValue))
                        return false;
                }
                else {
                    if (itemValue !== value)
                        return false;
                }
            }
            return true;
        });
    }
    sortItems(items, sortBy, sortOrder) {
        return [...items].sort((a, b) => {
            const aValue = a[sortBy];
            const bValue = b[sortBy];
            if (aValue === bValue)
                return 0;
            const result = aValue < bValue ? -1 : 1;
            return sortOrder === 'asc' ? result : -result;
        });
    }
    applyCursorPagination(items, cursor, limit, sortOrder) {
        const cursorInfo = PaginationHelper.decodeCursor(cursor);
        if (!cursorInfo) {
            return { items: items.slice(0, limit) };
        }
        // Find the cursor position
        const cursorIndex = items.findIndex(item => this.getKey(item) === cursorInfo.id);
        if (cursorIndex === -1) {
            // Cursor not found, return from beginning
            return { items: items.slice(0, limit) };
        }
        // Get items after cursor
        const startIndex = cursorIndex + 1;
        const endIndex = startIndex + limit;
        const pageItems = items.slice(startIndex, endIndex);
        // Generate next cursor
        let nextCursor;
        if (endIndex < items.length) {
            const nextItem = items[endIndex];
            nextCursor = PaginationHelper.encodeCursor({
                id: this.getKey(nextItem),
                timestamp: Date.now(),
                sortValue: this.getSortValue(nextItem),
            });
        }
        // Generate prev cursor
        let prevCursor;
        if (startIndex > 0) {
            const prevItem = items[Math.max(0, startIndex - limit - 1)];
            prevCursor = PaginationHelper.encodeCursor({
                id: this.getKey(prevItem),
                timestamp: Date.now(),
                sortValue: this.getSortValue(prevItem),
            });
        }
        return { items: pageItems, nextCursor, prevCursor };
    }
}
