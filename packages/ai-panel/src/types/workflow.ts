export interface Node {
  id: string;
  name: string;
  type: string;
  typeVersion?: number;
  position: [number, number];
  parameters: Record<string, any>;
  credentials?: Record<string, string>;
  disabled?: boolean;
  notes?: string;
  color?: string;
  issues?: NodeIssue[];
  status?: NodeExecutionStatus;
}

export interface Connection {
  from: string;
  to: string;
  fromIndex?: number;
  toIndex?: number;
}

export interface NodeIssue {
  type: 'error' | 'warning';
  message: string;
  property?: string;
}

export interface NodeExecutionStatus {
  execution?: 'waiting' | 'running' | 'success' | 'error';
  itemsProcessed?: number;
  executionTime?: number;
  error?: string;
}

export interface Workflow {
  id: string;
  name: string;
  active: boolean;
  nodes: Node[];
  connections: Connection[];
  settings?: WorkflowSettings;
  staticData?: Record<string, any>;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowSettings {
  errorWorkflow?: string;
  timezone?: string;
  saveExecutionProgress?: boolean;
  saveManualExecutions?: boolean;
  saveDataErrorExecution?: string;
  saveDataSuccessExecution?: string;
  executionTimeout?: number;
  maxExecutionTimeout?: number;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  finished: boolean;
  mode: 'manual' | 'trigger' | 'webhook' | 'internal';
  startedAt: string;
  stoppedAt?: string;
  workflowData: Workflow;
  data: ExecutionData;
  status: 'running' | 'success' | 'error' | 'canceled';
}

export interface ExecutionData {
  startData?: any;
  resultData: {
    runData: Record<string, NodeExecutionData[]>;
    error?: any;
  };
  executionData?: {
    contextData: Record<string, any>;
    nodeExecutionStack: any[];
    waitingExecution: Record<string, any>;
  };
}

export interface NodeExecutionData {
  startTime: number;
  executionTime: number;
  executionStatus: 'success' | 'error';
  data?: {
    main: any[][];
  };
  error?: any;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  workflow: Partial<Workflow>;
  categories?: string[];
  icon?: string;
}