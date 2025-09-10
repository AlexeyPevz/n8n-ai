import { describe, it, expect } from 'vitest';
import { 
  PaginationHelper, 
  ArrayPaginator,
  type PaginationOptions,
  type CursorInfo 
} from './pagination-system.js';

describe('PaginationHelper', () => {
  describe('normalizeOptions', () => {
    it('should use default values when options are empty', () => {
      const result = PaginationHelper.normalizeOptions({});
      
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.sortBy).toBe('createdAt');
      expect(result.sortOrder).toBe('desc');
    });

    it('should clamp page to minimum 1', () => {
      const result = PaginationHelper.normalizeOptions({ page: -5 });
      expect(result.page).toBe(1);
    });

    it('should clamp limit to maximum', () => {
      const result = PaginationHelper.normalizeOptions({ limit: 200 });
      expect(result.limit).toBe(100);
    });

    it('should preserve valid options', () => {
      const result = PaginationHelper.normalizeOptions({
        page: 5,
        limit: 50,
        sortBy: 'name',
        sortOrder: 'asc',
      });
      
      expect(result.page).toBe(5);
      expect(result.limit).toBe(50);
      expect(result.sortBy).toBe('name');
      expect(result.sortOrder).toBe('asc');
    });
  });

  describe('calculateOffset', () => {
    it('should calculate correct offset', () => {
      expect(PaginationHelper.calculateOffset(1, 20)).toBe(0);
      expect(PaginationHelper.calculateOffset(2, 20)).toBe(20);
      expect(PaginationHelper.calculateOffset(5, 10)).toBe(40);
    });
  });

  describe('createMeta', () => {
    it('should create correct metadata', () => {
      const meta = PaginationHelper.createMeta({
        page: 2,
        limit: 20,
        total: 100,
        currentCount: 20,
      });
      
      expect(meta.page).toBe(2);
      expect(meta.limit).toBe(20);
      expect(meta.total).toBe(100);
      expect(meta.totalPages).toBe(5);
      expect(meta.hasNext).toBe(true);
      expect(meta.hasPrev).toBe(true);
    });

    it('should handle edge cases', () => {
      const meta = PaginationHelper.createMeta({
        page: 1,
        limit: 20,
        total: 10,
        currentCount: 10,
      });
      
      expect(meta.totalPages).toBe(1);
      expect(meta.hasNext).toBe(false);
      expect(meta.hasPrev).toBe(false);
    });
  });

  describe('cursor encoding/decoding', () => {
    it('should encode and decode cursor correctly', () => {
      const info: CursorInfo = {
        id: 'test-123',
        timestamp: Date.now(),
        sortValue: 'value',
      };
      
      const encoded = PaginationHelper.encodeCursor(info);
      const decoded = PaginationHelper.decodeCursor(encoded);
      
      expect(decoded).toEqual(info);
    });

    it('should return null for invalid cursor', () => {
      const decoded = PaginationHelper.decodeCursor('invalid-cursor');
      expect(decoded).toBeNull();
    });
  });

  describe('createLinks', () => {
    it('should create correct HATEOAS links', () => {
      const meta = {
        page: 3,
        limit: 20,
        total: 100,
        totalPages: 5,
        hasNext: true,
        hasPrev: true,
      };
      
      const links = PaginationHelper.createLinks('/api/items', meta, { limit: 20 });
      
      expect(links?.self).toContain('page=3');
      expect(links?.first).toContain('page=1');
      expect(links?.last).toContain('page=5');
      expect(links?.next).toContain('page=4');
      expect(links?.prev).toContain('page=2');
    });
  });
});

