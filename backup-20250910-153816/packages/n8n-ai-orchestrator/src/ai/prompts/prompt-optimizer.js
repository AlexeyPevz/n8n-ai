export class PromptOptimizer {
    /**
     * Optimize prompt for better LLM performance
     */
    static optimize(prompt, context, options = {}) {
        let optimizedPrompt = prompt;
        // Add task clarity
        if (context.taskType) {
            optimizedPrompt = this.addTaskClarity(optimizedPrompt, context.taskType);
        }
        // Add chain of thought
        if (options.useChainOfThought) {
            optimizedPrompt = this.addChainOfThoughtMarkers(optimizedPrompt);
        }
        // Add constraints
        if (options.includeConstraints && context.constraints) {
            optimizedPrompt = this.addConstraints(optimizedPrompt, context.constraints);
        }
        // Add examples (few-shot)
        if (options.addExamples && context.examples) {
            optimizedPrompt = this.addFewShotExamples(optimizedPrompt, context.examples);
        }
        // Format output instructions
        if (options.formatOutput && context.expectedOutput) {
            optimizedPrompt = this.addOutputFormat(optimizedPrompt, context.expectedOutput);
        }
        return optimizedPrompt;
    }
    /**
     * Add task clarity
     */
    static addTaskClarity(prompt, taskType) {
        const taskDescriptions = {
            create: 'Create a new workflow from scratch based on the requirements.',
            modify: 'Modify the existing workflow to meet the new requirements.',
            fix: 'Fix the issues in the workflow and ensure it works correctly.',
            optimize: 'Optimize the workflow for better performance and reliability.',
            explain: 'Explain how the workflow works and what each component does.',
        };
        const description = taskDescriptions[taskType] || '';
        return `Task: ${description}\n\n${prompt}`;
    }
    /**
     * Add chain of thought markers
     */
    static addChainOfThoughtMarkers(prompt) {
        const markers = `
Think through this step-by-step:
1. What is the main goal?
2. What are the inputs and outputs?
3. What transformations are needed?
4. What error cases should be handled?
5. How can this be implemented efficiently?

Show your reasoning before providing the solution.

`;
        return prompt + '\n\n' + markers;
    }
    /**
     * Add constraints
     */
    static addConstraints(prompt, constraints) {
        if (constraints.length === 0)
            return prompt;
        const constraintSection = `
Important constraints:
${constraints.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Please ensure your solution adheres to all these constraints.
`;
        return prompt + '\n' + constraintSection;
    }
    /**
     * Add few-shot examples
     */
    static addFewShotExamples(prompt, examples) {
        if (examples.length === 0)
            return prompt;
        const exampleSection = `
Examples of similar tasks:

${examples.map((ex, i) => `
Example ${i + 1}:
Input: ${ex.input}
Output: ${ex.output}
`).join('\n')}

Now, for the current task:
`;
        return exampleSection + '\n' + prompt;
    }
    /**
     * Add output format instructions
     */
    static addOutputFormat(prompt, expectedOutput) {
        const formatInstructions = `
Output format requirements:
- Return a valid JSON object
- Follow the OperationBatch schema exactly
- Include all required fields
- Use proper node types and versions

Expected structure:
${expectedOutput}
`;
        return prompt + '\n' + formatInstructions;
    }
    /**
     * Generate contextual examples
     */
    static generateContextualExamples(taskType, nodeTypes) {
        const examples = [];
        // HTTP Request examples
        if (nodeTypes.includes('n8n-nodes-base.httpRequest')) {
            examples.push({
                input: 'Fetch user data from API',
                output: JSON.stringify({
                    op: 'add_node',
                    node: {
                        id: 'http-1',
                        name: 'HTTP Request',
                        type: 'n8n-nodes-base.httpRequest',
                        typeVersion: 4,
                        position: [600, 300],
                        parameters: {
                            method: 'GET',
                            url: '={{ $parameter.apiUrl }}/users',
                            responseFormat: 'json',
                        },
                    },
                }, null, 2),
            });
        }
        // Schedule Trigger examples
        if (nodeTypes.includes('n8n-nodes-base.scheduleTrigger')) {
            examples.push({
                input: 'Run every day at 9 AM',
                output: JSON.stringify({
                    op: 'add_node',
                    node: {
                        id: 'schedule-1',
                        name: 'Schedule Trigger',
                        type: 'n8n-nodes-base.scheduleTrigger',
                        typeVersion: 1,
                        position: [300, 300],
                        parameters: {
                            rule: {
                                interval: [{
                                        field: 'hours',
                                        hoursInterval: 24,
                                        triggerAtHour: 9,
                                    }],
                            },
                        },
                    },
                }, null, 2),
            });
        }
        return examples;
    }
    /**
     * Add error recovery instructions
     */
    static addErrorRecovery(prompt) {
        const errorInstructions = `
If you encounter any ambiguity or missing information:
1. Make reasonable assumptions based on common patterns
2. Add comments explaining your assumptions
3. Suggest alternatives if multiple approaches are valid
4. Include error handling for critical operations
`;
        return prompt + '\n' + errorInstructions;
    }
    /**
     * Add performance hints
     */
    static addPerformanceHints(prompt, dataSize) {
        if (!dataSize)
            return prompt;
        const hints = {
            small: 'The workflow will process small amounts of data (< 100 items).',
            medium: 'The workflow will process moderate amounts of data (100-10,000 items). Consider using batching.',
            large: 'The workflow will process large amounts of data (> 10,000 items). Use streaming and batching.',
        };
        return prompt + '\n\nPerformance consideration: ' + hints[dataSize];
    }
}
