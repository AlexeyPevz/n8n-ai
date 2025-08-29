import { z } from "zod";
export declare const NodeParameterSchema: z.ZodRecord<z.ZodString, z.ZodAny>;
export declare const NodeSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    type: z.ZodString;
    typeVersion: z.ZodNumber;
    position: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
    parameters: z.ZodRecord<z.ZodString, z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    type: string;
    id: string;
    name: string;
    typeVersion: number;
    position: [number, number];
    parameters: Record<string, any>;
}, {
    type: string;
    id: string;
    name: string;
    typeVersion: number;
    position: [number, number];
    parameters: Record<string, any>;
}>;
export declare const ConnectionSchema: z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
    index: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    from: string;
    to: string;
    index?: number | undefined;
}, {
    from: string;
    to: string;
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
        type: string;
        id: string;
        name: string;
        typeVersion: number;
        position: [number, number];
        parameters: Record<string, any>;
    }, {
        type: string;
        id: string;
        name: string;
        typeVersion: number;
        position: [number, number];
        parameters: Record<string, any>;
    }>, "many">;
    connections: z.ZodArray<z.ZodObject<{
        from: z.ZodString;
        to: z.ZodString;
        index: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        from: string;
        to: string;
        index?: number | undefined;
    }, {
        from: string;
        to: string;
        index?: number | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    nodes: {
        type: string;
        id: string;
        name: string;
        typeVersion: number;
        position: [number, number];
        parameters: Record<string, any>;
    }[];
    connections: {
        from: string;
        to: string;
        index?: number | undefined;
    }[];
}, {
    nodes: {
        type: string;
        id: string;
        name: string;
        typeVersion: number;
        position: [number, number];
        parameters: Record<string, any>;
    }[];
    connections: {
        from: string;
        to: string;
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
        type: string;
        id: string;
        name: string;
        typeVersion: number;
        position: [number, number];
        parameters: Record<string, any>;
    }, {
        type: string;
        id: string;
        name: string;
        typeVersion: number;
        position: [number, number];
        parameters: Record<string, any>;
    }>;
}, "strip", z.ZodTypeAny, {
    op: "add_node";
    node: {
        type: string;
        id: string;
        name: string;
        typeVersion: number;
        position: [number, number];
        parameters: Record<string, any>;
    };
}, {
    op: "add_node";
    node: {
        type: string;
        id: string;
        name: string;
        typeVersion: number;
        position: [number, number];
        parameters: Record<string, any>;
    };
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
    from: string;
    to: string;
    op: "connect";
    index?: number | undefined;
}, {
    from: string;
    to: string;
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
            type: string;
            id: string;
            name: string;
            typeVersion: number;
            position: [number, number];
            parameters: Record<string, any>;
        }, {
            type: string;
            id: string;
            name: string;
            typeVersion: number;
            position: [number, number];
            parameters: Record<string, any>;
        }>;
    }, "strip", z.ZodTypeAny, {
        op: "add_node";
        node: {
            type: string;
            id: string;
            name: string;
            typeVersion: number;
            position: [number, number];
            parameters: Record<string, any>;
        };
    }, {
        op: "add_node";
        node: {
            type: string;
            id: string;
            name: string;
            typeVersion: number;
            position: [number, number];
            parameters: Record<string, any>;
        };
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
        from: string;
        to: string;
        op: "connect";
        index?: number | undefined;
    }, {
        from: string;
        to: string;
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
        op: "add_node";
        node: {
            type: string;
            id: string;
            name: string;
            typeVersion: number;
            position: [number, number];
            parameters: Record<string, any>;
        };
    } | {
        name: string;
        parameters: Record<string, any>;
        op: "set_params";
    } | {
        from: string;
        to: string;
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
        op: "add_node";
        node: {
            type: string;
            id: string;
            name: string;
            typeVersion: number;
            position: [number, number];
            parameters: Record<string, any>;
        };
    } | {
        name: string;
        parameters: Record<string, any>;
        op: "set_params";
    } | {
        from: string;
        to: string;
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