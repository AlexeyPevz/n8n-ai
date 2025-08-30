import { describe, it, expect } from 'vitest';
import { graphManager } from './graph-manager';
describe('Graph ops unit', () => {
    it('connect/set_params/delete/annotate work as expected', () => {
        const id = 'unit-ops';
        graphManager.createWorkflow(id, 'Unit Ops WF');
        // add node via batch
        const add = graphManager.applyBatch(id, {
            version: 'v1',
            ops: [{
                    op: 'add_node',
                    node: {
                        id: 'http-1',
                        name: 'HTTP Request',
                        type: 'n8n-nodes-base.httpRequest',
                        typeVersion: 4,
                        position: [600, 300],
                        parameters: { method: 'GET', url: 'https://example.com', responseFormat: 'json' }
                    }
                }]
        });
        expect(add.success).toBe(true);
        // connect
        const conn = graphManager.applyBatch(id, {
            version: 'v1',
            ops: [{ op: 'connect', from: 'Manual Trigger', to: 'HTTP Request', index: 0 }]
        });
        expect(conn.success).toBe(true);
        // set_params
        const setp = graphManager.applyBatch(id, {
            version: 'v1',
            ops: [{ op: 'set_params', name: 'HTTP Request', parameters: { timeout: 5000 } }]
        });
        expect(setp.success).toBe(true);
        // annotate
        const ann = graphManager.applyBatch(id, {
            version: 'v1',
            ops: [{ op: 'annotate', name: 'HTTP Request', text: 'unit test' }]
        });
        expect(ann.success).toBe(true);
        // delete
        const del = graphManager.applyBatch(id, {
            version: 'v1',
            ops: [{ op: 'delete', name: 'HTTP Request' }]
        });
        expect(del.success).toBe(true);
        const wf = graphManager.getWorkflow(id);
        expect(wf.nodes.find(n => n.name === 'HTTP Request')).toBeUndefined();
    });
});
