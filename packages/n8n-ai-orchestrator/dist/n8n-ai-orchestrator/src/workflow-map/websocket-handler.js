// ws module is shimmed in shims.d.ts
import WebSocket from 'ws';
import { z } from 'zod';
// Message schemas
const WorkflowStatusMessageSchema = z.object({
    type: z.literal('workflow_status'),
    workflowId: z.string(),
    status: z.enum(['running', 'success', 'error', 'waiting']),
    timestamp: z.string().datetime(),
});
const NodeStatusMessageSchema = z.object({
    type: z.literal('node_status'),
    workflowId: z.string(),
    nodeId: z.string(),
    status: z.enum(['running', 'success', 'error', 'waiting', 'skipped']),
    executionTime: z.number().optional(),
    itemsProcessed: z.number().optional(),
    error: z.string().optional(),
    timestamp: z.string().datetime(),
});
const CostUpdateMessageSchema = z.object({
    type: z.literal('cost_update'),
    workflowId: z.string(),
    nodeId: z.string().optional(),
    cost: z.number(),
    costType: z.enum(['tokens', 'api_calls', 'execution_time']),
    timestamp: z.string().datetime(),
});
const ConnectionStatusMessageSchema = z.object({
    type: z.literal('connection_status'),
    sourceWorkflowId: z.string(),
    targetWorkflowId: z.string(),
    active: z.boolean(),
    throughput: z.number().optional(), // items per second
    timestamp: z.string().datetime(),
});
const LiveMessageSchema = z.union([
    WorkflowStatusMessageSchema,
    NodeStatusMessageSchema,
    CostUpdateMessageSchema,
    ConnectionStatusMessageSchema,
]);
export class WorkflowMapWebSocketHandler {
    server;
    clients = new Map();
    workflowSubscribers = new Map();
    constructor(server) {
        this.server = server;
    }
    /**
     * Initialize WebSocket handler
     */
    async initialize() {
        // Register WebSocket route
        await this.server.register(async (fastify) => {
            fastify.get('/live', { websocket: true }, (connection, req) => {
                const { socket } = connection;
                // Create client
                const client = {
                    ws: socket,
                    subscriptions: new Set(),
                    isAlive: true,
                };
                this.clients.set(socket, client);
                // Send initial connection message
                socket.send(JSON.stringify({
                    type: 'connected',
                    timestamp: new Date().toISOString(),
                }));
                // Handle messages
                socket.on('message', (message) => {
                    try {
                        const data = JSON.parse(message.toString());
                        this.handleClientMessage(socket, data);
                    }
                    catch (error) {
                        socket.send(JSON.stringify({
                            type: 'error',
                            error: 'Invalid message format',
                        }));
                    }
                });
                // Handle pong for keepalive
                socket.on('pong', () => {
                    const client = this.clients.get(socket);
                    if (client) {
                        client.isAlive = true;
                    }
                });
                // Handle disconnect
                socket.on('close', () => {
                    this.handleDisconnect(socket);
                });
                socket.on('error', (error) => {
                    req.log.error(error, 'WebSocket error');
                    this.handleDisconnect(socket);
                });
            });
        });
        // Start heartbeat interval
        this.startHeartbeat();
    }
    /**
     * Handle client messages
     */
    handleClientMessage(ws, data) {
        const client = this.clients.get(ws);
        if (!client)
            return;
        switch (data.type) {
            case 'subscribe':
                this.handleSubscribe(client, data.workflowIds || []);
                break;
            case 'unsubscribe':
                this.handleUnsubscribe(client, data.workflowIds || []);
                break;
            case 'ping':
                ws.send(JSON.stringify({ type: 'pong' }));
                break;
            default:
                ws.send(JSON.stringify({
                    type: 'error',
                    error: `Unknown message type: ${data.type}`,
                }));
        }
    }
    /**
     * Handle workflow subscriptions
     */
    handleSubscribe(client, workflowIds) {
        for (const workflowId of workflowIds) {
            // Add to client subscriptions
            client.subscriptions.add(workflowId);
            // Add to workflow subscribers
            if (!this.workflowSubscribers.has(workflowId)) {
                this.workflowSubscribers.set(workflowId, new Set());
            }
            this.workflowSubscribers.get(workflowId).add(client.ws);
        }
        // Send confirmation
        client.ws.send(JSON.stringify({
            type: 'subscribed',
            workflowIds,
            timestamp: new Date().toISOString(),
        }));
        // Send current status for subscribed workflows
        this.sendCurrentStatus(client, workflowIds);
    }
    /**
     * Handle workflow unsubscriptions
     */
    handleUnsubscribe(client, workflowIds) {
        for (const workflowId of workflowIds) {
            // Remove from client subscriptions
            client.subscriptions.delete(workflowId);
            // Remove from workflow subscribers
            const subscribers = this.workflowSubscribers.get(workflowId);
            if (subscribers) {
                subscribers.delete(client.ws);
                if (subscribers.size === 0) {
                    this.workflowSubscribers.delete(workflowId);
                }
            }
        }
        // Send confirmation
        client.ws.send(JSON.stringify({
            type: 'unsubscribed',
            workflowIds,
            timestamp: new Date().toISOString(),
        }));
    }
    /**
     * Handle client disconnect
     */
    handleDisconnect(ws) {
        const client = this.clients.get(ws);
        if (!client)
            return;
        // Remove from all workflow subscribers
        for (const workflowId of client.subscriptions) {
            const subscribers = this.workflowSubscribers.get(workflowId);
            if (subscribers) {
                subscribers.delete(ws);
                if (subscribers.size === 0) {
                    this.workflowSubscribers.delete(workflowId);
                }
            }
        }
        // Remove client
        this.clients.delete(ws);
    }
    /**
     * Send current status for workflows
     */
    async sendCurrentStatus(client, workflowIds) {
        // Send current status for requested workflows
        for (const workflowId of workflowIds) {
            // In production, this would fetch actual status from execution engine
            const statusMessage = {
                type: 'workflow_status',
                workflowId,
                status: 'waiting',
                timestamp: new Date().toISOString(),
            };
            try {
                client.ws.send(JSON.stringify(statusMessage));
            }
            catch (error) {
                // Client disconnected, will be cleaned up on next ping
            }
        }
    }
    /**
     * Broadcast message to workflow subscribers
     */
    broadcastToWorkflow(workflowId, message) {
        const subscribers = this.workflowSubscribers.get(workflowId);
        if (!subscribers)
            return;
        const messageStr = JSON.stringify(message);
        for (const ws of subscribers) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(messageStr);
            }
        }
    }
    /**
     * Broadcast message to all clients
     */
    broadcastToAll(message) {
        const messageStr = JSON.stringify(message);
        for (const client of this.clients.values()) {
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(messageStr);
            }
        }
    }
    /**
     * Start heartbeat to detect disconnected clients
     */
    startHeartbeat() {
        setInterval(() => {
            for (const [ws, client] of this.clients) {
                if (!client.isAlive) {
                    // Client didn't respond to last ping
                    ws.terminate?.();
                    this.handleDisconnect(ws);
                }
                else {
                    // Send ping
                    client.isAlive = false;
                    ws.ping?.();
                }
            }
        }, 30000); // 30 seconds
    }
    /**
     * Emit workflow status update
     */
    emitWorkflowStatus(workflowId, status) {
        const message = {
            type: 'workflow_status',
            workflowId,
            status,
            timestamp: new Date().toISOString(),
        };
        this.broadcastToWorkflow(workflowId, message);
    }
    /**
     * Emit node status update
     */
    emitNodeStatus(workflowId, nodeId, status, details) {
        const message = {
            type: 'node_status',
            workflowId,
            nodeId,
            status,
            ...details,
            timestamp: new Date().toISOString(),
        };
        this.broadcastToWorkflow(workflowId, message);
    }
    /**
     * Emit cost update
     */
    emitCostUpdate(workflowId, cost, costType, nodeId) {
        const message = {
            type: 'cost_update',
            workflowId,
            nodeId,
            cost,
            costType,
            timestamp: new Date().toISOString(),
        };
        this.broadcastToWorkflow(workflowId, message);
    }
    /**
     * Emit connection status update
     */
    emitConnectionStatus(sourceWorkflowId, targetWorkflowId, active, throughput) {
        const message = {
            type: 'connection_status',
            sourceWorkflowId,
            targetWorkflowId,
            active,
            throughput,
            timestamp: new Date().toISOString(),
        };
        // Broadcast to both workflows
        this.broadcastToWorkflow(sourceWorkflowId, message);
        this.broadcastToWorkflow(targetWorkflowId, message);
    }
}
