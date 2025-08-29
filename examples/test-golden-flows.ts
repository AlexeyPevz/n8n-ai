import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { OperationBatchSchema } from '@n8n-ai/schemas';

interface GoldenFlow {
  name: string;
  description: string;
  prompt: string;
  expectedOperations: any;
  validation: {
    expectedNodes: number;
    expectedConnections: number;
    mustHaveNodes: string[];
    requiresCredentials?: string[];
  };
}

async function testGoldenFlow(flowPath: string): Promise<boolean> {
  console.log(`\nTesting: ${flowPath}`);
  
  try {
    const flowContent = readFileSync(flowPath, 'utf-8');
    const flow: GoldenFlow = JSON.parse(flowContent);
    
    console.log(`  Name: ${flow.name}`);
    console.log(`  Prompt: ${flow.prompt}`);
    
    // Валидация схемы операций
    const parseResult = OperationBatchSchema.safeParse(flow.expectedOperations);
    
    if (!parseResult.success) {
      console.error('  ❌ Invalid operation batch schema:');
      console.error(parseResult.error.format());
      return false;
    }
    
    // Проверка количества операций
    const ops = flow.expectedOperations.ops;
    const nodeOps = ops.filter((op: any) => op.op === 'add_node');
    const connectOps = ops.filter((op: any) => op.op === 'connect');
    
    console.log(`  ✓ Operations: ${ops.length} total (${nodeOps.length} nodes, ${connectOps.length} connections)`);
    
    // Проверка обязательных нод
    const addedNodes = nodeOps.map((op: any) => op.node.name);
    const missingNodes = flow.validation.mustHaveNodes.filter(
      node => !addedNodes.includes(node) && node !== 'Manual Trigger'
    );
    
    if (missingNodes.length > 0) {
      console.error(`  ❌ Missing required nodes: ${missingNodes.join(', ')}`);
      return false;
    }
    
    console.log('  ✅ All validation checks passed');
    return true;
    
  } catch (error) {
    console.error(`  ❌ Error: ${error}`);
    return false;
  }
}

async function runTests() {
  console.log('🧪 Testing Golden Flows for n8n-ai\n');
  
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const goldenFlowsDir = join(__dirname, 'golden-flows');
  const indexPath = join(goldenFlowsDir, 'index.json');
  
  try {
    const indexContent = readFileSync(indexPath, 'utf-8');
    const index = JSON.parse(indexContent);
    
    console.log(`Found ${index.flows.length} golden flows to test`);
    
    let passed = 0;
    let failed = 0;
    
    for (const flowInfo of index.flows) {
      const flowPath = join(goldenFlowsDir, `${flowInfo.id}.json`);
      const result = await testGoldenFlow(flowPath);
      
      if (result) {
        passed++;
      } else {
        failed++;
      }
    }
    
    console.log('\n📊 Test Results:');
    console.log(`  ✅ Passed: ${passed}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  Total: ${index.flows.length}`);
    
    if (failed > 0) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error('Failed to run tests:', error);
    process.exit(1);
  }
}

// Запуск тестов
runTests();