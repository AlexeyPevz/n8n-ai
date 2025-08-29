import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

interface WorkflowNode {
  id: string;
  name: string;
  type: string;
  typeVersion?: number;
  position: number[];
  parameters?: Record<string, any>;
}

interface Pattern {
  name: string;
  count: number;
  examples: string[];
  commonNodes: string[];
  commonSequences: string[][];
  typicalParameters: Record<string, any>;
}

class PatternExtractor {
  private patterns: Map<string, Pattern> = new Map();
  private nodeSequences: Map<string, number> = new Map();
  private nodeParameters: Map<string, any[]> = new Map();

  analyzeWorkflow(filename: string, workflow: any) {
    if (!workflow.nodes || !Array.isArray(workflow.nodes)) return;

    const nodes = workflow.nodes as WorkflowNode[];
    
    // Извлекаем типы нод и их последовательности
    const nodeTypes = nodes.map(n => n.type);
    const uniqueTypes = [...new Set(nodeTypes)];
    
    // Определяем категорию воркфлоу
    const category = this.categorizeWorkflow(uniqueTypes, workflow.name);
    
    // Добавляем или обновляем паттерн
    if (!this.patterns.has(category)) {
      this.patterns.set(category, {
        name: category,
        count: 0,
        examples: [],
        commonNodes: [],
        commonSequences: [],
        typicalParameters: {}
      });
    }
    
    const pattern = this.patterns.get(category)!;
    pattern.count++;
    pattern.examples.push(filename);
    
    // Анализируем последовательности нод
    this.extractSequences(nodes, workflow.connections);
    
    // Сохраняем параметры для анализа
    nodes.forEach(node => {
      if (node.parameters) {
        const key = `${node.type}:params`;
        if (!this.nodeParameters.has(key)) {
          this.nodeParameters.set(key, []);
        }
        this.nodeParameters.get(key)!.push(node.parameters);
      }
    });
  }

  private categorizeWorkflow(nodeTypes: string[], name: string): string {
    const nameLower = name.toLowerCase();
    
    // AI/LangChain workflows
    if (nodeTypes.some(t => t.includes('langchain'))) {
      if (nodeTypes.some(t => t.includes('agent'))) return 'ai-agent-workflow';
      if (nodeTypes.some(t => t.includes('embedding'))) return 'ai-embedding-workflow';
      if (nodeTypes.some(t => t.includes('vectorStore'))) return 'ai-rag-workflow';
      return 'ai-workflow';
    }
    
    // Communication workflows
    if (nodeTypes.includes('n8n-nodes-base.slack')) {
      if (nodeTypes.includes('n8n-nodes-base.webhook')) return 'webhook-to-slack';
      if (nodeTypes.includes('n8n-nodes-base.scheduleTrigger')) return 'scheduled-slack';
      return 'slack-notification';
    }
    
    if (nodeTypes.includes('n8n-nodes-base.emailSend')) {
      if (nameLower.includes('digest')) return 'email-digest';
      if (nameLower.includes('alert')) return 'email-alert';
      if (nodeTypes.includes('n8n-nodes-base.scheduleTrigger')) return 'scheduled-email';
      return 'email-automation';
    }
    
    // Integration workflows
    if (nodeTypes.includes('n8n-nodes-base.github')) {
      if (nodeTypes.includes('n8n-nodes-base.jenkins')) return 'github-ci-cd';
      return 'github-automation';
    }
    
    if (nodeTypes.includes('n8n-nodes-base.stripe')) {
      if (nodeTypes.includes('n8n-nodes-base.quickbooks')) return 'stripe-to-accounting';
      return 'payment-processing';
    }
    
    // Data workflows
    if (nodeTypes.includes('n8n-nodes-base.postgres') || 
        nodeTypes.includes('n8n-nodes-base.mysql')) {
      if (nodeTypes.includes('n8n-nodes-base.googleSheets')) return 'database-to-sheets';
      if (nameLower.includes('backup')) return 'database-backup';
      return 'database-automation';
    }
    
    if (nodeTypes.includes('n8n-nodes-base.googleSheets')) {
      if (nodeTypes.includes('n8n-nodes-base.httpRequest')) return 'api-to-sheets';
      return 'spreadsheet-automation';
    }
    
    // Monitoring workflows
    if (nameLower.includes('monitor') || nameLower.includes('health')) {
      return 'monitoring-workflow';
    }
    
    // ETL workflows
    if (nodeTypes.includes('n8n-nodes-base.httpRequest') && 
        nodeTypes.includes('n8n-nodes-base.code') &&
        nodeTypes.length > 4) {
      return 'etl-workflow';
    }
    
    // File processing
    if (nodeTypes.some(t => t.includes('spreadsheetFile') || t.includes('readBinary'))) {
      return 'file-processing';
    }
    
    // Default categories
    if (nodeTypes.includes('n8n-nodes-base.webhook')) return 'webhook-automation';
    if (nodeTypes.includes('n8n-nodes-base.scheduleTrigger')) return 'scheduled-automation';
    if (nodeTypes.includes('n8n-nodes-base.httpRequest')) return 'api-integration';
    
    return 'general-automation';
  }

