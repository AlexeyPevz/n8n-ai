export class ChainOfThoughtPlanner {
    /**
     * Decompose a complex request into logical steps
     */
    static decomposeRequest(prompt) {
        const steps = [];
        // Analyze prompt for key actions
        const actions = this.extractActions(prompt);
        // Always start with trigger
        steps.push({
            title: 'Determine Trigger',
            description: this.selectTrigger(prompt),
            nodes: [this.getTriggerNode(prompt)],
            considerations: ['When should this workflow run?', 'What initiates the process?'],
        });
        // Add steps for each action
        actions.forEach((action, index) => {
            steps.push(this.createStepForAction(action, index));
        });
        // Add error handling if complex
        if (actions.length > 2) {
            steps.push({
                title: 'Add Error Handling',
                description: 'Ensure the workflow handles failures gracefully',
                nodes: ['n8n-nodes-base.errorTrigger'],
                considerations: ['What could go wrong?', 'How to notify about errors?'],
            });
        }
        return steps;
    }
    /**
     * Generate detailed reasoning for each step
     */
    static generateReasoning(steps) {
        const reasoning = [
            '## Workflow Analysis\n',
            `I need to create a workflow with ${steps.length} main components:\n`,
        ];
        steps.forEach((step, index) => {
            reasoning.push(`### ${index + 1}. ${step.title}`);
            reasoning.push(step.description);
            if (step.nodes && step.nodes.length > 0) {
                reasoning.push(`**Nodes needed**: ${step.nodes.join(', ')}`);
            }
            if (step.considerations && step.considerations.length > 0) {
                reasoning.push('**Key considerations**:');
                step.considerations.forEach(c => reasoning.push(`- ${c}`));
            }
            reasoning.push('');
        });
        return reasoning.join('\n');
    }
    /**
     * Convert plan to operations
     */
    static planToOperations(plan) {
        const operations = [];
        const nodePositions = new Map();
        let currentX = 300;
        let currentY = 300;
        // Add nodes from each step
        plan.steps.forEach((step, stepIndex) => {
            if (step.nodes) {
                step.nodes.forEach((nodeType, nodeIndex) => {
                    const nodeName = this.generateNodeName(nodeType, stepIndex, nodeIndex);
                    operations.push({
                        op: 'add_node',
                        node: {
                            id: nodeName.toLowerCase().replace(/\s+/g, '-'),
                            name: nodeName,
                            type: nodeType,
                            typeVersion: this.getNodeVersion(nodeType),
                            position: [currentX, currentY],
                            parameters: this.getDefaultParameters(nodeType),
                        },
                    });
                    nodePositions.set(nodeName, [currentX, currentY]);
                    currentX += 300;
                    // Wrap to next row
                    if (currentX > 1200) {
                        currentX = 300;
                        currentY += 200;
                    }
                });
            }
        });
        // Add connections
        const connections = this.inferConnections(plan.steps);
        connections.forEach(conn => {
            operations.push({
                op: 'connect',
                from: conn.from,
                to: conn.to,
                index: 0,
            });
        });
        // Add annotations for complex workflows
        if (plan.steps.length > 3) {
            plan.steps.forEach((step, index) => {
                if (step.nodes && step.nodes.length > 0) {
                    const nodeName = this.generateNodeName(step.nodes[0], index, 0);
                    operations.push({
                        op: 'annotate',
                        name: nodeName,
                        text: step.description,
                    });
                }
            });
        }
        return {
            version: 'v1',
            ops: operations,
        };
    }
    /**
     * Extract actions from prompt
     */
    static extractActions(prompt) {
        const actionPatterns = [
            /fetch|get|retrieve|pull/gi,
            /process|transform|convert|modify/gi,
            /send|post|push|deliver|notify/gi,
            /save|store|write|record/gi,
            /filter|validate|check|verify/gi,
            /aggregate|combine|merge|join/gi,
        ];
        const actions = [];
        const promptLower = prompt.toLowerCase();
        actionPatterns.forEach(pattern => {
            const matches = prompt.match(pattern);
            if (matches) {
                actions.push(matches[0]);
            }
        });
        // If no specific actions found, infer from context
        if (actions.length === 0) {
            if (promptLower.includes('api'))
                actions.push('fetch');
            if (promptLower.includes('database'))
                actions.push('query');
            if (promptLower.includes('email'))
                actions.push('send');
            if (promptLower.includes('file'))
                actions.push('process');
        }
        return actions;
    }
    /**
     * Select appropriate trigger
     */
    static selectTrigger(prompt) {
        const promptLower = prompt.toLowerCase();
        if (promptLower.includes('webhook')) {
            return 'Webhook trigger to receive external data';
        }
        if (promptLower.includes('schedule') || promptLower.includes('every') || promptLower.includes('daily')) {
            return 'Schedule trigger for periodic execution';
        }
        if (promptLower.includes('email') && promptLower.includes('receive')) {
            return 'Email trigger to process incoming messages';
        }
        if (promptLower.includes('form')) {
            return 'Form trigger to handle submissions';
        }
        return 'Manual trigger for on-demand execution';
    }
    /**
     * Get trigger node type
     */
    static getTriggerNode(prompt) {
        const promptLower = prompt.toLowerCase();
        if (promptLower.includes('webhook'))
            return 'n8n-nodes-base.webhook';
        if (promptLower.includes('schedule') || promptLower.includes('every'))
            return 'n8n-nodes-base.scheduleTrigger';
        if (promptLower.includes('email') && promptLower.includes('receive'))
            return 'n8n-nodes-base.emailTrigger';
        if (promptLower.includes('form'))
            return 'n8n-nodes-base.formTrigger';
        return 'n8n-nodes-base.manualTrigger';
    }
    /**
     * Create step for action
     */
    static createStepForAction(action, index) {
        const actionLower = action.toLowerCase();
        const actionMappings = {
            fetch: {
                title: 'Fetch Data',
                description: 'Retrieve data from external source',
                nodes: ['n8n-nodes-base.httpRequest'],
                considerations: ['Authentication required?', 'Rate limits?', 'Response format?'],
            },
            process: {
                title: 'Process Data',
                description: 'Transform and prepare data',
                nodes: ['n8n-nodes-base.set', 'n8n-nodes-base.code'],
                considerations: ['Data structure?', 'Validation needed?', 'Complex transformations?'],
            },
            send: {
                title: 'Send Results',
                description: 'Deliver processed data to destination',
                nodes: ['n8n-nodes-base.httpRequest'],
                considerations: ['Destination format?', 'Authentication?', 'Error handling?'],
            },
            save: {
                title: 'Store Data',
                description: 'Persist data for later use',
                nodes: ['n8n-nodes-base.postgres'],
                considerations: ['Database schema?', 'Unique constraints?', 'Transaction handling?'],
            },
            filter: {
                title: 'Filter Data',
                description: 'Apply conditions to select relevant data',
                nodes: ['n8n-nodes-base.if', 'n8n-nodes-base.filter'],
                considerations: ['Filter criteria?', 'Multiple conditions?', 'Default behavior?'],
            },
        };
        return actionMappings[actionLower] || {
            title: `Action ${index + 1}`,
            description: `Perform ${action} operation`,
            nodes: ['n8n-nodes-base.function'],
            considerations: ['Implementation details?'],
        };
    }
    /**
     * Generate node name
     */
    static generateNodeName(nodeType, stepIndex, nodeIndex) {
        const baseName = nodeType.split('.').pop()?.replace(/([A-Z])/g, ' $1').trim() || 'Node';
        if (nodeIndex === 0 && stepIndex === 0) {
            return baseName;
        }
        return `${baseName} ${stepIndex + 1}`;
    }
    /**
     * Get node version
     */
    static getNodeVersion(nodeType) {
        const versions = {
            'n8n-nodes-base.httpRequest': 4,
            'n8n-nodes-base.webhook': 1,
            'n8n-nodes-base.set': 3,
            'n8n-nodes-base.code': 1,
            'n8n-nodes-base.if': 1,
            'n8n-nodes-base.postgres': 2,
        };
        return versions[nodeType] || 1;
    }
    /**
     * Get default parameters
     */
    static getDefaultParameters(nodeType) {
        const defaults = {
            'n8n-nodes-base.httpRequest': {
                method: 'GET',
                url: '',
                responseFormat: 'json',
                options: {},
            },
            'n8n-nodes-base.webhook': {
                httpMethod: 'POST',
                path: '/webhook',
                responseMode: 'onReceived',
            },
            'n8n-nodes-base.scheduleTrigger': {
                rule: {
                    interval: [{ field: 'hours', hoursInterval: 1 }],
                },
            },
            'n8n-nodes-base.set': {
                values: {
                    string: [],
                    number: [],
                    boolean: [],
                },
                options: {},
            },
        };
        return defaults[nodeType] || {};
    }
    /**
     * Infer connections between nodes
     */
    static inferConnections(steps) {
        const connections = [];
        let previousNode = null;
        steps.forEach((step, stepIndex) => {
            if (step.nodes && step.nodes.length > 0) {
                step.nodes.forEach((nodeType, nodeIndex) => {
                    const currentNode = this.generateNodeName(nodeType, stepIndex, nodeIndex);
                    if (previousNode) {
                        connections.push({ from: previousNode, to: currentNode });
                    }
                    // Handle multiple nodes in same step
                    if (nodeIndex > 0) {
                        const prevInStep = this.generateNodeName(step.nodes[nodeIndex - 1], stepIndex, nodeIndex - 1);
                        connections.push({ from: prevInStep, to: currentNode });
                    }
                    previousNode = currentNode;
                });
            }
        });
        return connections;
    }
}
