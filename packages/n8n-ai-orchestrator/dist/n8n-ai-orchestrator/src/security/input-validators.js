import { z } from 'zod';
import { sanitizeSqlInput, sanitizeHtmlInput, sanitizePath } from './security-middleware.js';
// Common validators
export const SafeString = z.string().transform(val => sanitizeHtmlInput(val));
export const SafeSqlString = z.string().transform(val => sanitizeSqlInput(val));
export const SafePath = z.string().transform(val => sanitizePath(val));
export const UUID = z.string().uuid();
export const Email = z.string().email();
export const URL = z.string().url();
export const PositiveInt = z.number().int().positive();
export const NonNegativeInt = z.number().int().nonnegative();
// Workflow validators
export const WorkflowIdSchema = z.string().regex(/^[a-zA-Z0-9\-_]+$/, 'Invalid workflow ID format');
export const NodeIdSchema = z.string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9\-_]+$/, 'Invalid node ID format');
export const NodeTypeSchema = z.string()
    .regex(/^[a-zA-Z0-9\-\.]+$/, 'Invalid node type format')
    .max(200);
export const NodePositionSchema = z.tuple([
    z.number().min(-10000).max(10000),
    z.number().min(-10000).max(10000)
]);
export const NodeParametersSchema = z.record(z.any())
    .refine(params => {
    // Check for potential code injection in parameters
    const dangerous = ['eval', 'Function', 'setTimeout', 'setInterval', '__proto__'];
    const paramStr = JSON.stringify(params);
    return !dangerous.some(keyword => paramStr.includes(keyword));
}, 'Potentially dangerous code detected in parameters');
export const ConnectionSchema = z.object({
    from: NodeIdSchema,
    to: NodeIdSchema,
    fromIndex: z.number().int().nonnegative().optional(),
    toIndex: z.number().int().nonnegative().optional(),
});
// Operation validators
export const OperationTypeSchema = z.enum([
    'add_node',
    'remove_node',
    'set_params',
    'set_position',
    'add_edge',
    'remove_edge',
    'rename_node',
    'set_disabled',
    'batch',
]);
// Declare first, assign after with lazy to break cyclic type
export let OperationSchema = z.any();
OperationSchema = z.discriminatedUnion('op', [
    z.object({
        op: z.literal('add_node'),
        name: NodeIdSchema,
        type: NodeTypeSchema,
        typeVersion: z.number().int().positive().optional(),
        position: NodePositionSchema,
        parameters: NodeParametersSchema.optional(),
    }),
    z.object({
        op: z.literal('remove_node'),
        name: NodeIdSchema,
    }),
    z.object({
        op: z.literal('set_params'),
        name: NodeIdSchema,
        parameters: NodeParametersSchema,
    }),
    z.object({
        op: z.literal('set_position'),
        name: NodeIdSchema,
        position: NodePositionSchema,
    }),
    z.object({
        op: z.literal('add_edge'),
        connection: ConnectionSchema,
    }),
    z.object({
        op: z.literal('remove_edge'),
        connection: ConnectionSchema,
    }),
    z.object({
        op: z.literal('rename_node'),
        oldName: NodeIdSchema,
        newName: NodeIdSchema,
    }),
    z.object({
        op: z.literal('set_disabled'),
        name: NodeIdSchema,
        disabled: z.boolean(),
    }),
    z.object({
        op: z.literal('batch'),
        ops: z.array(z.lazy(() => OperationSchema)).max(1000), // Limit batch size
    }),
]);
export const OperationBatchSchema = z.object({
    version: z.enum(['v1']),
    ops: z.array(OperationSchema).min(1).max(1000), // Limit total operations
});
// AI prompt validators
export const PromptSchema = z.string()
    .min(1)
    .max(10000) // Limit prompt length
    .transform(val => sanitizeHtmlInput(val))
    .refine(val => {
    // Check for prompt injection attempts
    const dangerous = [
        'ignore previous instructions',
        'disregard all prior',
        'forget everything',
        'system:', // System prompt injection
        '```python', // Code execution attempts
        '```bash',
        '<script',
        'javascript:',
    ];
    const lower = val.toLowerCase();
    return !dangerous.some(keyword => lower.includes(keyword));
}, 'Potential prompt injection detected');
// Pagination validators
export const PaginationSchema = z.object({
    page: z.number().int().min(1).max(10000).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    cursor: z.string().max(500).optional(),
    sortBy: z.string().regex(/^[a-zA-Z0-9_]+$/).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    filter: z.record(z.any()).optional(),
});
// API request validators
export const PlanRequestSchema = z.object({
    prompt: PromptSchema,
    currentWorkflow: z.any().optional(), // Would be validated separately
    availableNodes: z.array(NodeTypeSchema).optional(),
    targetNode: NodeIdSchema.optional(),
});
export const GraphOperationRequestSchema = z.object({
    workflowId: WorkflowIdSchema,
    batch: OperationBatchSchema,
});
export const ValidateRequestSchema = z.object({
    workflow: z.any(), // Would be validated separately
    strict: z.boolean().optional(),
});
// File upload validators
export const FileUploadSchema = z.object({
    filename: SafePath,
    mimetype: z.enum([
        'application/json',
        'text/plain',
        'text/csv',
        'application/pdf',
    ]),
    size: z.number().max(10 * 1024 * 1024), // 10MB max
});
// Webhook validators
export const WebhookPathSchema = z.string()
    .regex(/^[a-zA-Z0-9\-_\/]+$/)
    .max(200)
    .transform(val => sanitizePath(val));
