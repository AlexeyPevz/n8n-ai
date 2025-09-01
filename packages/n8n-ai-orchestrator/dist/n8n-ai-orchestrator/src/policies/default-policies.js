// Default policies for different environments
export const developmentPolicies = [
    {
        type: 'operation_limit',
        enabled: true,
        maxOperations: 100,
        maxNodesPerBatch: 50,
        maxConnectionsPerBatch: 100,
    },
    {
        type: 'workflow_complexity',
        enabled: true,
        maxNodes: 200,
        maxDepth: 10,
        maxConnections: 500,
    },
];
export const productionPolicies = [
    {
        type: 'node_whitelist',
        enabled: true,
        whitelist: [
            // Core nodes
            'n8n-nodes-base.manualTrigger',
            'n8n-nodes-base.webhook',
            'n8n-nodes-base.httpRequest',
            'n8n-nodes-base.set',
            'n8n-nodes-base.function',
            'n8n-nodes-base.if',
            'n8n-nodes-base.switch',
            'n8n-nodes-base.merge',
            'n8n-nodes-base.splitInBatches',
            // Data transformation
            'n8n-nodes-base.itemLists',
            'n8n-nodes-base.code',
            'n8n-nodes-base.dateTime',
            'n8n-nodes-base.crypto',
            // Communication
            'n8n-nodes-base.emailSend',
            'n8n-nodes-base.slack',
            'n8n-nodes-base.telegram',
            // Databases
            'n8n-nodes-base.postgres',
            'n8n-nodes-base.mysql',
            'n8n-nodes-base.mongodb',
            'n8n-nodes-base.redis',
            // Cloud services
            'n8n-nodes-base.awsS3',
            'n8n-nodes-base.googleSheets',
            'n8n-nodes-base.googleDrive',
            'n8n-nodes-base.github',
            // Other
            'n8n-nodes-base.executeWorkflow',
            'n8n-nodes-base.wait',
            'n8n-nodes-base.errorTrigger',
        ],
        allowUnknown: false,
    },
    {
        type: 'operation_limit',
        enabled: true,
        maxOperations: 50,
        maxNodesPerBatch: 20,
        maxConnectionsPerBatch: 50,
    },
    {
        type: 'node_type_limit',
        enabled: true,
        limits: {
            'n8n-nodes-base.httpRequest': 10,
            'n8n-nodes-base.executeWorkflow': 5,
            'n8n-nodes-base.function': 10,
            'n8n-nodes-base.code': 10,
        },
    },
    {
        type: 'parameter_policy',
        enabled: true,
        rules: [
            {
                nodeType: 'n8n-nodes-base.httpRequest',
                parameter: 'url',
                policy: 'pattern',
                pattern: '^https?://.*',
                message: 'HTTP Request URL must be a valid HTTP/HTTPS URL',
            },
            {
                nodeType: 'n8n-nodes-base.executeWorkflow',
                parameter: 'workflowId',
                policy: 'required',
                message: 'Execute Workflow node requires a workflow ID',
            },
            {
                nodeType: '*',
                parameter: 'authentication',
                policy: 'forbidden',
                message: 'Authentication parameters cannot be set via AI',
            },
        ],
    },
    {
        type: 'cost_limit',
        enabled: true,
        maxEstimatedCost: 1000,
        costUnit: 'tokens',
    },
    {
        type: 'workflow_complexity',
        enabled: true,
        maxNodes: 100,
        maxDepth: 8,
        maxConnections: 200,
    },
];
export const strictPolicies = [
    ...productionPolicies,
    {
        type: 'operation_limit',
        enabled: true,
        maxOperations: 10,
        maxNodesPerBatch: 5,
        maxConnectionsPerBatch: 10,
    },
    {
        type: 'cost_limit',
        enabled: true,
        maxEstimatedCost: 100,
        costUnit: 'tokens',
    },
];
// Get policies based on environment
export function getDefaultPolicies(environment) {
    const env = environment || process.env.NODE_ENV || 'development';
    switch (env) {
        case 'production':
            return productionPolicies;
        case 'strict':
            return strictPolicies;
        case 'development':
        default:
            return developmentPolicies;
    }
}
// Merge custom policies with defaults
export function mergePolicies(custom, defaults) {
    const result = [...defaults];
    for (const customPolicy of custom) {
        const index = result.findIndex(p => p.type === customPolicy.type);
        if (index >= 0) {
            result[index] = customPolicy;
        }
        else {
            result.push(customPolicy);
        }
    }
    return result;
}
