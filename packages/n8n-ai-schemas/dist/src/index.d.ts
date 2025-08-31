import { z } from 'zod';
export declare const NodeParameterSchema: z.ZodRecord<z.ZodString, z.ZodAny>;
export declare const NodeSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    type: z.ZodString;
    typeVersion: z.ZodNumber;
    position: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
    parameters: z.ZodRecord<z.ZodString, z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    type: string;
    typeVersion: number;
    position: [number, number];
    parameters: Record<string, any>;
}, {
    id: string;
    name: string;
    type: string;
    typeVersion: number;
    position: [number, number];
    parameters: Record<string, any>;
}>;
export declare const ConnectionSchema: z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
    index: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    to: string;
    from: string;
    index?: number | undefined;
}, {
    to: string;
    from: string;
    index?: number | undefined;
}>;
export declare const GraphSchema: z.ZodObject<{
    nodes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodString;
        typeVersion: z.ZodNumber;
        position: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
        parameters: z.ZodRecord<z.ZodString, z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        type: string;
        typeVersion: number;
        position: [number, number];
        parameters: Record<string, any>;
    }, {
        id: string;
        name: string;
        type: string;
        typeVersion: number;
        position: [number, number];
        parameters: Record<string, any>;
    }>, "many">;
    connections: z.ZodArray<z.ZodObject<{
        from: z.ZodString;
        to: z.ZodString;
        index: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        to: string;
        from: string;
        index?: number | undefined;
    }, {
        to: string;
        from: string;
        index?: number | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    nodes: {
        id: string;
        name: string;
        type: string;
        typeVersion: number;
        position: [number, number];
        parameters: Record<string, any>;
    }[];
    connections: {
        to: string;
        from: string;
        index?: number | undefined;
    }[];
}, {
    nodes: {
        id: string;
        name: string;
        type: string;
        typeVersion: number;
        position: [number, number];
        parameters: Record<string, any>;
    }[];
    connections: {
        to: string;
        from: string;
        index?: number | undefined;
    }[];
}>;
export declare const OperationAddNode: z.ZodObject<{
    op: z.ZodLiteral<"add_node">;
    node: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodString;
        typeVersion: z.ZodNumber;
        position: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
        parameters: z.ZodRecord<z.ZodString, z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        type: string;
        typeVersion: number;
        position: [number, number];
        parameters: Record<string, any>;
    }, {
        id: string;
        name: string;
        type: string;
        typeVersion: number;
        position: [number, number];
        parameters: Record<string, any>;
    }>;
}, "strip", z.ZodTypeAny, {
    node: {
        id: string;
        name: string;
        type: string;
        typeVersion: number;
        position: [number, number];
        parameters: Record<string, any>;
    };
    op: "add_node";
}, {
    node: {
        id: string;
        name: string;
        type: string;
        typeVersion: number;
        position: [number, number];
        parameters: Record<string, any>;
    };
    op: "add_node";
}>;
export declare const OperationSetParams: z.ZodObject<{
    op: z.ZodLiteral<"set_params">;
    name: z.ZodString;
    parameters: z.ZodRecord<z.ZodString, z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    name: string;
    parameters: Record<string, any>;
    op: "set_params";
}, {
    name: string;
    parameters: Record<string, any>;
    op: "set_params";
}>;
export declare const OperationConnect: z.ZodObject<{
    op: z.ZodLiteral<"connect">;
    from: z.ZodString;
    to: z.ZodString;
    index: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    to: string;
    from: string;
    op: "connect";
    index?: number | undefined;
}, {
    to: string;
    from: string;
    op: "connect";
    index?: number | undefined;
}>;
export declare const OperationDelete: z.ZodObject<{
    op: z.ZodLiteral<"delete">;
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    op: "delete";
}, {
    name: string;
    op: "delete";
}>;
export declare const OperationAnnotate: z.ZodObject<{
    op: z.ZodLiteral<"annotate">;
    name: z.ZodString;
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    op: "annotate";
    text: string;
}, {
    name: string;
    op: "annotate";
    text: string;
}>;
export declare const OperationBatchSchema: z.ZodObject<{
    ops: z.ZodArray<z.ZodDiscriminatedUnion<"op", [z.ZodObject<{
        op: z.ZodLiteral<"add_node">;
        node: z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            type: z.ZodString;
            typeVersion: z.ZodNumber;
            position: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
            parameters: z.ZodRecord<z.ZodString, z.ZodAny>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            name: string;
            type: string;
            typeVersion: number;
            position: [number, number];
            parameters: Record<string, any>;
        }, {
            id: string;
            name: string;
            type: string;
            typeVersion: number;
            position: [number, number];
            parameters: Record<string, any>;
        }>;
    }, "strip", z.ZodTypeAny, {
        node: {
            id: string;
            name: string;
            type: string;
            typeVersion: number;
            position: [number, number];
            parameters: Record<string, any>;
        };
        op: "add_node";
    }, {
        node: {
            id: string;
            name: string;
            type: string;
            typeVersion: number;
            position: [number, number];
            parameters: Record<string, any>;
        };
        op: "add_node";
    }>, z.ZodObject<{
        op: z.ZodLiteral<"set_params">;
        name: z.ZodString;
        parameters: z.ZodRecord<z.ZodString, z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        parameters: Record<string, any>;
        op: "set_params";
    }, {
        name: string;
        parameters: Record<string, any>;
        op: "set_params";
    }>, z.ZodObject<{
        op: z.ZodLiteral<"connect">;
        from: z.ZodString;
        to: z.ZodString;
        index: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        to: string;
        from: string;
        op: "connect";
        index?: number | undefined;
    }, {
        to: string;
        from: string;
        op: "connect";
        index?: number | undefined;
    }>, z.ZodObject<{
        op: z.ZodLiteral<"delete">;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        op: "delete";
    }, {
        name: string;
        op: "delete";
    }>, z.ZodObject<{
        op: z.ZodLiteral<"annotate">;
        name: z.ZodString;
        text: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        op: "annotate";
        text: string;
    }, {
        name: string;
        op: "annotate";
        text: string;
    }>]>, "many">;
    version: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    ops: ({
        node: {
            id: string;
            name: string;
            type: string;
            typeVersion: number;
            position: [number, number];
            parameters: Record<string, any>;
        };
        op: "add_node";
    } | {
        name: string;
        parameters: Record<string, any>;
        op: "set_params";
    } | {
        to: string;
        from: string;
        op: "connect";
        index?: number | undefined;
    } | {
        name: string;
        op: "delete";
    } | {
        name: string;
        op: "annotate";
        text: string;
    })[];
    version: string;
}, {
    ops: ({
        node: {
            id: string;
            name: string;
            type: string;
            typeVersion: number;
            position: [number, number];
            parameters: Record<string, any>;
        };
        op: "add_node";
    } | {
        name: string;
        parameters: Record<string, any>;
        op: "set_params";
    } | {
        to: string;
        from: string;
        op: "connect";
        index?: number | undefined;
    } | {
        name: string;
        op: "delete";
    } | {
        name: string;
        op: "annotate";
        text: string;
    })[];
    version?: string | undefined;
}>;
export declare const LintSchema: z.ZodObject<{
    code: z.ZodString;
    level: z.ZodEnum<["info", "warn", "error"]>;
    message: z.ZodString;
    node: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code: string;
    message: string;
    level: "info" | "warn" | "error";
    node?: string | undefined;
}, {
    code: string;
    message: string;
    level: "info" | "warn" | "error";
    node?: string | undefined;
}>;
export type Node = z.infer<typeof NodeSchema>;
export type Graph = z.infer<typeof GraphSchema>;
export type OperationBatch = z.infer<typeof OperationBatchSchema>;
export type Lint = z.infer<typeof LintSchema>;
//# sourceMappingURL=index.d.ts.map