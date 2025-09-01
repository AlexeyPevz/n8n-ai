import { z } from 'zod';

// Context relevance scores
interface ContextChunk {
  content: string;
  source: string;
  relevanceScore: number;
  tokenCount: number;
  metadata?: Record<string, any>;
}

// Trimming strategies
export type TrimmingStrategy = 'relevance' | 'diversity' | 'recency' | 'balanced';

export interface TrimmingOptions {
  maxTokens: number;
  strategy: TrimmingStrategy;
  minRelevanceScore?: number;
  preserveStructure?: boolean;
  diversityWeight?: number;
}

export class RAGContextTrimmer {
  constructor(
    private tokenizer: (text: string) => number = this.defaultTokenCounter
  ) {}
  
  /**
   * Trim context to fit within token limit
   */
  trimContext(
    chunks: ContextChunk[],
    options: TrimmingOptions
  ): ContextChunk[] {
    // Filter by minimum relevance if specified
    let filtered = chunks;
    if (options.minRelevanceScore !== undefined) {
      filtered = chunks.filter(c => c.relevanceScore >= options.minRelevanceScore!);
    }
    
    // Apply trimming strategy
    switch (options.strategy) {
      case 'relevance':
        return this.trimByRelevance(filtered, options.maxTokens);
        
      case 'diversity':
        return this.trimByDiversity(filtered, options.maxTokens, options.diversityWeight || 0.3);
        
      case 'recency':
        return this.trimByRecency(filtered, options.maxTokens);
        
      case 'balanced':
        return this.trimBalanced(filtered, options.maxTokens);
        
      default:
        return this.trimByRelevance(filtered, options.maxTokens);
    }
  }
  
  /**
   * Analyze context usage and suggest optimizations
   */
  analyzeContext(chunks: ContextChunk[]): {
    totalTokens: number;
    avgRelevance: number;
    redundancy: number;
    suggestions: string[];
  } {
    const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);
    const avgRelevance = chunks.reduce((sum, c) => sum + c.relevanceScore, 0) / chunks.length;
    const redundancy = this.calculateRedundancy(chunks);
    
    const suggestions: string[] = [];
    
    if (avgRelevance < 0.5) {
      suggestions.push('Consider improving search query for better relevance');
    }
    
    if (redundancy > 0.3) {
      suggestions.push('High redundancy detected - consider deduplication');
    }
    
    if (totalTokens > 4000) {
      suggestions.push('Context is large - consider more aggressive trimming');
    }
    
    const sourceCounts = this.countSources(chunks);
    if (Object.keys(sourceCounts).length === 1) {
      suggestions.push('All context from single source - consider diversifying');
    }
    
