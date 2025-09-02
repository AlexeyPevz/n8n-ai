export const SYSTEM_PROMPTS = {
    default: `You are an expert n8n workflow automation assistant. Your role is to help users create, modify, and optimize n8n workflows.

Key principles:
1. Always produce valid n8n workflow operations that follow the schema
2. Prefer simple, maintainable solutions over complex ones
3. Use appropriate nodes for each task (HTTP Request for APIs, Schedule Trigger for cron, etc.)
4. Ensure proper error handling and data validation
5. Follow n8n best practices for performance and reliability

When analyzing requests:
- Break down complex requirements into smaller steps
- Consider data flow between nodes
- Think about error cases and edge conditions
- Optimize for readability and maintainability

Available node schemas:
{nodeSchemas}`,
    chainOfThought: `You are an expert n8n workflow automation assistant that uses step-by-step reasoning.

When solving a workflow automation problem:
1. First, understand what the user wants to achieve
2. Break down the task into logical steps
3. For each step, identify the appropriate n8n node
4. Consider data transformations needed between steps
5. Think about error handling and edge cases
6. Finally, generate the complete workflow

Always show your reasoning process before providing the solution.

Available node schemas:
{nodeSchemas}`,
    expert: `You are a senior n8n workflow architect with deep expertise in:
- Integration patterns and best practices
- Performance optimization
- Error handling and reliability
- Security considerations
- Scalability patterns

Approach each request with:
1. Pattern recognition - identify common workflow patterns
2. Best practices - apply n8n conventions and standards
3. Optimization - consider performance and resource usage
4. Reliability - ensure robust error handling
5. Maintainability - create clear, documented workflows

Available node schemas:
{nodeSchemas}`,
};
export const PLANNER_TEMPLATES = {
    default: `Given the user request: "{prompt}"

Current workflow state:
{currentWorkflow}

Available nodes:
{availableNodes}

Generate a plan to fulfill this request as a series of operations.
Respond with a valid OperationBatch JSON object.`,
    chainOfThought: `Let me analyze this workflow request step by step.

User request: "{prompt}"

Current workflow state:
{currentWorkflow}

Available nodes:
{availableNodes}

Step 1: Understanding the requirement
{Let me break down what the user wants to achieve}

Step 2: Identifying necessary nodes
{Which n8n nodes would be best for this task?}

Step 3: Planning the workflow structure
{How should these nodes be connected?}

Step 4: Configuring node parameters
{What settings does each node need?}

Step 5: Adding error handling
{What could go wrong and how to handle it?}

Based on this analysis, here's my workflow plan:
{Generate the OperationBatch JSON}`,
    guided: `I'll help you create a workflow for: "{prompt}"

Let me ask some clarifying questions first:
1. What triggers this workflow? (manual, schedule, webhook, etc.)
2. What's the data source? (API, database, file, etc.)
3. What transformations are needed?
4. Where should the output go?
5. How should errors be handled?

Based on common patterns for this type of workflow, I recommend:
{analysis}

Here's the implementation:
{Generate the OperationBatch JSON}`,
};
export const CRITIC_TEMPLATES = {
    default: `Review this workflow for issues:
{workflow}

Validation errors found:
{errors}

Suggest fixes for these issues. Focus on:
1. Missing required parameters
2. Invalid connections
3. Type mismatches
4. Best practices violations

Respond with a valid OperationBatch JSON object containing fix operations.`,
    detailed: `I'll analyze this workflow for potential issues.

Workflow:
{workflow}

Detected problems:
{errors}

Let me examine each issue:

{For each error:
- What's wrong?
- Why is it a problem?
- How to fix it?
}

Recommended fixes:
1. {Fix description and rationale}
2. {Fix description and rationale}
...

Here are the operations to fix these issues:
{Generate fix OperationBatch JSON}`,
};
export class PromptEngineer {
    /**
     * Select the best prompt template based on context
     */
    static selectTemplate(context, templateType) {
        // System prompt selection
        if (templateType === 'system') {
            if (context.complexity === 'complex' || context.userExperience === 'expert') {
                return SYSTEM_PROMPTS.expert;
            }
            if (context.requestType === 'fix' || context.requestType === 'optimize') {
                return SYSTEM_PROMPTS.chainOfThought;
            }
            return SYSTEM_PROMPTS.default;
        }
        // Planner template selection
        if (templateType === 'planner') {
            if (context.complexity === 'complex') {
                return PLANNER_TEMPLATES.chainOfThought;
            }
            if (context.userExperience === 'beginner') {
                return PLANNER_TEMPLATES.guided;
            }
            return PLANNER_TEMPLATES.default;
        }
        // Critic template selection
        if (templateType === 'critic') {
            if (context.hasErrors && context.complexity !== 'simple') {
                return CRITIC_TEMPLATES.detailed;
            }
            return CRITIC_TEMPLATES.default;
        }
        return '';
    }
    /**
     * Enhance prompt with examples
     */
    static addExamples(prompt, examples, maxExamples = 3) {
        if (examples.length === 0)
            return prompt;
        const selectedExamples = examples.slice(0, maxExamples);
        const exampleText = selectedExamples
            .map((ex, i) => `Example ${i + 1}:\nInput: ${ex.input}\nOutput: ${ex.output}`)
            .join('\n\n');
        return `${prompt}\n\nHere are some examples:\n\n${exampleText}`;
    }
    /**
     * Add chain-of-thought markers
     */
    static addChainOfThought(prompt) {
        const markers = [
            '\nLet me think through this step by step:',
            '\nFirst, I need to understand:',
            '\nNext, I should consider:',
            '\nFinally, I will:',
        ];
        // Insert markers at appropriate points
        return prompt + markers[0];
    }
    /**
     * Format multi-step reasoning
     */
    static formatReasoning(steps) {
        return steps
            .map((step, i) => `Step ${i + 1}: ${step.title}\n${step.content}`)
            .join('\n\n');
    }
    /**
     * Extract complexity from prompt
     */
    static analyzeComplexity(prompt) {
        const indicators = {
            complex: [
                'multiple', 'integrate', 'complex', 'advanced', 'custom',
                'transform', 'aggregate', 'parallel', 'conditional',
            ],
            medium: [
                'process', 'convert', 'filter', 'modify', 'update',
                'fetch and', 'then', 'after', 'schedule',
            ],
            simple: [
                'get', 'post', 'fetch', 'send', 'create', 'basic',
                'simple', 'just', 'only',
            ],
        };
        const promptLower = prompt.toLowerCase();
        // Count indicators
        const complexCount = indicators.complex.filter(word => promptLower.includes(word)).length;
        const mediumCount = indicators.medium.filter(word => promptLower.includes(word)).length;
        const simpleCount = indicators.simple.filter(word => promptLower.includes(word)).length;
        // Determine complexity
        if (promptLower.includes('complex'))
            return 'complex';
        if (complexCount >= 2 || prompt.length > 220)
            return 'complex';
        if (mediumCount >= 1 || complexCount === 1)
            return 'medium';
        return 'simple';
    }
}
