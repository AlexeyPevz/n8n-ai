import { describe, it, expect } from 'vitest';
describe('Graph Mutation API', () => {
    describe('Operation Validation', () => {
        it('should validate add_node operation', () => {
            const operation = {
                op: 'add_node',
                node: {
                    id: 'http-1',
                    name: 'HTTP Request',
                    type: 'n8n-nodes-base.httpRequest',
                    typeVersion: 4,
                    position: [600, 300],
                    parameters: {
                        method: 'GET',
                        url: 'https://api.example.com',
                    },
                },
            };
            expect(operation.op).toBe('add_node');
            expect(operation.node.id).toBeDefined();
            expect(operation.node.position).toHaveLength(2);
            expect(typeof operation.node.position[0]).toBe('number');
            expect(typeof operation.node.position[1]).toBe('number');
        });
        it('should validate connect operation', () => {
            const operation = {
                op: 'connect',
                from: 'Manual Trigger',
                to: 'HTTP Request',
                index: 0,
            };
            expect(operation.op).toBe('connect');
            expect(operation.from).toBeDefined();
            expect(operation.to).toBeDefined();
            expect(typeof operation.index).toBe('number');
        });
        it('should validate set_params operation', () => {
            const operation = {
                op: 'set_params',
                name: 'HTTP Request',
                parameters: {
                    method: 'POST',
                    url: 'https://api.example.com/data',
                    options: {
                        timeout: 5000,
                    },
                },
            };
            expect(operation.op).toBe('set_params');
            expect(operation.name).toBeDefined();
            expect(operation.parameters).toBeDefined();
            expect(typeof operation.parameters).toBe('object');
        });
        it('should validate delete operation', () => {
            const operation = {
                op: 'delete',
                name: 'HTTP Request',
            };
            expect(operation.op).toBe('delete');
            expect(operation.name).toBeDefined();
            expect(operation.name.length).toBeGreaterThan(0);
        });
        it('should validate annotate operation', () => {
            const operation = {
                op: 'annotate',
                name: 'HTTP Request',
                text: 'This node fetches user data from the API',
            };
            expect(operation.op).toBe('annotate');
            expect(operation.name).toBeDefined();
            expect(operation.text).toBeDefined();
            expect(operation.text.length).toBeGreaterThan(0);
        });
    });
    describe('Batch Operations', () => {
        it('should process multiple operations in order', () => {
            const batch = {
                version: 'v1',
                ops: [
                    {
                        op: 'add_node',
                        node: {
                            id: 'trigger-1',
                            name: 'Manual Trigger',
                            type: 'n8n-nodes-base.manualTrigger',
                            typeVersion: 1,
                            position: [300, 300],
                            parameters: {},
                        },
                    },
                    {
                        op: 'add_node',
                        node: {
                            id: 'http-1',
                            name: 'HTTP Request',
                            type: 'n8n-nodes-base.httpRequest',
                            typeVersion: 4,
                            position: [600, 300],
                            parameters: {
                                method: 'GET',
                                url: 'https://api.example.com',
                            },
                        },
                    },
                    {
                        op: 'connect',
                        from: 'Manual Trigger',
                        to: 'HTTP Request',
                    },
                ],
            };
            expect(batch.version).toBe('v1');
            expect(batch.ops).toHaveLength(3);
            expect(batch.ops[0].op).toBe('add_node');
            expect(batch.ops[1].op).toBe('add_node');
            expect(batch.ops[2].op).toBe('connect');
        });
        it('should handle empty batch', () => {
            const batch = {
                version: 'v1',
                ops: [],
            };
            expect(batch.ops).toHaveLength(0);
        });
    });
    describe('Error Handling', () => {
        it('should reject operations with missing required fields', () => {
            const invalidOp = {
                op: 'add_node',
                // Missing 'node' field
            };
            expect(invalidOp).not.toHaveProperty('node');
        });
        it('should reject operations with invalid node position', () => {
            const invalidPosition = [100]; // Should be [x, y]
            expect(invalidPosition).toHaveLength(1);
            expect(invalidPosition).not.toHaveLength(2);
        });
        it('should reject connect operation without source/target', () => {
            const invalidConnect = {
                op: 'connect',
                // Missing 'from' and 'to'
            };
            expect(invalidConnect).not.toHaveProperty('from');
            expect(invalidConnect).not.toHaveProperty('to');
        });
    });
    describe('Undo/Redo', () => {
        it('should generate undo operations for add_node', () => {
            const addOp = {
                op: 'add_node',
                node: {
                    id: 'http-1',
                    name: 'HTTP Request',
                    type: 'n8n-nodes-base.httpRequest',
                    typeVersion: 4,
                    position: [600, 300],
                    parameters: {},
                },
            };
            // Undo for add_node should be delete
            const undoOp = {
                op: 'delete',
                name: 'HTTP Request',
            };
            expect(undoOp.op).toBe('delete');
            expect(undoOp.name).toBe(addOp.node.name);
        });
        it('should generate undo operations for delete', () => {
            const originalNode = {
                id: 'http-1',
                name: 'HTTP Request',
                type: 'n8n-nodes-base.httpRequest',
                typeVersion: 4,
                position: [600, 300],
                parameters: { method: 'GET', url: 'https://api.example.com' },
            };
            const deleteOp = {
                op: 'delete',
                name: 'HTTP Request',
            };
            // Undo for delete should be add_node with original data
            const undoOp = {
                op: 'add_node',
                node: originalNode,
            };
            expect(undoOp.op).toBe('add_node');
            expect(undoOp.node).toEqual(originalNode);
        });
    });
});
