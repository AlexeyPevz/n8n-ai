export interface WorkflowIntrospectAPI {
  getWorkflows(): Promise<Array<{ id: string; name: string }>>;
  getWorkflow(id: string): Promise<any | null>;
}

