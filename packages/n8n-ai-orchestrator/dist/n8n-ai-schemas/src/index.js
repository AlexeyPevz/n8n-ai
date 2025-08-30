import { z } from 'zod';
export const NodeParameterSchema = z.record(z.any());
export const NodeSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: z.string().min(1),
    typeVersion: z.number().int().min(1),
    position: z.tuple([z.number(), z.number()]),
    parameters: NodeParameterSchema
});
export const ConnectionSchema = z.object({
    from: z.string().min(1),
    to: z.string().min(1),
    index: z.number().int().min(0).optional()
});
export const GraphSchema = z.object({
    nodes: z.array(NodeSchema),
    connections: z.array(ConnectionSchema)
});
export const OperationAddNode = z.object({
    op: z.literal('add_node'),
    node: NodeSchema
});
export const OperationSetParams = z.object({
    op: z.literal('set_params'),
    name: z.string().min(1),
    parameters: NodeParameterSchema
});
export const OperationConnect = z.object({
    op: z.literal('connect'),
    from: z.string().min(1),
    to: z.string().min(1),
    index: z.number().int().min(0).optional()
});
export const OperationDelete = z.object({
    op: z.literal('delete'),
    name: z.string().min(1)
});
export const OperationAnnotate = z.object({
    op: z.literal('annotate'),
    name: z.string().min(1),
    text: z.string().min(1)
});
export const OperationBatchSchema = z.object({
    ops: z.array(z.discriminatedUnion('op', [
        OperationAddNode,
        OperationSetParams,
        OperationConnect,
        OperationDelete,
        OperationAnnotate
    ])),
    version: z.string().default('v1')
});
export const LintSchema = z.object({
    code: z.string(),
    level: z.enum(['info', 'warn', 'error']),
    message: z.string(),
    node: z.string().optional()
});
