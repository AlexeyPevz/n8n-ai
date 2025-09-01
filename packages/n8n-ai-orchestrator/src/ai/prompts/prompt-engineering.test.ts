import { describe, it, expect } from 'vitest';
import { PromptEngineer } from './prompt-templates.js';
import { ChainOfThoughtPlanner } from './chain-of-thought.js';
import { PromptOptimizer } from './prompt-optimizer.js';

describe('PromptEngineer', () => {
  describe('complexity analysis', () => {
    it('should identify simple requests', () => {
      const simple = [
        'fetch data from API',
        'send email',
        'create HTTP request',
      ];
      
      simple.forEach(prompt => {
        expect(PromptEngineer.analyzeComplexity(prompt)).toBe('simple');
      });
    });

    it('should identify medium complexity', () => {
      const medium = [
        'fetch data and transform it',
        'process files then send notification',
        'schedule daily report generation',
      ];
      
      medium.forEach(prompt => {
        expect(PromptEngineer.analyzeComplexity(prompt)).toBe('medium');
      });
    });

    it('should identify complex requests', () => {
      const complex = [
        'integrate multiple APIs with custom transformations and error handling',
        'create parallel processing pipeline with conditional routing',
        'build complex ETL workflow with aggregations and validations',
      ];
      
      complex.forEach(prompt => {
        expect(PromptEngineer.analyzeComplexity(prompt)).toBe('complex');
      });
    });
  });

  describe('template selection', () => {
    it('should select appropriate system template', () => {
      const simple = PromptEngineer.selectTemplate(
        { complexity: 'simple' },
        'system'
      );
      expect(simple).toContain('expert n8n workflow automation assistant');

      const complex = PromptEngineer.selectTemplate(
        { complexity: 'complex' },
        'system'
      );
      expect(complex).toContain('senior n8n workflow architect');
    });

    it('should select chain of thought for fixes', () => {
      const template = PromptEngineer.selectTemplate(
        { requestType: 'fix' },
        'system'
      );
      expect(template).toContain('step-by-step reasoning');
    });
  });
});

describe('ChainOfThoughtPlanner', () => {
  describe('request decomposition', () => {
    it('should decompose simple request', () => {
      const steps = ChainOfThoughtPlanner.decomposeRequest('fetch user data from API');
      
      expect(steps).toHaveLength(2); // Trigger + Fetch
      expect(steps[0].title).toBe('Determine Trigger');
      expect(steps[1].title).toBe('Fetch Data');
    });

    it('should add error handling for complex workflows', () => {
      const steps = ChainOfThoughtPlanner.decomposeRequest(
        'fetch data, process it, transform results, and send to multiple destinations'
      );
      
      const errorStep = steps.find(s => s.title === 'Add Error Handling');
      expect(errorStep).toBeDefined();
    });

    it('should identify correct trigger type', () => {
      const webhookSteps = ChainOfThoughtPlanner.decomposeRequest('receive webhook data');
      expect(webhookSteps[0].nodes?.[0]).toBe('n8n-nodes-base.webhook');

      const scheduleSteps = ChainOfThoughtPlanner.decomposeRequest('run every day at 9 AM');
      expect(scheduleSteps[0].nodes?.[0]).toBe('n8n-nodes-base.scheduleTrigger');
    });
  });

  describe('plan to operations conversion', () => {
    it('should convert plan to valid operations', () => {
      const plan = {
        goal: 'Fetch API data',
        steps: [
          {
            title: 'Trigger',
            description: 'Manual trigger',
            nodes: ['n8n-nodes-base.manualTrigger'],
          },
          {
            title: 'Fetch',
            description: 'Get data from API',
            nodes: ['n8n-nodes-base.httpRequest'],
          },
        ],
        summary: 'Simple API workflow',
        operations: { version: 'v1', ops: [] },
      };

      const operations = ChainOfThoughtPlanner.planToOperations(plan);
      
      expect(operations.version).toBe('v1');
      expect(operations.ops).toHaveLength(3); // 2 nodes + 1 connection
      expect(operations.ops[0].op).toBe('add_node');
      expect(operations.ops[2].op).toBe('connect');
    });
  });
});

describe('PromptOptimizer', () => {
  describe('optimization', () => {
    it('should add task clarity', () => {
      const optimized = PromptOptimizer.optimize(
        'create workflow',
        { taskType: 'create' },
        {}
      );
      
      expect(optimized).toContain('Task: Create a new workflow');
    });

    it('should add chain of thought markers', () => {
      const optimized = PromptOptimizer.optimize(
        'complex task',
        {},
        { useChainOfThought: true }
      );
      
      expect(optimized).toContain('Think through this step-by-step');
      expect(optimized).toContain('What is the main goal?');
    });

    it('should add constraints', () => {
      const optimized = PromptOptimizer.optimize(
        'create workflow',
        {
          constraints: ['Use only GET requests', 'Include error handling'],
        },
        { includeConstraints: true }
      );
      
      expect(optimized).toContain('Important constraints:');
      expect(optimized).toContain('Use only GET requests');
      expect(optimized).toContain('Include error handling');
    });

    it('should add examples', () => {
      const optimized = PromptOptimizer.optimize(
        'create workflow',
        {
          examples: [
            { input: 'fetch data', output: '{"op": "add_node"}' },
          ],
        },
        { addExamples: true }
      );
      
      expect(optimized).toContain('Examples of similar tasks:');
      expect(optimized).toContain('fetch data');
    });
  });

  describe('contextual examples', () => {
    it('should generate HTTP examples', () => {
      const examples = PromptOptimizer.generateContextualExamples(
        'create',
        ['n8n-nodes-base.httpRequest']
      );
      
      expect(examples).toHaveLength(1);
      expect(examples[0].input).toContain('API');
      expect(examples[0].output).toContain('httpRequest');
    });

    it('should generate schedule examples', () => {
      const examples = PromptOptimizer.generateContextualExamples(
        'create',
        ['n8n-nodes-base.scheduleTrigger']
      );
      
      expect(examples).toHaveLength(1);
      expect(examples[0].output).toContain('scheduleTrigger');
    });
  });

  describe('performance hints', () => {
    it('should add appropriate performance hints', () => {
      const small = PromptOptimizer.addPerformanceHints('workflow', 'small');
      expect(small).toContain('small amounts of data');

      const large = PromptOptimizer.addPerformanceHints('workflow', 'large');
      expect(large).toContain('streaming and batching');
    });
  });
});