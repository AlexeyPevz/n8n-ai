import type { OperationBatch } from "@n8n-ai/schemas";
import { generateOperationsFromPattern } from "./workflow-patterns.js";
import { patternMatcher } from "./pattern-matcher.js";

interface PlannerContext {
  prompt: string;
  availableNodes?: string[];
}

export class SimplePlanner {
  /**
   * Анализирует промпт и создает план операций
   */
  async plan(context: PlannerContext): Promise<OperationBatch> {
    const { prompt } = context;
    const promptLower = prompt.toLowerCase();
    
    // Используем улучшенный матчер паттернов
    const matchResults = patternMatcher.findMatchingPatterns(prompt);
    
    if (matchResults.length > 0) {
      const bestMatch = matchResults[0];
      console.log(`Found matching pattern: ${bestMatch.pattern.name} (score: ${bestMatch.score})`);
      console.log(`Matched keywords: ${bestMatch.matchedKeywords.join(', ')}`);
      
      const operations = generateOperationsFromPattern(bestMatch.pattern);
      
      // Добавляем аннотацию с информацией о паттерне
      operations.push({
        op: "annotate",
        name: bestMatch.pattern.nodes[0].name,
        text: `Generated from pattern: ${bestMatch.pattern.name} (confidence: ${Math.round(bestMatch.score * 10)}%)`
      });
      
      return {
        version: "v1",
        ops: operations
      };
    }
    
    // Если паттерн не найден, используем простую логику на ключевых словах
    const operations: OperationBatch["ops"] = [];
    
    // Определяем тип операции по ключевым словам
    if (promptLower.includes("http") || promptLower.includes("api") || promptLower.includes("fetch")) {
      // HTTP запрос
      const method = this.detectHttpMethod(promptLower);
      const url = this.extractUrl(prompt) || "https://api.example.com/data";
      
      operations.push({
        op: "add_node",
        node: {
          id: "http-1",
          name: "HTTP Request",
          type: "n8n-nodes-base.httpRequest",
          typeVersion: 4,
          position: [600, 300],
          parameters: {
            method,
            url,
            responseFormat: "json",
            options: {}
          }
        }
      });
      
      // Соединяем с триггером
      operations.push({
        op: "connect",
        from: "Manual Trigger",
        to: "HTTP Request",
        index: 0
      });
      
      // Добавляем аннотацию с объяснением
      operations.push({
        op: "annotate",
        name: "HTTP Request",
        text: `${method} запрос для получения данных`
      });
    }
    
    if (promptLower.includes("webhook")) {
      operations.push({
        op: "add_node",
        node: {
          id: "webhook-1",
          name: "Webhook",
          type: "n8n-nodes-base.webhook",
          typeVersion: 1,
          position: [250, 300],
          parameters: {
            httpMethod: "POST",
            path: "webhook-endpoint"
          }
        }
      });
    }
    
    if (promptLower.includes("schedule") || promptLower.includes("cron")) {
      const cronExpression = this.extractCron(promptLower) || "0 9 * * *";
      operations.push({
        op: "add_node",
        node: {
          id: "cron-1",
          name: "Schedule Trigger",
          type: "n8n-nodes-base.scheduleTrigger",
          typeVersion: 1,
          position: [250, 300],
          parameters: {
            rule: {
              cronExpression
            }
          }
        }
      });
    }
    
    // Если не распознали - создаем базовый HTTP workflow
    if (operations.length === 0) {
      operations.push({
        op: "add_node",
        node: {
          id: "http-default",
          name: "HTTP Request",
          type: "n8n-nodes-base.httpRequest",
          typeVersion: 4,
          position: [600, 300],
          parameters: {
            method: "GET",
            url: "https://jsonplaceholder.typicode.com/users"
          }
        }
      });
      
      operations.push({
        op: "connect",
        from: "Manual Trigger",
        to: "HTTP Request"
      });
      
      operations.push({
        op: "annotate",
        name: "HTTP Request",
        text: `Создан по запросу: "${prompt.slice(0, 50)}..."`
      });
    }
    
    return {
      version: "v1",
      ops: operations
    };
  }
  
  private detectHttpMethod(text: string): string {
    if (text.includes("post") || text.includes("create") || text.includes("send")) {
      return "POST";
    }
    if (text.includes("put") || text.includes("update")) {
      return "PUT";
    }
    if (text.includes("delete") || text.includes("remove")) {
      return "DELETE";
    }
    return "GET";
  }
  
  private extractUrl(text: string): string | null {
    // Простой regex для URL
    const urlMatch = text.match(/https?:\/\/[^\s]+/);
    return urlMatch ? urlMatch[0] : null;
  }
  
  private extractCron(text: string): string | null {
    // Простые паттерны для cron
    if (text.includes("every hour")) return "0 * * * *";
    if (text.includes("every day")) return "0 0 * * *";
    if (text.includes("every week")) return "0 0 * * 0";
    if (text.includes("every month")) return "0 0 1 * *";
    
    // Попытка найти cron expression
    const cronMatch = text.match(/[0-9*\s]+[0-9*\s]+[0-9*\s]+[0-9*\s]+[0-9*\s]/);
    return cronMatch ? cronMatch[0] : null;
  }
}