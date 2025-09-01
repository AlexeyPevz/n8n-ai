import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Node, Connection } from '@/types/workflow';

export const useWorkflowStore = defineStore('workflow', () => {
  // State
  const nodes = ref<Node[]>([]);
  const connections = ref<Connection[]>([]);
  const selectedNodeId = ref<string | null>(null);
  const workflowId = ref<string>('');
  const workflowName = ref<string>('Untitled Workflow');
  const isDirty = ref(false);
  
  // History for undo/redo
  const history = ref<{ nodes: Node[]; connections: Connection[] }[]>([]);
  const historyIndex = ref(-1);
  const maxHistorySize = 50;
  
  // Getters
  const nodeById = computed(() => {
    const map = new Map<string, Node>();
    nodes.value.forEach(node => map.set(node.id, node));
    return map;
  });
  
  const selectedNode = computed(() => 
    selectedNodeId.value ? nodeById.value.get(selectedNodeId.value) : null
  );
  
  const canUndo = computed(() => historyIndex.value > 0);
  const canRedo = computed(() => historyIndex.value < history.value.length - 1);
  
  // Actions
  function addNode(nodeData: Partial<Node>) {
    const node: Node = {
      id: generateNodeId(),
      name: nodeData.name || `${nodeData.type}_${nodes.value.length + 1}`,
      type: nodeData.type || 'n8n-nodes-base.noOp',
      position: nodeData.position || [100, 100],
      parameters: nodeData.parameters || {},
      ...nodeData,
    };
    
    nodes.value.push(node);
    saveToHistory();
    isDirty.value = true;
    
    return node;
  }
  
  function updateNode(nodeId: string, updates: Partial<Node>) {
    const node = nodeById.value.get(nodeId);
    if (node) {
      Object.assign(node, updates);
      saveToHistory();
      isDirty.value = true;
    }
  }
  
  function updateNodePosition(nodeId: string, position: [number, number]) {
    const node = nodeById.value.get(nodeId);
    if (node) {
      node.position = position;
      isDirty.value = true;
    }
  }
  
  function deleteNode(nodeId: string) {
    nodes.value = nodes.value.filter(n => n.id !== nodeId);
    connections.value = connections.value.filter(
      c => c.from !== nodeId && c.to !== nodeId
    );
    
    if (selectedNodeId.value === nodeId) {
      selectedNodeId.value = null;
    }
    
    saveToHistory();
    isDirty.value = true;
  }
  
  function duplicateNode(nodeId: string) {
    const node = nodeById.value.get(nodeId);
    if (node) {
      const newNode = {
        ...node,
        id: generateNodeId(),
        name: `${node.name}_copy`,
        position: [node.position[0] + 50, node.position[1] + 50] as [number, number],
      };
      
      nodes.value.push(newNode);
      saveToHistory();
      isDirty.value = true;
      
      return newNode;
    }
  }
  
  function addConnection(connection: Connection) {
    // Check if connection already exists
    const exists = connections.value.some(
      c => c.from === connection.from && 
           c.to === connection.to &&
           c.fromIndex === connection.fromIndex &&
           c.toIndex === connection.toIndex
    );
    
    if (!exists) {
      connections.value.push(connection);
      saveToHistory();
      isDirty.value = true;
    }
  }
  
  function deleteConnection(connection: Connection) {
    connections.value = connections.value.filter(
      c => !(c.from === connection.from && 
             c.to === connection.to &&
             c.fromIndex === connection.fromIndex &&
             c.toIndex === connection.toIndex)
    );
    
    saveToHistory();
    isDirty.value = true;
  }
  
  function selectNode(nodeId: string | null) {
    selectedNodeId.value = nodeId;
  }
  
  function clearWorkflow() {
    nodes.value = [];
    connections.value = [];
    selectedNodeId.value = null;
    history.value = [];
    historyIndex.value = -1;
    isDirty.value = false;
  }
  
  function loadWorkflow(data: {
    id: string;
    name: string;
    nodes: Node[];
    connections: Connection[];
  }) {
    workflowId.value = data.id;
    workflowName.value = data.name;
    nodes.value = data.nodes;
    connections.value = data.connections;
    selectedNodeId.value = null;
    history.value = [];
    historyIndex.value = -1;
    isDirty.value = false;
    
    saveToHistory();
  }
  
  function saveWorkflow() {
    // In real implementation, this would save to backend
    isDirty.value = false;
    
    return {
      id: workflowId.value,
      name: workflowName.value,
      nodes: nodes.value,
      connections: connections.value,
    };
  }
  
  // History management
  function saveToHistory() {
    // Remove any history after current index
    history.value = history.value.slice(0, historyIndex.value + 1);
    
    // Add new state
    history.value.push({
      nodes: JSON.parse(JSON.stringify(nodes.value)),
      connections: JSON.parse(JSON.stringify(connections.value)),
    });
    
    // Limit history size
    if (history.value.length > maxHistorySize) {
      history.value.shift();
    } else {
      historyIndex.value++;
    }
  }
  
  function undo() {
    if (canUndo.value) {
      historyIndex.value--;
      const state = history.value[historyIndex.value];
      nodes.value = JSON.parse(JSON.stringify(state.nodes));
      connections.value = JSON.parse(JSON.stringify(state.connections));
    }
  }
  
  function redo() {
    if (canRedo.value) {
      historyIndex.value++;
      const state = history.value[historyIndex.value];
      nodes.value = JSON.parse(JSON.stringify(state.nodes));
      connections.value = JSON.parse(JSON.stringify(state.connections));
    }
  }
  
  // Utilities
  function generateNodeId(): string {
    return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  function getNodeConnections(nodeId: string) {
    return {
      inputs: connections.value.filter(c => c.to === nodeId),
      outputs: connections.value.filter(c => c.from === nodeId),
    };
  }
  
  function validateWorkflow() {
    const errors: string[] = [];
    
    // Check for nodes without connections
    nodes.value.forEach(node => {
      const { inputs, outputs } = getNodeConnections(node.id);
      if (inputs.length === 0 && outputs.length === 0) {
        errors.push(`Node "${node.name}" is not connected`);
      }
    });
    
    // Check for circular dependencies
    // ... implementation
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  return {
    // State
    nodes,
    connections,
    selectedNodeId,
    workflowId,
    workflowName,
    isDirty,
    
    // Getters
    nodeById,
    selectedNode,
    canUndo,
    canRedo,
    
    // Actions
    addNode,
    updateNode,
    updateNodePosition,
    deleteNode,
    duplicateNode,
    addConnection,
    deleteConnection,
    selectNode,
    clearWorkflow,
    loadWorkflow,
    saveWorkflow,
    undo,
    redo,
    getNodeConnections,
    validateWorkflow,
  };
});