// Environment variable validators
export const EnvVarNameSchema = z.string()
    .regex(/^[A-Z_][A-Z0-9_]*$/)
    .max(100);
// JSON validators with depth limit
export function validateJsonDepth(obj, maxDepth = 10, currentDepth = 0) {
    if (currentDepth > maxDepth) {
        return false;
    }
    if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
            if (!validateJsonDepth(obj[key], maxDepth, currentDepth + 1)) {
                return false;
            }
        }
    }
    return true;
}
// Maximum size validators
export function validateObjectSize(obj, maxSize = 1024 * 1024) {
    const size = JSON.stringify(obj).length;
    return size <= maxSize;
}
// Rate limit key validator
export const RateLimitKeySchema = z.string()
    .max(200)
    .regex(/^[a-zA-Z0-9\-_:]+$/);
// Create a comprehensive request validator
export function createRequestValidator(schema) {
    return async (request) => {
        // Check request size
        if (request.body && !validateObjectSize(request.body, 5 * 1024 * 1024)) {
            throw new Error('Request body too large');
        }
        // Check JSON depth
        if (request.body && !validateJsonDepth(request.body)) {
            throw new Error('Request body too deep');
        }
        // Validate against schema
        return schema.parseAsync(request.body);
    };
}
// Export all validators
export const validators = {
    workflow: {
        id: WorkflowIdSchema,
        nodeId: NodeIdSchema,
        nodeType: NodeTypeSchema,
        position: NodePositionSchema,
        parameters: NodeParametersSchema,
        connection: ConnectionSchema,
    },
    operation: {
        type: OperationTypeSchema,
        single: OperationSchema,
        batch: OperationBatchSchema,
    },
    ai: {
        prompt: PromptSchema,
        planRequest: PlanRequestSchema,
    },
    api: {
        pagination: PaginationSchema,
        graphOperation: GraphOperationRequestSchema,
        validate: ValidateRequestSchema,
    },
    security: {
        fileUpload: FileUploadSchema,
        webhookPath: WebhookPathSchema,
        envVarName: EnvVarNameSchema,
        rateLimitKey: RateLimitKeySchema,
    },
    common: {
        uuid: UUID,
        email: Email,
        url: URL,
        positiveInt: PositiveInt,
        nonNegativeInt: NonNegativeInt,
        safeString: SafeString,
        safeSqlString: SafeSqlString,
        safePath: SafePath,
    },
};
