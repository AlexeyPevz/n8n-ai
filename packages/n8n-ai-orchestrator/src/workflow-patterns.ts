/**
 * Паттерны воркфлоу на основе анализа реальных примеров
 */

export interface WorkflowPattern {
  name: string;
  keywords: string[];
  nodes: Array<{
    type: string;
    typeVersion: number;
    name: string;
    parameters?: Record<string, unknown>;
  }>;
  connections: Array<{
    from: string;
    to: string;
  }>;
}

export const WORKFLOW_PATTERNS: WorkflowPattern[] = [
  {
    name: 'foreach-and-branching',
    keywords: ['for each', 'foreach', 'каждого', 'для каждого', 'ветвление', 'if', 'ошибка', 'telegram'],
    nodes: [
      { type: 'n8n-nodes-base.httpRequest', typeVersion: 4, name: 'HTTP Request', parameters: { method: 'GET', url: 'https://jsonplaceholder.typicode.com/users', responseFormat: 'json' } },
      { type: 'n8n-nodes-base.code', typeVersion: 2, name: 'For Each', parameters: { jsCode: 'return items.map(i=>({json:i.json}));' } },
      { type: 'n8n-nodes-base.if', typeVersion: 1, name: 'IF Email Domain', parameters: { conditions: { string: [{ value1: '={{ $json.email }}', operation: 'contains', value2: '@' }] } } },
      { type: 'n8n-nodes-base.telegram', typeVersion: 1, name: 'Telegram Notify', parameters: { operation: 'sendMessage', text: 'Invalid email detected' } }
    ],
    connections: [
      { from: 'HTTP Request', to: 'For Each' },
      { from: 'For Each', to: 'IF Email Domain' },
      { from: 'IF Email Domain', to: 'Telegram Notify' }
    ]
  },
  {
    name: 'webhook-to-slack',
    keywords: ['webhook', 'slack', 'notification', 'alert'],
    nodes: [
      {
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        name: 'Webhook',
        parameters: {
          httpMethod: 'POST',
          path: 'webhook-endpoint'
        }
      },
      {
        type: 'n8n-nodes-base.slack',
        typeVersion: 2,
        name: 'Send to Slack',
        parameters: {
          authentication: 'oAuth2',
          channel: "={{ $json.channel || '#general' }}",
          text: '={{ $json.message }}'
        }
      }
    ],
    connections: [
      { from: 'Webhook', to: 'Send to Slack' }
    ]
  },
  
  {
    name: 'scheduled-report',
    keywords: ['schedule', 'report', 'daily', 'weekly', 'cron'],
    nodes: [
      {
        type: 'n8n-nodes-base.scheduleTrigger',
        typeVersion: 1,
        name: 'Schedule',
        parameters: {
          rule: {
            cronExpression: '0 9 * * *'
          }
        }
      },
      {
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4,
        name: 'Fetch Data',
        parameters: {
          method: 'GET',
          url: 'https://api.example.com/data'
        }
      },
      {
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        name: 'Transform Data',
        parameters: {
          jsCode: 'return items.map(item => ({ json: item.json }));'
        }
      },
      {
        type: 'n8n-nodes-base.emailSend',
        typeVersion: 2,
        name: 'Send Report',
        parameters: {
          sendTo: 'team@example.com',
          subject: 'Daily Report',
          emailType: 'html'
        }
      }
    ],
    connections: [
      { from: 'Schedule', to: 'Fetch Data' },
      { from: 'Fetch Data', to: 'Transform Data' },
      { from: 'Transform Data', to: 'Send Report' }
    ]
  },
  
  {
    name: 'ai-enhanced-workflow',
    keywords: ['ai', 'langchain', 'openai', 'chat', 'vector', 'embedding'],
    nodes: [
      {
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        name: 'Webhook',
        parameters: {
          httpMethod: 'POST',
          path: 'ai-endpoint'
        }
      },
      {
        type: '@n8n/n8n-nodes-langchain.textSplitterCharacterTextSplitter',
        typeVersion: 1,
        name: 'Text Splitter',
        parameters: {
          chunkSize: 1000,
          chunkOverlap: 100
        }
      },
      {
        type: '@n8n/n8n-nodes-langchain.embeddingsOpenAi',
        typeVersion: 1,
        name: 'Embeddings',
        parameters: {
          model: 'text-embedding-ada-002'
        }
      },
      {
        type: '@n8n/n8n-nodes-langchain.vectorStoreSupabase',
        typeVersion: 1,
        name: 'Vector Store',
        parameters: {}
      },
      {
        type: '@n8n/n8n-nodes-langchain.agent',
        typeVersion: 1,
        name: 'AI Agent',
        parameters: {}
      }
    ],
    connections: [
      { from: 'Webhook', to: 'Text Splitter' },
      { from: 'Text Splitter', to: 'Embeddings' },
      { from: 'Embeddings', to: 'Vector Store' },
      { from: 'Vector Store', to: 'AI Agent' }
    ]
  },
  
  {
    name: 'github-automation',
    keywords: ['github', 'git', 'commit', 'issue', 'pr', 'pull request'],
    nodes: [
      {
        type: 'n8n-nodes-base.githubTrigger',
        typeVersion: 1,
        name: 'GitHub Trigger',
        parameters: {
          events: ['push', 'pull_request']
        }
      },
      {
        type: 'n8n-nodes-base.github',
        typeVersion: 1,
        name: 'GitHub Action',
        parameters: {
          operation: 'createIssue',
          owner: '={{ $json.repository.owner.login }}',
          repository: '={{ $json.repository.name }}'
        }
      }
    ],
    connections: [
      { from: 'GitHub Trigger', to: 'GitHub Action' }
    ]
  },
  
  {
    name: 'stripe-integration',
    keywords: ['stripe', 'payment', 'invoice', 'subscription', 'billing'],
    nodes: [
      {
        type: 'n8n-nodes-base.stripeTrigger',
        typeVersion: 1,
        name: 'Stripe Trigger',
        parameters: {
          events: ['invoice.payment_succeeded']
        }
      },
      {
        type: 'n8n-nodes-base.quickbooks',
        typeVersion: 1,
        name: 'QuickBooks',
        parameters: {
          operation: 'createInvoice'
        }
      }
    ],
    connections: [
      { from: 'Stripe Trigger', to: 'QuickBooks' }
    ]
  },
  
  {
    name: 'inventory-monitoring',
    keywords: ['inventory', 'stock', 'alert', 'monitoring', 'warehouse'],
    nodes: [
      {
        type: 'n8n-nodes-base.scheduleTrigger',
        typeVersion: 1,
        name: 'Check Schedule',
        parameters: {
          rule: {
            interval: [{ field: 'hours', hoursInterval: 1 }]
          }
        }
      },
      {
        type: 'n8n-nodes-base.postgres',
        typeVersion: 2,
        name: 'Check Inventory',
        parameters: {
          operation: 'executeQuery',
          query: 'SELECT * FROM inventory WHERE quantity < reorder_level'
        }
      },
      {
        type: 'n8n-nodes-base.if',
        typeVersion: 1,
        name: 'Low Stock?',
        parameters: {
          conditions: {
            number: [
              {
                value1: '={{ $json.length }}',
                operation: 'larger',
                value2: 0
              }
            ]
          }
        }
      },
      {
        type: 'n8n-nodes-base.slack',
        typeVersion: 2,
        name: 'Alert',
        parameters: {
          channel: '#inventory-alerts',
          text: '⚠️ Low stock detected for {{ $json.length }} items'
        }
      }
    ],
    connections: [
      { from: 'Check Schedule', to: 'Check Inventory' },
      { from: 'Check Inventory', to: 'Low Stock?' },
      { from: 'Low Stock?', to: 'Alert' }
    ]
  }
  ,
  {
    name: 'insert-after-existing',
    keywords: ['insert after', 'после', 'логирование', 'logging', 'debug'],
    nodes: [
      { type: 'n8n-nodes-base.code', typeVersion: 2, name: 'Log Response', parameters: { jsCode: 'console.log($json); return items;' } }
    ],
    connections: []
  }
];

