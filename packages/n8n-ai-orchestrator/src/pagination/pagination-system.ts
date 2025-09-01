export interface PaginationOptions {
  page?: number;
  limit?: number;
  cursor?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filter?: Record<string, any>;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  nextCursor?: string;
  prevCursor?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
  links?: {
    self: string;
    first?: string;
    last?: string;
    next?: string;
    prev?: string;
  };
}

export interface CursorInfo {
  id: string;
  timestamp: number;
  sortValue?: any;
}

export class PaginationHelper {
  static readonly DEFAULT_LIMIT = 20;
  static readonly MAX_LIMIT = 100;

  /**
   * Validate and normalize pagination options
   */
  static normalizeOptions(options: PaginationOptions): Required<Omit<PaginationOptions, 'cursor' | 'filter'>> & { cursor?: string; filter?: Record<string, any> } {
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
  static calculateOffset(page: number, limit: number): number {
    return (page - 1) * limit;
  }

  /**
   * Create pagination metadata
   */
  static createMeta(options: {
    page: number;
    limit: number;
    total: number;
    currentCount: number;
    cursor?: string;
    nextCursor?: string;
    prevCursor?: string;
  }): PaginationMeta {
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
  static createLinks(baseUrl: string, meta: PaginationMeta, options: PaginationOptions): PaginatedResponse<any>['links'] {
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

    const buildUrl = (page?: number, cursor?: string) => {
      const urlParams = new URLSearchParams(params);
      if (page) urlParams.set('page', page.toString());
      if (cursor) urlParams.set('cursor', cursor);
      return `${baseUrl}?${urlParams.toString()}`;
    };

    const links: PaginatedResponse<any>['links'] = {
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
  static encodeCursor(info: CursorInfo): string {
    return Buffer.from(JSON.stringify(info)).toString('base64url');
  }

  /**
   * Decode cursor
   */
  static decodeCursor(cursor: string): CursorInfo | null {
    try {
      const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  /**
   * Create paginated response
   */
  static createResponse<T>(
    data: T[],
    total: number,
    options: PaginationOptions,
    baseUrl: string,
    nextCursor?: string,
    prevCursor?: string
  ): PaginatedResponse<T> {
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
export class ArrayPaginator<T> {
  constructor(
    private items: T[],
    private getKey: (item: T) => string,
    private getSortValue: (item: T) => any
  ) {}

  paginate(options: PaginationOptions): PaginatedResponse<T> {
    const normalized = PaginationHelper.normalizeOptions(options);
    
    // Apply filters
    let filtered = this.items;
    if (options.filter) {
      filtered = this.applyFilters(filtered, options.filter);
    }

    // Sort items
    const sorted = this.sortItems(filtered, normalized.sortBy, normalized.sortOrder);

    // Apply cursor-based pagination if cursor provided
    let paginated: T[];
    let nextCursor: string | undefined;
    let prevCursor: string | undefined;

    if (options.cursor) {
      const result = this.applyCursorPagination(sorted, options.cursor, normalized.limit, normalized.sortOrder);
      paginated = result.items;
      nextCursor = result.nextCursor;
      prevCursor = result.prevCursor;
    } else {
      // Apply offset-based pagination
      const offset = PaginationHelper.calculateOffset(normalized.page, normalized.limit);
      const end = Math.min(sorted.length, offset + normalized.limit);
      paginated = sorted.slice(offset, end);
      
      // Generate cursors for next/prev if applicable
      if (offset + normalized.limit < sorted.length) {
        const nextItem = sorted[offset + normalized.limit];
        if (nextItem !== undefined) {
          nextCursor = PaginationHelper.encodeCursor({
            id: this.getKey(nextItem),
            timestamp: Date.now(),
            sortValue: this.getSortValue(nextItem),
          });
        }
      }
      
      if (offset > 0) {
        const prevItem = sorted[Math.max(0, offset - 1)];
        if (prevItem !== undefined) {
          prevCursor = PaginationHelper.encodeCursor({
            id: this.getKey(prevItem),
            timestamp: Date.now(),
            sortValue: this.getSortValue(prevItem),
          });
        }
      }
    }

    return PaginationHelper.createResponse(
      paginated,
      filtered.length,
      options,
      '', // baseUrl would be provided by the route handler
      nextCursor,
      prevCursor
    );
  }

  private applyFilters(items: T[], filters: Record<string, any>): T[] {
    return items.filter(item => {
      for (const [key, value] of Object.entries(filters)) {
        const itemValue = (item as any)[key];
        
        // Handle different filter operators
        if (typeof value === 'object' && value !== null) {
          if ('$in' in value && Array.isArray(value.$in)) {
            if (!value.$in.includes(itemValue)) return false;
          }
          if ('$gt' in value && itemValue <= value.$gt) return false;
          if ('$gte' in value && itemValue < value.$gte) return false;
          if ('$lt' in value && itemValue >= value.$lt) return false;
          if ('$lte' in value && itemValue > value.$lte) return false;
          if ('$ne' in value && itemValue === value.$ne) return false;
          if ('$regex' in value && !new RegExp(value.$regex).test(itemValue)) return false;
        } else {
          if (itemValue !== value) return false;
        }
      }
      return true;
    });
  }

  private sortItems(items: T[], sortBy: string, sortOrder: 'asc' | 'desc'): T[] {
    return [...items].sort((a, b) => {
      const aValue = (a as any)[sortBy];
      const bValue = (b as any)[sortBy];
      
      if (aValue === bValue) return 0;
      
      const result = aValue < bValue ? -1 : 1;
      return sortOrder === 'asc' ? result : -result;
    });
  }

  private applyCursorPagination(
    items: T[],
    cursor: string,
    limit: number,
    sortOrder: 'asc' | 'desc'
  ): { items: T[]; nextCursor?: string; prevCursor?: string } {
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
    let nextCursor: string | undefined;
    if (endIndex < items.length) {
      const nextItem = items[endIndex];
      nextCursor = PaginationHelper.encodeCursor({
        id: this.getKey(nextItem),
        timestamp: Date.now(),
        sortValue: this.getSortValue(nextItem),
      });
    }

    // Generate prev cursor
    let prevCursor: string | undefined;
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