describe('ArrayPaginator', () => {
  const testItems = Array.from({ length: 100 }, (_, i) => ({
    id: `item-${i}`,
    name: `Item ${i}`,
    value: i,
    category: i % 3 === 0 ? 'A' : i % 3 === 1 ? 'B' : 'C',
    createdAt: new Date(Date.now() - i * 1000),
  }));

  const paginator = new ArrayPaginator(
    testItems,
    (item) => item.id,
    (item) => item.value
  );

  describe('basic pagination', () => {
    it('should paginate with default options', () => {
      const result = paginator.paginate({});
      
      expect(result.data.length).toBe(20);
      expect(result.meta.total).toBe(100);
      expect(result.meta.totalPages).toBe(5);
    });

    it('should handle different page sizes', () => {
      const result = paginator.paginate({ limit: 10 });
      
      expect(result.data.length).toBe(10);
      expect(result.meta.totalPages).toBe(10);
    });

    it('should handle last page correctly', () => {
      const result = paginator.paginate({ page: 5, limit: 30 });
      
      expect(result.data.length).toBe(10); // Last 10 items
      expect(result.meta.hasNext).toBe(false);
    });
  });

  describe('sorting', () => {
    it('should sort ascending', () => {
      const result = paginator.paginate({ sortBy: 'value', sortOrder: 'asc' });
      
      expect(result.data[0].value).toBe(0);
      expect(result.data[1].value).toBe(1);
    });

    it('should sort descending', () => {
      const result = paginator.paginate({ sortBy: 'value', sortOrder: 'desc' });
      
      expect(result.data[0].value).toBe(99);
      expect(result.data[1].value).toBe(98);
    });
  });

  describe('filtering', () => {
    it('should filter by exact match', () => {
      const result = paginator.paginate({ filter: { category: 'A' } });
      
      expect(result.data.every(item => item.category === 'A')).toBe(true);
      expect(result.meta.total).toBe(34); // Items divisible by 3
    });

    it('should filter with operators', () => {
      const result = paginator.paginate({ 
        filter: { value: { $gt: 50 } } 
      });
      
      expect(result.data.every(item => item.value > 50)).toBe(true);
    });

    it('should filter with multiple conditions', () => {
      const result = paginator.paginate({ 
        filter: { 
          category: 'A',
          value: { $lt: 30 } 
        } 
      });
      
      expect(result.data.every(item => 
        item.category === 'A' && item.value < 30
      )).toBe(true);
    });

    it('should filter with $in operator', () => {
      const result = paginator.paginate({ 
        filter: { category: { $in: ['A', 'B'] } } 
      });
      
      expect(result.data.every(item => 
        item.category === 'A' || item.category === 'B'
      )).toBe(true);
    });

    it('should filter with regex', () => {
      const result = paginator.paginate({ 
        filter: { name: { $regex: 'Item [0-5]$' } } 
      });
      
      expect(result.data.length).toBe(6); // Item 0-5
    });
  });

  describe('cursor pagination', () => {
    it('should paginate with cursor', () => {
      // Get first page
      const firstPage = paginator.paginate({ limit: 10 });
      expect(firstPage.data.length).toBe(10);
      expect(firstPage.meta.nextCursor).toBeDefined();
      
      // Get next page using cursor
      const secondPage = paginator.paginate({ 
        cursor: firstPage.meta.nextCursor,
        limit: 10 
      });
      
      expect(secondPage.data.length).toBe(10);
      expect(secondPage.data[0].id).not.toBe(firstPage.data[0].id);
    });

    it('should handle invalid cursor', () => {
      const result = paginator.paginate({ 
        cursor: 'invalid-cursor',
        limit: 10 
      });
      
      // Should fallback to first page
      expect(result.data.length).toBe(10);
      expect(result.data[0].id).toBe('item-0');
    });
  });

  describe('combined operations', () => {
    it('should filter, sort, and paginate', () => {
      const result = paginator.paginate({
        filter: { category: 'A' },
        sortBy: 'value',
        sortOrder: 'desc',
        page: 2,
        limit: 5,
      });
      
      expect(result.data.length).toBe(5);
      expect(result.data.every(item => item.category === 'A')).toBe(true);
      expect(result.data[0].value).toBeGreaterThan(result.data[1].value);
    });
  });
});