/**
 * Находит подходящий паттерн по ключевым словам в промпте
 */
export function findMatchingPattern(prompt: string): WorkflowPattern | null {
  const promptLower = prompt.toLowerCase();
  
  for (const pattern of WORKFLOW_PATTERNS) {
    const matchCount = pattern.keywords.filter(keyword => 
      promptLower.includes(keyword)
    ).length;
    
    // Если найдено хотя бы 2 ключевых слова, считаем паттерн подходящим
    if (matchCount >= 2) {
      return pattern;
    }
  }
  
  return null;
}

/**
 * Генерирует операции на основе паттерна
 */
export type GeneratedOperation =
  | { op: 'add_node'; node: { id: string; name: string; type: string; typeVersion: number; position: [number, number]; parameters: Record<string, unknown> } }
  | { op: 'connect'; from: string; to: string };

export function generateOperationsFromPattern(pattern: WorkflowPattern): GeneratedOperation[] {
  const operations: GeneratedOperation[] = [];
  
  // Добавляем ноды
  pattern.nodes.forEach((node, index) => {
    operations.push({
      op: 'add_node',
      node: {
        id: `node-${index + 1}`,
        name: node.name,
        type: node.type,
        typeVersion: node.typeVersion,
        position: [400 + index * 200, 300],
        parameters: node.parameters || {}
      }
    });
  });
  
  // Добавляем соединения
  pattern.connections.forEach(conn => {
    operations.push({
      op: 'connect',
      from: conn.from,
      to: conn.to
    });
  });
  
  return operations;
}