  private extractSequences(nodes: WorkflowNode[], connections: any) {
    if (!connections) return;
    
    // Простое извлечение последовательностей (2-3 ноды)
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    Object.entries(connections).forEach(([fromId, conns]: [string, any]) => {
      const fromNode = nodeMap.get(fromId);
      if (!fromNode || !conns.main || !conns.main[0]) return;
      
      conns.main[0].forEach((conn: any) => {
        const toNode = nodeMap.get(conn.node);
        if (!toNode) return;
        
        // Сохраняем последовательность из 2 нод
        const sequence2 = `${fromNode.type} -> ${toNode.type}`;
        this.nodeSequences.set(sequence2, (this.nodeSequences.get(sequence2) || 0) + 1);
        
        // Пытаемся найти последовательность из 3 нод
        if (connections[toNode.id]?.main?.[0]) {
          const nextConn = connections[toNode.id].main[0][0];
          if (nextConn) {
            const thirdNode = nodeMap.get(nextConn.node);
            if (thirdNode) {
              const sequence3 = `${fromNode.type} -> ${toNode.type} -> ${thirdNode.type}`;
              this.nodeSequences.set(sequence3, (this.nodeSequences.get(sequence3) || 0) + 1);
            }
          }
        }
      });
    });
  }

  generatePatterns(): any[] {
    const patterns: any[] = [];
    
    // Анализируем каждую категорию
    this.patterns.forEach((pattern, category) => {
      // Находим самые частые последовательности для этой категории
      const relevantSequences: string[][] = [];
      this.nodeSequences.forEach((count, sequence) => {
        if (count > 2) { // Последовательность встречается минимум 3 раза
          relevantSequences.push(sequence.split(' -> '));
        }
      });
      
      // Анализируем типичные параметры
      const typicalParams: Record<string, any> = {};
      this.nodeParameters.forEach((paramsList, nodeType) => {
        if (paramsList.length > 3) {
          // Находим общие параметры
          const commonParams = this.findCommonParameters(paramsList);
          if (Object.keys(commonParams).length > 0) {
            typicalParams[nodeType] = commonParams;
          }
        }
      });
      
      patterns.push({
        category,
        count: pattern.count,
        examples: pattern.examples.slice(0, 5), // Первые 5 примеров
        commonSequences: relevantSequences.slice(0, 5), // Топ 5 последовательностей
        typicalParameters: typicalParams
      });
    });
    
    return patterns.sort((a, b) => b.count - a.count);
  }

  private findCommonParameters(paramsList: any[]): any {
    if (paramsList.length === 0) return {};
    
    const commonParams: any = {};
    const firstParams = paramsList[0];
    
    Object.keys(firstParams).forEach(key => {
      // Проверяем, есть ли этот параметр во всех примерах
      const values = paramsList.map(p => p[key]).filter(v => v !== undefined);
      
      if (values.length > paramsList.length * 0.7) { // Параметр есть в 70% случаев
        // Находим самое частое значение
        const valueCounts = new Map<any, number>();
        values.forEach(v => {
          const vStr = JSON.stringify(v);
          valueCounts.set(vStr, (valueCounts.get(vStr) || 0) + 1);
        });
        
        let mostCommon: any = null;
        let maxCount = 0;
        valueCounts.forEach((count, value) => {
          if (count > maxCount) {
            maxCount = count;
            mostCommon = JSON.parse(value);
          }
        });
        
        if (maxCount > values.length * 0.5) { // Значение встречается в 50% случаев
          commonParams[key] = mostCommon;
        }
      }
    });
    
    return commonParams;
  }
}

// Главная функция
async function main() {
  const extractor = new PatternExtractor();
  const examplesDir = join(__dirname, '../temp-n8n-factory/examples');
  
  console.log('🔍 Extracting patterns from n8n-factory workflows...\n');
  
  const files = readdirSync(examplesDir).filter(f => f.endsWith('.json'));
  let analyzed = 0;
  
  // Анализируем все файлы
  for (const file of files) {
    try {
      const content = readFileSync(join(examplesDir, file), 'utf-8');
      const workflow = JSON.parse(content);
      
      extractor.analyzeWorkflow(file, workflow);
      analyzed++;
      
      if (analyzed % 50 === 0) {
        console.log(`Analyzed ${analyzed} workflows...`);
      }
    } catch (error) {
      // Игнорируем ошибки отдельных файлов
    }
  }
  
  console.log(`\n✅ Analyzed ${analyzed} workflows`);
  
  // Генерируем паттерны
  const patterns = extractor.generatePatterns();
  
  // Сохраняем результаты
  const output = {
    analyzedAt: new Date().toISOString(),
    totalWorkflows: analyzed,
    patterns: patterns,
    topSequences: Array.from(extractor['nodeSequences'].entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([seq, count]) => ({ sequence: seq, count }))
  };
  
  writeFileSync(
    join(__dirname, 'extracted-patterns.json'),
    JSON.stringify(output, null, 2)
  );
  
  // Выводим статистику
  console.log('\n📊 Pattern Statistics:');
  patterns.slice(0, 10).forEach(p => {
    console.log(`  ${p.category}: ${p.count} workflows`);
  });
  
  console.log('\n🔗 Top Node Sequences:');
  output.topSequences.slice(0, 10).forEach(seq => {
    console.log(`  ${seq.sequence} (${seq.count}x)`);
  });
  
  console.log('\n📄 Results saved to extracted-patterns.json');
}

main().catch(console.error);