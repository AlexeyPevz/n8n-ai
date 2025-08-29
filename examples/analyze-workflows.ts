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

interface WorkflowConnection {
  source: { id: string; type: string; index?: number };
  target: { id: string; type: string; index?: number };
}

interface Workflow {
  name: string;
  nodes: WorkflowNode[];
  connections?: Record<string, any>;
}

interface WorkflowPattern {
  name: string;
  description: string;
  nodeTypes: string[];
  commonParameters: Record<string, any>;
  connectionPatterns: string[];
}

function analyzeWorkflow(workflow: Workflow): WorkflowPattern {
  const nodeTypes = [...new Set(workflow.nodes.map(n => n.type))];
  
  // Анализ общих параметров по типам нод
  const commonParameters: Record<string, any> = {};
  const nodeTypeGroups = workflow.nodes.reduce((acc, node) => {
    if (!acc[node.type]) acc[node.type] = [];
    acc[node.type].push(node);
    return acc;
  }, {} as Record<string, WorkflowNode[]>);
  
  // Извлечение паттернов соединений
  const connectionPatterns: string[] = [];
  if (workflow.connections) {
    // Анализ связей между типами нод
    const connections = Object.entries(workflow.connections).flatMap(([nodeId, conns]: [string, any]) => {
      const sourceNode = workflow.nodes.find(n => n.id === nodeId);
      if (!sourceNode || !conns.main) return [];
      
      return conns.main[0].map((conn: any) => {
        const targetNode = workflow.nodes.find(n => n.id === conn.node);
        if (!targetNode) return null;
        return `${sourceNode.type} -> ${targetNode.type}`;
      }).filter(Boolean);
    });
    
    connectionPatterns.push(...new Set(connections));
  }
  
  // Определение описания на основе типов нод
  let description = 'Workflow that';
  if (nodeTypes.includes('n8n-nodes-base.webhook')) {
    description += ' triggers on webhook';
  } else if (nodeTypes.includes('n8n-nodes-base.scheduleTrigger')) {
    description += ' runs on schedule';
  } else if (nodeTypes.includes('n8n-nodes-base.manualTrigger')) {
    description += ' triggers manually';
  }
  
  if (nodeTypes.includes('n8n-nodes-base.httpRequest')) {
    description += ', makes HTTP requests';
  }
  if (nodeTypes.includes('n8n-nodes-base.slack')) {
    description += ', sends Slack messages';
  }
  if (nodeTypes.includes('n8n-nodes-base.emailSend')) {
    description += ', sends emails';
  }
  
  return {
    name: workflow.name,
    description,
    nodeTypes,
    commonParameters,
    connectionPatterns
  };
}

function generatePromptExamples(patterns: WorkflowPattern[]): any[] {
  return patterns.map(pattern => {
    // Генерация примера промпта на основе паттерна
    let prompt = '';
    
    if (pattern.name.toLowerCase().includes('slack')) {
      prompt = `Send ${pattern.name.replace('_', ' ')} notifications to Slack`;
    } else if (pattern.name.toLowerCase().includes('email')) {
      prompt = `Create email workflow for ${pattern.name.replace('_', ' ')}`;
    } else if (pattern.name.toLowerCase().includes('github')) {
      prompt = `Integrate GitHub ${pattern.name.replace('_', ' ')} with automation`;
    } else {
      prompt = `Create ${pattern.name.replace('_', ' ')} workflow`;
    }
    
    // Определение основных операций на основе типов нод
    const operations = pattern.nodeTypes.map(nodeType => {
      const parts = nodeType.split('.');
      const nodeName = parts[parts.length - 1];
      
      switch (nodeName) {
        case 'webhook': return { op: 'add_node', type: 'webhook' };
        case 'httpRequest': return { op: 'add_node', type: 'http' };
        case 'slack': return { op: 'add_node', type: 'slack' };
        case 'emailSend': return { op: 'add_node', type: 'email' };
        case 'if': return { op: 'add_node', type: 'conditional' };
        case 'code': return { op: 'add_node', type: 'transform' };
        default: return { op: 'add_node', type: nodeName };
      }
    });
    
    return {
      name: pattern.name,
      prompt,
      nodeTypes: pattern.nodeTypes,
      operations,
      connectionPatterns: pattern.connectionPatterns
    };
  });
}

// Основная функция
async function main() {
  const realWorldDir = join(__dirname, 'real-world-workflows');
  const goldenFlowsDir = join(__dirname, 'golden-flows');
  
  // Анализ реальных воркфлоу
  console.log('🔍 Analyzing real-world workflows...\n');
  
  const realWorldFiles = readdirSync(realWorldDir).filter(f => f.endsWith('.json'));
  const patterns: WorkflowPattern[] = [];
  
  for (const file of realWorldFiles) {
    try {
      const content = readFileSync(join(realWorldDir, file), 'utf-8');
      const workflow = JSON.parse(content);
      
      console.log(`Analyzing: ${file}`);
      const pattern = analyzeWorkflow(workflow);
      patterns.push(pattern);
      
      console.log(`  - Nodes: ${pattern.nodeTypes.length}`);
      console.log(`  - Types: ${pattern.nodeTypes.slice(0, 3).join(', ')}...`);
      console.log(`  - Connections: ${pattern.connectionPatterns.length}\n`);
    } catch (error) {
      console.error(`Error analyzing ${file}:`, error);
    }
  }
  
  // Генерация дополнительных примеров для AI
  const promptExamples = generatePromptExamples(patterns);
  
  // Сохранение результатов анализа
  const analysisResult = {
    analyzedAt: new Date().toISOString(),
    totalWorkflows: patterns.length,
    commonNodeTypes: [...new Set(patterns.flatMap(p => p.nodeTypes))].sort(),
    patterns,
    promptExamples
  };
  
  writeFileSync(
    join(__dirname, 'workflow-analysis.json'),
    JSON.stringify(analysisResult, null, 2)
  );
  
  console.log('✅ Analysis complete!');
  console.log(`📊 Analyzed ${patterns.length} workflows`);
  console.log(`💡 Generated ${promptExamples.length} prompt examples`);
  console.log(`📄 Results saved to workflow-analysis.json`);
}

main().catch(console.error);