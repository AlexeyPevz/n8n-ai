export interface MapNode {
  id: string;
  name: string;
  type: 'workflow' | 'webhook' | 'external';
  metadata?: Record<string, any>;
  x?: number;
  y?: number;
  status?: 'running' | 'success' | 'error' | 'waiting';
}

export interface MapEdge {
  source: string;
  target: string;
  type: 'execute_workflow' | 'http_webhook' | 'trigger_webhook';
  probability?: number;
  metadata?: Record<string, any>;
}

export interface MapData {
  nodes: MapNode[];
  edges: MapEdge[];
  stats: {
    totalWorkflows: number;
    totalConnections: number;
    executeWorkflowCoverage: number;
    httpWebhookCoverage: number;
  };
  generatedAt: string;
}