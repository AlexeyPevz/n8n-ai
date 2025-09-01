import type { OperationBatch, Node } from '@n8n-ai/schemas';
import { PaginationHelper, ArrayPaginator, type PaginationOptions, type PaginatedResponse } from './pagination-system.js';

export interface WorkflowNode extends Node {
  createdAt?: Date;
  updatedAt?: Date;
  executionTime?: number;
  errorCount?: number;
}

export interface WorkflowConnection {
  from: string;
  to: string;
  fromIndex?: number;
  toIndex?: number;
}

export interface WorkflowData {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  createdAt: Date;
  updatedAt: Date;
  nodeCount: number;
  connectionCount: number;
  tags?: string[];
  isActive?: boolean;
}

export interface OperationBatchWithMeta extends OperationBatch {
  id: string;
  workflowId: string;
  userId?: string;
  timestamp: Date;
  executionTime?: number;
  affectedNodes?: string[];
}

/**
 * Paginator for workflow nodes
 */
export class WorkflowNodePaginator {
  private paginator: ArrayPaginator<WorkflowNode>;

  constructor(private nodes: WorkflowNode[]) {
    this.paginator = new ArrayPaginator(
      nodes,
      (node) => node.id,
      (node) => node.createdAt || new Date()
    );
  }

  /**
   * Get paginated nodes
   */
  getNodes(options: PaginationOptions): PaginatedResponse<WorkflowNode> {
    return this.paginator.paginate(options);
  }

  /**
   * Get nodes by type with pagination
   */
  getNodesByType(nodeType: string, options: PaginationOptions): PaginatedResponse<WorkflowNode> {
    const filtered = this.nodes.filter(node => node.type === nodeType);
    const paginator = new ArrayPaginator(
      filtered,
      (node) => node.id,
      (node) => node.createdAt || new Date()
    );
    return paginator.paginate(options);
  }

  /**
   * Get nodes with errors
   */
  getNodesWithErrors(options: PaginationOptions): PaginatedResponse<WorkflowNode> {
    const filtered = this.nodes.filter(node => node.errorCount && node.errorCount > 0);
    const paginator = new ArrayPaginator(
      filtered,
      (node) => node.id,
      (node) => node.errorCount || 0
    );
    return paginator.paginate({
      ...options,
      sortBy: options.sortBy || 'errorCount',
      sortOrder: options.sortOrder || 'desc',
    });
  }

  /**
   * Get slow nodes (execution time above threshold)
   */
  getSlowNodes(thresholdMs: number, options: PaginationOptions): PaginatedResponse<WorkflowNode> {
    const filtered = this.nodes.filter(
      node => node.executionTime && node.executionTime > thresholdMs
    );
    const paginator = new ArrayPaginator(
      filtered,
      (node) => node.id,
      (node) => node.executionTime || 0
    );
    return paginator.paginate({
      ...options,
      sortBy: options.sortBy || 'executionTime',
      sortOrder: options.sortOrder || 'desc',
    });
  }
}

/**
 * Paginator for workflow connections
 */
export class WorkflowConnectionPaginator {
  private paginator: ArrayPaginator<WorkflowConnection>;

  constructor(private connections: WorkflowConnection[]) {
    this.paginator = new ArrayPaginator(
      connections,
      (conn) => `${conn.from}-${conn.to}`,
      (conn) => conn.from
    );
  }

  /**
   * Get paginated connections
   */
  getConnections(options: PaginationOptions): PaginatedResponse<WorkflowConnection> {
    return this.paginator.paginate(options);
  }

  /**
   * Get connections for a specific node
   */
  getNodeConnections(nodeId: string, options: PaginationOptions): PaginatedResponse<WorkflowConnection> {
    const filtered = this.connections.filter(
      conn => conn.from === nodeId || conn.to === nodeId
    );
    const paginator = new ArrayPaginator(
      filtered,
      (conn) => `${conn.from}-${conn.to}`,
      (conn) => conn.from
    );
    return paginator.paginate(options);
  }
}

/**
 * Paginator for operation batches
 */
export class OperationBatchPaginator {
  private paginator: ArrayPaginator<OperationBatchWithMeta>;

  constructor(private batches: OperationBatchWithMeta[]) {
    this.paginator = new ArrayPaginator(
      batches,
      (batch) => batch.id,
      (batch) => batch.timestamp
    );
  }

  /**
   * Get paginated operation batches
   */
  getBatches(options: PaginationOptions): PaginatedResponse<OperationBatchWithMeta> {
    return this.paginator.paginate(options);
  }

  /**
   * Get batches for a specific workflow
   */
  getWorkflowBatches(
    workflowId: string,
    options: PaginationOptions
  ): PaginatedResponse<OperationBatchWithMeta> {
    const filtered = this.batches.filter(batch => batch.workflowId === workflowId);
    const paginator = new ArrayPaginator(
      filtered,
      (batch) => batch.id,
      (batch) => batch.timestamp
    );
    return paginator.paginate(options);
  }

