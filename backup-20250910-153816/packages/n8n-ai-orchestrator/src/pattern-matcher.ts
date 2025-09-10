/**
 * Улучшенный матчер паттернов с поддержкой fuzzy matching
 */

import type { WorkflowPattern } from './workflow-patterns';
import { getAllPatterns } from './extended-patterns.js';

interface MatchResult {
  pattern: WorkflowPattern;
  score: number;
  matchedKeywords: string[];
}

export class PatternMatcher {
  private patterns: WorkflowPattern[];
  
  constructor() {
    this.patterns = getAllPatterns();
  }
  
  /**
   * Находит лучший паттерн для промпта
   */
  findBestPattern(prompt: string): WorkflowPattern | null {
    const results = this.findMatchingPatterns(prompt);
    return results.length > 0 ? results[0].pattern : null;
  }
  
  /**
   * Находит все подходящие паттерны с оценкой
   */
  findMatchingPatterns(prompt: string): MatchResult[] {
    const promptLower = prompt.toLowerCase();
    const promptWords = this.tokenize(promptLower);
    
    const results: MatchResult[] = [];
    
    for (const pattern of this.patterns) {
      const matchedKeywords: string[] = [];
      let score = 0;
      
      // Точные совпадения ключевых слов
      for (const keyword of pattern.keywords) {
        if (promptLower.includes(keyword)) {
          matchedKeywords.push(keyword);
          score += keyword.split(' ').length * 2; // Больше баллов за многословные ключи
        }
      }
      
      // Частичные совпадения слов
      for (const word of promptWords) {
        for (const keyword of pattern.keywords) {
          if (keyword.includes(word) && !matchedKeywords.includes(keyword)) {
            score += 0.5;
          }
        }
      }
      
      // Бонус за совпадение типов нод в промпте
      for (const node of pattern.nodes) {
        const nodeType = node.type.toLowerCase();
        if (promptLower.includes('slack') && nodeType.includes('slack')) score += 2;
        if (promptLower.includes('email') && nodeType.includes('email')) score += 2;
        if (promptLower.includes('database') && (nodeType.includes('postgres') || nodeType.includes('mysql'))) score += 2;
        if (promptLower.includes('sheet') && nodeType.includes('googlesheet')) score += 2;
        if (promptLower.includes('ai') && nodeType.includes('langchain')) score += 3;
      }
      
      if (score > 0) {
        results.push({
          pattern,
          score,
          matchedKeywords
        });
      }
    }
    
    // Сортируем по убыванию score
    return results.sort((a, b) => b.score - a.score);
  }
  
  /**
   * Предлагает паттерны по категории
   */
  suggestByCategory(category: string): WorkflowPattern[] {
    const categoryLower = category.toLowerCase();
    
    return this.patterns.filter(pattern => {
      const patternName = pattern.name.toLowerCase();
      return patternName.includes(categoryLower) ||
             pattern.keywords.some(k => k.includes(categoryLower));
    });
  }
  
  /**
   * Возвращает все категории паттернов
   */
  getCategories(): string[] {
    const categories = new Set<string>();
    
    this.patterns.forEach(pattern => {
      // Извлекаем категорию из имени паттерна
      const parts = pattern.name.split('-');
      if (parts.length > 1) {
        categories.add(parts[0]);
      }
      
      // Также добавляем основные ключевые слова как категории
      pattern.keywords.forEach(keyword => {
        if (keyword.length > 3 && !keyword.includes(' ')) {
          categories.add(keyword);
        }
      });
    });
    
    return Array.from(categories).sort();
  }
  
  private tokenize(text: string): string[] {
    return text
      .split(/\s+/)
      .filter(word => word.length > 2)
      .map(word => word.replace(/[^a-z0-9]/g, ''));
  }
}

// Экспортируем singleton
export const patternMatcher = new PatternMatcher();