    return {
      totalTokens,
      avgRelevance,
      redundancy,
      suggestions,
    };
  }
  
  /**
   * Smart chunking of large documents
   */
  smartChunk(
    text: string,
    maxChunkTokens: number = 500,
    overlap: number = 50
  ): string[] {
    const sentences = this.splitIntoSentences(text);
    const chunks: string[] = [];
    let currentChunk = '';
    let currentTokens = 0;
    
    for (const sentence of sentences) {
      const sentenceTokens = this.tokenizer(sentence);
      
      if (currentTokens + sentenceTokens > maxChunkTokens && currentChunk) {
        chunks.push(currentChunk.trim());
        
        // Add overlap
        const overlapSentences = currentChunk.split('. ').slice(-2).join('. ');
        currentChunk = overlapSentences + ' ' + sentence;
        currentTokens = this.tokenizer(currentChunk);
      } else {
        currentChunk += ' ' + sentence;
        currentTokens += sentenceTokens;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }
  
  // Trimming strategies implementation
  
  private trimByRelevance(chunks: ContextChunk[], maxTokens: number): ContextChunk[] {
    // Sort by relevance score descending
    const sorted = [...chunks].sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    const result: ContextChunk[] = [];
    let totalTokens = 0;
    
    for (const chunk of sorted) {
      if (totalTokens + chunk.tokenCount <= maxTokens) {
        result.push(chunk);
        totalTokens += chunk.tokenCount;
      } else {
        // Try to fit partial chunk
        const remainingTokens = maxTokens - totalTokens;
        if (remainingTokens > 50) {
          const trimmed = this.trimChunk(chunk, remainingTokens);
          if (trimmed) {
            result.push(trimmed);
          }
        }
        break;
      }
    }
    
    return result;
  }
  
  private trimByDiversity(
    chunks: ContextChunk[],
    maxTokens: number,
    diversityWeight: number
  ): ContextChunk[] {
    const result: ContextChunk[] = [];
    let totalTokens = 0;
    const usedSources = new Set<string>();
    
    // Score chunks by relevance + diversity bonus
    const scoredChunks = chunks.map(chunk => {
      const diversityBonus = usedSources.has(chunk.source) ? 0 : diversityWeight;
      return {
        chunk,
        score: chunk.relevanceScore + diversityBonus,
      };
    });
    
    // Sort by combined score
    scoredChunks.sort((a, b) => b.score - a.score);
    
    for (const { chunk } of scoredChunks) {
      if (totalTokens + chunk.tokenCount <= maxTokens) {
        result.push(chunk);
        totalTokens += chunk.tokenCount;
        usedSources.add(chunk.source);
      }
    }
    
    return result;
  }
  
  private trimByRecency(chunks: ContextChunk[], maxTokens: number): ContextChunk[] {
    // Assume chunks are ordered by recency (newest first)
    const result: ContextChunk[] = [];
    let totalTokens = 0;
    
    for (const chunk of chunks) {
      if (totalTokens + chunk.tokenCount <= maxTokens) {
        result.push(chunk);
        totalTokens += chunk.tokenCount;
      } else {
        break;
      }
    }
    
    return result;
  }
  
  private trimBalanced(chunks: ContextChunk[], maxTokens: number): ContextChunk[] {
    // Balanced approach: high relevance + some diversity + structure preservation
    const sourceGroups = this.groupBySource(chunks);
    const result: ContextChunk[] = [];
    let totalTokens = 0;
    
    // First pass: take top chunk from each source
    for (const [source, sourceChunks] of sourceGroups) {
      const topChunk = sourceChunks
        .sort((a, b) => b.relevanceScore - a.relevanceScore)[0];
      
      if (topChunk && totalTokens + topChunk.tokenCount <= maxTokens) {
        result.push(topChunk);
        totalTokens += topChunk.tokenCount;
      }
    }
    
    // Second pass: fill remaining space with highest relevance
    const remaining = chunks
      .filter(c => !result.includes(c))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    for (const chunk of remaining) {
      if (totalTokens + chunk.tokenCount <= maxTokens) {
        result.push(chunk);
        totalTokens += chunk.tokenCount;
      }
    }
    
    return result;
  }
  
  // Helper methods
  
  private trimChunk(chunk: ContextChunk, maxTokens: number): ContextChunk | null {
    const sentences = this.splitIntoSentences(chunk.content);
    let trimmedContent = '';
    let currentTokens = 0;
    
    for (const sentence of sentences) {
      const sentenceTokens = this.tokenizer(sentence);
      if (currentTokens + sentenceTokens <= maxTokens) {
        trimmedContent += sentence + ' ';
        currentTokens += sentenceTokens;
      } else {
        break;
      }
    }
    
    if (!trimmedContent.trim()) return null;
    
    return {
      ...chunk,
      content: trimmedContent.trim() + '...',
      tokenCount: currentTokens,
    };
  }
  
  private calculateRedundancy(chunks: ContextChunk[]): number {
    if (chunks.length < 2) return 0;
    
    let totalSimilarity = 0;
    let comparisons = 0;
    
    // Simple approach: check for duplicate sentences
    const allSentences = new Set<string>();
    let duplicates = 0;
    
    for (const chunk of chunks) {
      const sentences = this.splitIntoSentences(chunk.content);
      for (const sentence of sentences) {
        const normalized = sentence.toLowerCase().trim();
        if (allSentences.has(normalized)) {
          duplicates++;
        } else {
          allSentences.add(normalized);
        }
      }
    }
    
    return duplicates / allSentences.size;
  }
  
  private countSources(chunks: ContextChunk[]): Record<string, number> {
    const counts: Record<string, number> = {};
    
    for (const chunk of chunks) {
      counts[chunk.source] = (counts[chunk.source] || 0) + 1;
    }
    
    return counts;
  }
  
  private groupBySource(chunks: ContextChunk[]): Map<string, ContextChunk[]> {
    const groups = new Map<string, ContextChunk[]>();
    
    for (const chunk of chunks) {
      if (!groups.has(chunk.source)) {
        groups.set(chunk.source, []);
      }
      groups.get(chunk.source)!.push(chunk);
    }
    
    return groups;
  }
  
  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitter - could be improved
    return text.match(/[^.!?]+[.!?]+/g) || [text];
  }
  
  private defaultTokenCounter(text: string): number {
    // Simple approximation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}

// Factory function
export function createContextTrimmer(
  tokenizer?: (text: string) => number
): RAGContextTrimmer {
  return new RAGContextTrimmer(tokenizer);
}