  /**
   * Get batches by user
   */
  getUserBatches(
    userId: string,
    options: PaginationOptions
  ): PaginatedResponse<OperationBatchWithMeta> {
    const filtered = this.batches.filter(batch => batch.userId === userId);
    const paginator = new ArrayPaginator(
      filtered,
      (batch) => batch.id,
      (batch) => batch.timestamp
    );
    return paginator.paginate(options);
  }
}

/**
 * Manager for large workflow operations
 */
export class LargeWorkflowManager {
  private readonly CHUNK_SIZE = 50;
  private readonly MAX_NODES_IN_MEMORY = 1000;

  /**
   * Process large workflow in chunks
   */
  async processLargeWorkflow<T>(
    workflowId: string,
    nodeCount: number,
    processor: (nodes: WorkflowNode[], chunkIndex: number) => Promise<T>
  ): Promise<T[]> {
    const results: T[] = [];
    const totalChunks = Math.ceil(nodeCount / this.CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const chunk = await this.loadWorkflowChunk(workflowId, i);
      const result = await processor(chunk, i);
      results.push(result);
      
      // Allow garbage collection between chunks
      if (i % 10 === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    return results;
  }

  /**
   * Stream workflow nodes
   */
  async *streamWorkflowNodes(
    workflowId: string,
    options?: {
      filter?: (node: WorkflowNode) => boolean;
      transform?: (node: WorkflowNode) => any;
    }
  ): AsyncGenerator<WorkflowNode | any> {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const chunk = await this.loadWorkflowPage(workflowId, page, this.CHUNK_SIZE);
      
      for (const node of chunk.nodes) {
        if (!options?.filter || options.filter(node)) {
          yield options?.transform ? options.transform(node) : node;
        }
      }

      hasMore = chunk.hasMore;
      page++;
    }
  }

  /**
   * Batch operations for large workflows
   */
  async applyBatchOperations(
    workflowId: string,
    operations: OperationBatch,
    options?: {
      chunkSize?: number;
      validateChunk?: boolean;
      onProgress?: (progress: number) => void;
    }
  ): Promise<{
    successful: number;
    failed: number;
    errors: Array<{ operation: any; error: string }>;
  }> {
    const chunkSize = options?.chunkSize || this.CHUNK_SIZE;
    const totalOps = operations.ops.length;
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as Array<{ operation: any; error: string }>,
    };

    for (let i = 0; i < totalOps; i += chunkSize) {
      const chunk = operations.ops.slice(i, i + chunkSize);
      
      try {
        if (options?.validateChunk) {
          await this.validateOperationChunk(chunk);
        }
        
        await this.applyOperationChunk(workflowId, chunk);
        results.successful += chunk.length;
      } catch (error) {
        results.failed += chunk.length;
        chunk.forEach(op => {
          results.errors.push({
            operation: op,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });
      }

      if (options?.onProgress) {
        const progress = Math.min(100, ((i + chunk.length) / totalOps) * 100);
        options.onProgress(progress);
      }
    }

    return results;
  }

  /**
   * Memory-efficient workflow analysis
   */
  async analyzeWorkflow(
    workflowId: string,
    analyzers: Array<{
      name: string;
      analyze: (nodes: WorkflowNode[]) => any;
      reduce?: (results: any[]) => any;
    }>
  ): Promise<Record<string, any>> {
    const results: Record<string, any[]> = {};
    
    // Initialize result arrays
    analyzers.forEach(analyzer => {
      results[analyzer.name] = [];
    });

    // Process in chunks
    await this.processLargeWorkflow(workflowId, await this.getNodeCount(workflowId), 
      async (nodes) => {
        for (const analyzer of analyzers) {
          const result = await analyzer.analyze(nodes);
          results[analyzer.name].push(result);
        }
      }
    );

    // Reduce results
    const finalResults: Record<string, any> = {};
    for (const analyzer of analyzers) {
      if (analyzer.reduce) {
        finalResults[analyzer.name] = analyzer.reduce(results[analyzer.name]);
      } else {
        finalResults[analyzer.name] = results[analyzer.name];
      }
    }

    return finalResults;
  }

  // Mock implementations - in real system these would connect to database
  private async loadWorkflowChunk(workflowId: string, chunkIndex: number): Promise<WorkflowNode[]> {
    // Simulate loading from database
    await new Promise(resolve => setTimeout(resolve, 10));
    return [];
  }

  private async loadWorkflowPage(
    workflowId: string,
    page: number,
    limit: number
  ): Promise<{ nodes: WorkflowNode[]; hasMore: boolean }> {
    // Simulate loading from database
    await new Promise(resolve => setTimeout(resolve, 10));
    return { nodes: [], hasMore: false };
  }

  private async validateOperationChunk(operations: any[]): Promise<void> {
    // Simulate validation
    await new Promise(resolve => setTimeout(resolve, 5));
  }

  private async applyOperationChunk(workflowId: string, operations: any[]): Promise<void> {
    // Simulate applying operations
    await new Promise(resolve => setTimeout(resolve, 20));
  }

  private async getNodeCount(workflowId: string): Promise<number> {
    // Simulate getting count from database
    return 100;
  }
}