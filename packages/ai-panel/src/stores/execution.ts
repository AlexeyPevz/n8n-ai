import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { WorkflowExecution, NodeExecutionData } from '@/types/workflow';
import { useWorkflowStore } from './workflow';

export interface NodeExecutionState {
  nodeId: string;
  status: 'waiting' | 'running' | 'success' | 'error';
  startTime?: number;
  executionTime?: number;
  itemsProcessed?: number;
  progress?: number;
  data?: {
    input?: any[][];
    output?: any[][];
  };
  error?: {
    message: string;
    stack?: string;
  };
}

export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  nodeId?: string;
  data?: any;
}

export const useExecutionStore = defineStore('execution', () => {
  // State
  const currentExecution = ref<WorkflowExecution | null>(null);
  const nodeExecutions = ref<NodeExecutionState[]>([]);
  const logEntries = ref<LogEntry[]>([]);
  const isConnected = ref(false);
  const eventSource = ref<EventSource | null>(null);
  
  // Mock execution for demo
  const mockExecutionInterval = ref<NodeJS.Timer | null>(null);
  
  // Getters
  const isRunning = computed(() => 
    currentExecution.value?.status === 'running'
  );
  
  const executionProgress = computed(() => {
    if (!currentExecution.value || nodeExecutions.value.length === 0) return 0;
    
    const completed = nodeExecutions.value.filter(
      n => n.status === 'success' || n.status === 'error'
    ).length;
    
    return (completed / nodeExecutions.value.length) * 100;
  });
  
  // Actions
  async function startExecution(options: {
    workflowId: string;
    mode: 'manual' | 'trigger';
    data: any;
  }) {
    const workflowStore = useWorkflowStore();
    
    // Clear previous execution
    clearExecution();
    
    // Create new execution
    currentExecution.value = {
      id: `exec_${Date.now()}`,
      workflowId: options.workflowId,
      finished: false,
      mode: options.mode,
      startedAt: new Date().toISOString(),
      workflowData: options.data,
      data: {
        resultData: {
          runData: {},
        },
      },
      status: 'running',
    };
    
    // Initialize node executions
    nodeExecutions.value = workflowStore.nodes.map(node => ({
      nodeId: node.id,
      status: 'waiting',
    }));
    
    // Log start
    addLog('info', 'Workflow execution started');
    
    // Start mock execution (in real app, this would connect to backend)
    startMockExecution();
    
    // In real implementation, connect to SSE or WebSocket
    // connectToExecutionStream(currentExecution.value.id);
  }
  
  async function stopExecution() {
    if (!currentExecution.value) return;
    
    addLog('warning', 'Execution stopped by user');
    
    if (mockExecutionInterval.value) {
      clearInterval(mockExecutionInterval.value);
      mockExecutionInterval.value = null;
    }
    
    // Update execution status
    currentExecution.value.status = 'canceled';
    currentExecution.value.stoppedAt = new Date().toISOString();
    currentExecution.value.finished = true;
    
    // Update running nodes to canceled
    nodeExecutions.value.forEach(node => {
      if (node.status === 'running' || node.status === 'waiting') {
        node.status = 'error';
        node.error = { message: 'Execution canceled' };
      }
    });
  }
  
  function clearExecution() {
    currentExecution.value = null;
    nodeExecutions.value = [];
    logEntries.value = [];
    
    if (mockExecutionInterval.value) {
      clearInterval(mockExecutionInterval.value);
      mockExecutionInterval.value = null;
    }
  }
  
  function updateNodeExecution(nodeId: string, update: Partial<NodeExecutionState>) {
    const node = nodeExecutions.value.find(n => n.nodeId === nodeId);
    if (node) {
      Object.assign(node, update);
    }
  }
  
  function addLog(level: LogEntry['level'], message: string, nodeId?: string, data?: any) {
    logEntries.value.push({
      timestamp: new Date(),
      level,
      message,
      nodeId,
      data,
    });
  }
  
  function clearLog() {
    logEntries.value = [];
  }
  
  // Mock execution for demo
  function startMockExecution() {
    const workflowStore = useWorkflowStore();
    const nodes = workflowStore.nodes;
    let currentNodeIndex = 0;
    
    mockExecutionInterval.value = setInterval(() => {
      if (currentNodeIndex >= nodes.length) {
        // Execution complete
        completeExecution();
        return;
      }
      
      const node = nodes[currentNodeIndex];
      const nodeExec = nodeExecutions.value.find(n => n.nodeId === node.id);
      
      if (!nodeExec) return;
      
      if (nodeExec.status === 'waiting') {
        // Start node execution
        nodeExec.status = 'running';
        nodeExec.startTime = Date.now();
        addLog('info', `Executing node: ${node.name}`, node.id);
        
        // Simulate progress
        let progress = 0;
        const progressInterval = setInterval(() => {
          progress += 20;
          nodeExec.progress = Math.min(progress, 90);
          
          if (progress >= 100) {
            clearInterval(progressInterval);
          }
        }, 200);
      } else if (nodeExec.status === 'running' && nodeExec.startTime) {
        // Complete node execution
        const executionTime = Date.now() - nodeExec.startTime;
        
        // Simulate success/error (90% success rate)
        if (Math.random() > 0.1) {
          nodeExec.status = 'success';
          nodeExec.executionTime = executionTime;
          nodeExec.itemsProcessed = Math.floor(Math.random() * 10) + 1;
          nodeExec.data = {
            input: [[{ id: 1, name: 'Input Item' }]],
            output: [[
              { id: 1, name: 'Output Item', processed: true },
              { id: 2, name: 'Another Item', processed: true },
            ]],
          };
          addLog('success', `Node executed successfully (${nodeExec.itemsProcessed} items)`, node.id);
        } else {
          nodeExec.status = 'error';
          nodeExec.executionTime = executionTime;
          nodeExec.error = {
            message: 'Simulated error: Connection timeout',
            stack: 'Error: Connection timeout\n    at HTTPRequest.execute()\n    at WorkflowExecutor.run()',
          };
          addLog('error', `Node execution failed: ${nodeExec.error.message}`, node.id);
        }
        
        nodeExec.progress = 100;
        currentNodeIndex++;
      }
    }, 1000);
  }
  
  function completeExecution() {
    if (!currentExecution.value) return;
    
    if (mockExecutionInterval.value) {
      clearInterval(mockExecutionInterval.value);
      mockExecutionInterval.value = null;
    }
    
    const hasErrors = nodeExecutions.value.some(n => n.status === 'error');
    
    currentExecution.value.status = hasErrors ? 'error' : 'success';
    currentExecution.value.stoppedAt = new Date().toISOString();
    currentExecution.value.finished = true;
    
    const duration = new Date(currentExecution.value.stoppedAt).getTime() - 
                    new Date(currentExecution.value.startedAt).getTime();
    
    (currentExecution.value as any).duration = duration;
    
    addLog(
      hasErrors ? 'error' : 'success',
      `Workflow execution ${hasErrors ? 'failed' : 'completed'} in ${formatDuration(duration)}`
    );
  }
  
  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
  
  // SSE/WebSocket connection (for real implementation)
  function connectToExecutionStream(executionId: string) {
    const url = `/api/executions/${executionId}/stream`;
    
    eventSource.value = new EventSource(url);
    
    eventSource.value.onopen = () => {
      isConnected.value = true;
      addLog('info', 'Connected to execution stream');
    };
    
    eventSource.value.onerror = () => {
      isConnected.value = false;
      addLog('error', 'Lost connection to execution stream');
    };
    
    eventSource.value.addEventListener('node-start', (event) => {
      const data = JSON.parse(event.data);
      updateNodeExecution(data.nodeId, { status: 'running', startTime: Date.now() });
    });
    
    eventSource.value.addEventListener('node-complete', (event) => {
      const data = JSON.parse(event.data);
      updateNodeExecution(data.nodeId, {
        status: 'success',
        executionTime: data.executionTime,
        itemsProcessed: data.itemsProcessed,
        data: data.data,
      });
    });
    
    eventSource.value.addEventListener('node-error', (event) => {
      const data = JSON.parse(event.data);
      updateNodeExecution(data.nodeId, {
        status: 'error',
        error: data.error,
      });
    });
    
    eventSource.value.addEventListener('execution-complete', (event) => {
      const data = JSON.parse(event.data);
      if (currentExecution.value) {
        currentExecution.value.status = data.status;
        currentExecution.value.finished = true;
        currentExecution.value.stoppedAt = data.stoppedAt;
      }
      disconnectStream();
    });
  }
  
  function disconnectStream() {
    if (eventSource.value) {
      eventSource.value.close();
      eventSource.value = null;
    }
    isConnected.value = false;
  }
  
  return {
    // State
    currentExecution,
    nodeExecutions,
    logEntries,
    isConnected,
    
    // Getters
    isRunning,
    executionProgress,
    
    // Actions
    startExecution,
    stopExecution,
    clearExecution,
    updateNodeExecution,
    addLog,
    clearLog,
  };
});