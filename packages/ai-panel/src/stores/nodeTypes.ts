import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface NodeType {
  name: string;
  displayName: string;
  group: string;
  version: number;
  description?: string;
  icon?: string;
  color?: string;
  inputs: string[];
  outputs: string[];
  properties?: any[];
  credentials?: string[];
}

export const useNodeTypesStore = defineStore('nodeTypes', () => {
  // State
  const nodeTypes = ref<Map<string, NodeType>>(new Map());
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  
  // Initialize with common n8n nodes
  const commonNodes: NodeType[] = [
    // Input nodes
    {
      name: 'n8n-nodes-base.httpRequest',
      displayName: 'HTTP Request',
      group: 'input',
      version: 1,
      description: 'Make HTTP requests',
      icon: 'http.svg',
      inputs: ['main'],
      outputs: ['main'],
    },
    {
      name: 'n8n-nodes-base.webhook',
      displayName: 'Webhook',
      group: 'input',
      version: 1,
      description: 'Receive data via webhook',
      icon: 'webhook.svg',
      inputs: [],
      outputs: ['main'],
    },
    {
      name: 'n8n-nodes-base.readBinaryFile',
      displayName: 'Read Binary File',
      group: 'input',
      version: 1,
      description: 'Read a file from disk',
      icon: 'file.svg',
      inputs: ['main'],
      outputs: ['main'],
    },
    
    // Output nodes
    {
      name: 'n8n-nodes-base.writeBinaryFile',
      displayName: 'Write Binary File',
      group: 'output',
      version: 1,
      description: 'Write a file to disk',
      icon: 'file.svg',
      inputs: ['main'],
      outputs: ['main'],
    },
    {
      name: 'n8n-nodes-base.emailSend',
      displayName: 'Send Email',
      group: 'output',
      version: 2,
      description: 'Send an email',
      icon: 'email.svg',
      inputs: ['main'],
      outputs: ['main'],
    },
    
    // Transform nodes
    {
      name: 'n8n-nodes-base.set',
      displayName: 'Set',
      group: 'transform',
      version: 2,
      description: 'Set data values',
      icon: 'set.svg',
      inputs: ['main'],
      outputs: ['main'],
    },
    {
      name: 'n8n-nodes-base.itemLists',
      displayName: 'Item Lists',
      group: 'transform',
      version: 2,
      description: 'Manipulate lists and items',
      icon: 'list.svg',
      inputs: ['main'],
      outputs: ['main'],
    },
    {
      name: 'n8n-nodes-base.code',
      displayName: 'Code',
      group: 'transform',
      version: 1,
      description: 'Run custom JavaScript code',
      icon: 'code.svg',
      inputs: ['main'],
      outputs: ['main'],
    },
    
    // Flow nodes
    {
      name: 'n8n-nodes-base.if',
      displayName: 'IF',
      group: 'flow',
      version: 1,
      description: 'Conditional logic',
      icon: 'if.svg',
      inputs: ['main'],
      outputs: ['main', 'main'],
    },
    {
      name: 'n8n-nodes-base.switch',
      displayName: 'Switch',
      group: 'flow',
      version: 1,
      description: 'Route based on value',
      icon: 'switch.svg',
      inputs: ['main'],
      outputs: ['main', 'main', 'main', 'main'],
    },
    {
      name: 'n8n-nodes-base.merge',
      displayName: 'Merge',
      group: 'flow',
      version: 2,
      description: 'Merge multiple inputs',
      icon: 'merge.svg',
      inputs: ['main', 'main'],
      outputs: ['main'],
    },
    {
      name: 'n8n-nodes-base.splitInBatches',
      displayName: 'Split In Batches',
      group: 'flow',
      version: 1,
      description: 'Split data into batches',
      icon: 'batch.svg',
      inputs: ['main'],
      outputs: ['main'],
    },
    
    // Function nodes
    {
      name: 'n8n-nodes-base.function',
      displayName: 'Function',
      group: 'function',
      version: 1,
      description: 'Run custom function',
      icon: 'function.svg',
      inputs: ['main'],
      outputs: ['main'],
    },
    {
      name: 'n8n-nodes-base.functionItem',
      displayName: 'Function Item',
      group: 'function',
      version: 1,
      description: 'Run function on each item',
      icon: 'function.svg',
      inputs: ['main'],
      outputs: ['main'],
    },
    
    // Data nodes
    {
      name: 'n8n-nodes-base.postgres',
      displayName: 'Postgres',
      group: 'data',
      version: 2,
      description: 'PostgreSQL database',
      icon: 'postgres.svg',
      inputs: ['main'],
      outputs: ['main'],
      credentials: ['postgres'],
    },
    {
      name: 'n8n-nodes-base.mongoDb',
      displayName: 'MongoDB',
      group: 'data',
      version: 1,
      description: 'MongoDB database',
      icon: 'mongodb.svg',
      inputs: ['main'],
      outputs: ['main'],
      credentials: ['mongoDb'],
    },
    {
      name: 'n8n-nodes-base.redis',
      displayName: 'Redis',
      group: 'data',
      version: 1,
      description: 'Redis key-value store',
      icon: 'redis.svg',
      inputs: ['main'],
      outputs: ['main'],
      credentials: ['redis'],
    },
    
    // Communication nodes
    {
      name: 'n8n-nodes-base.slack',
      displayName: 'Slack',
      group: 'communication',
      version: 2,
      description: 'Send messages to Slack',
      icon: 'slack.svg',
      inputs: ['main'],
      outputs: ['main'],
      credentials: ['slackApi'],
    },
    {
      name: 'n8n-nodes-base.telegram',
      displayName: 'Telegram',
      group: 'communication',
      version: 1,
      description: 'Send messages via Telegram',
      icon: 'telegram.svg',
      inputs: ['main'],
      outputs: ['main'],
      credentials: ['telegramApi'],
    },
    {
      name: 'n8n-nodes-base.discord',
      displayName: 'Discord',
      group: 'communication',
      version: 1,
      description: 'Send messages to Discord',
      icon: 'discord.svg',
      inputs: ['main'],
      outputs: ['main'],
      credentials: ['discordApi'],
    },
    
    // Utility nodes
    {
      name: 'n8n-nodes-base.wait',
      displayName: 'Wait',
      group: 'flow',
      version: 1,
      description: 'Wait for a specified time',
      icon: 'wait.svg',
      inputs: ['main'],
      outputs: ['main'],
    },
    {
      name: 'n8n-nodes-base.noOp',
      displayName: 'No Operation',
      group: 'flow',
      version: 1,
      description: 'Do nothing (useful for testing)',
      icon: 'noop.svg',
      inputs: ['main'],
      outputs: ['main'],
    },
    {
      name: 'n8n-nodes-base.dateTime',
      displayName: 'Date & Time',
      group: 'transform',
      version: 1,
      description: 'Work with dates and times',
      icon: 'calendar.svg',
      inputs: ['main'],
      outputs: ['main'],
    },
  ];
  
  // Initialize
  commonNodes.forEach(node => {
    nodeTypes.value.set(node.name, node);
  });
  
  // Getters
  const allNodeTypes = computed(() => 
    Array.from(nodeTypes.value.values())
  );
  
  const nodeTypesByGroup = computed(() => {
    const groups = new Map<string, NodeType[]>();
    
    allNodeTypes.value.forEach(node => {
      if (!groups.has(node.group)) {
        groups.set(node.group, []);
      }
      groups.get(node.group)!.push(node);
    });
    
    return groups;
  });
  
  const groupNames = computed(() => 
    Array.from(nodeTypesByGroup.value.keys())
  );
  
  // Actions
  function getNodeType(name: string): NodeType | undefined {
    return nodeTypes.value.get(name);
  }
  
  async function loadNodeTypes() {
    isLoading.value = true;
    error.value = null;
    
    try {
      // In real implementation, this would fetch from the backend
      const response = await fetch('/api/node-types');
      if (!response.ok) throw new Error('Failed to load node types');
      
      const data = await response.json();
      
      // Clear and reload
      nodeTypes.value.clear();
      data.forEach((node: NodeType) => {
        nodeTypes.value.set(node.name, node);
      });
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load node types';
      console.error('Failed to load node types:', err);
      
      // Keep common nodes on error
      commonNodes.forEach(node => {
        nodeTypes.value.set(node.name, node);
      });
    } finally {
      isLoading.value = false;
    }
  }
  
  function searchNodeTypes(query: string): NodeType[] {
    const q = query.toLowerCase();
    
    return allNodeTypes.value.filter(node => 
      node.displayName.toLowerCase().includes(q) ||
      node.name.toLowerCase().includes(q) ||
      (node.description && node.description.toLowerCase().includes(q))
    );
  }
  
  function getNodesByCredential(credentialType: string): NodeType[] {
    return allNodeTypes.value.filter(node => 
      node.credentials?.includes(credentialType)
    );
  }
  
  return {
    // State
    nodeTypes,
    isLoading,
    error,
    
    // Getters
    allNodeTypes,
    nodeTypesByGroup,
    groupNames,
    
    // Actions
    getNodeType,
    loadNodeTypes,
    searchNodeTypes,
    getNodesByCredential,
  };
});