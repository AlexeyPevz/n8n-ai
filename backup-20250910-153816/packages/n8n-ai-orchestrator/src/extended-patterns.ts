/**
 * Расширенные паттерны воркфлоу на основе анализа 1268 реальных примеров
 */

import type { WorkflowPattern} from './workflow-patterns.js';
import { WORKFLOW_PATTERNS } from './workflow-patterns.js';

export const EXTENDED_PATTERNS: WorkflowPattern[] = [
  // AI Agent Workflows (443 примеров)
  {
    name: 'ai-agent-chat',
    keywords: ['ai', 'agent', 'chat', 'conversation', 'langchain'],
    nodes: [
      {
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        name: 'Chat Webhook',
        parameters: {
          httpMethod: 'POST',
          path: 'chat'
        }
      },
      {
        type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
        typeVersion: 1,
        name: 'Chat Memory',
        parameters: {
          contextWindowLength: 10
        }
      },
      {
        type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        typeVersion: 1,
        name: 'OpenAI Chat',
        parameters: {
          model: 'gpt-4',
          temperature: 0.7
        }
      },
      {
        type: '@n8n/n8n-nodes-langchain.agent',
        typeVersion: 1,
        name: 'AI Agent',
        parameters: {
          text: '={{ $json.message }}',
          systemMessage: 'You are a helpful assistant'
        }
      },
      {
        type: 'n8n-nodes-base.respondToWebhook',
        typeVersion: 1,
        name: 'Send Response',
        parameters: {
          responseMode: 'lastNode'
        }
      }
    ],
    connections: [
      { from: 'Chat Webhook', to: 'Chat Memory' },
      { from: 'Chat Memory', to: 'OpenAI Chat' },
      { from: 'OpenAI Chat', to: 'AI Agent' },
      { from: 'AI Agent', to: 'Send Response' }
    ]
  },

  // Google Sheets Integration (36 примеров)
  {
    name: 'api-to-sheets',
    keywords: ['api', 'google', 'sheets', 'spreadsheet', 'data'],
    nodes: [
      {
        type: 'n8n-nodes-base.scheduleTrigger',
        typeVersion: 1,
        name: 'Daily Update',
        parameters: {
          rule: {
            cronExpression: '0 8 * * *'
          }
        }
      },
      {
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4,
        name: 'Fetch API Data',
        parameters: {
          method: 'GET',
          url: 'https://api.example.com/data',
          options: {
            response: {
              response: {
                responseFormat: 'json'
              }
            }
          }
        }
      },
      {
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        name: 'Transform Data',
        parameters: {
          jsCode: `// Transform API data for Google Sheets
return items.map(item => ({
  json: {
    date: new Date().toISOString(),
    ...item.json
  }
}));`
        }
      },
      {
        type: 'n8n-nodes-base.googleSheets',
        typeVersion: 4,
        name: 'Update Sheet',
        parameters: {
          authentication: 'oAuth2',
          operation: 'append',
          sheetId: '={{ $env.GOOGLE_SHEET_ID }}',
          range: 'A:Z'
        }
      }
    ],
    connections: [
      { from: 'Daily Update', to: 'Fetch API Data' },
      { from: 'Fetch API Data', to: 'Transform Data' },
      { from: 'Transform Data', to: 'Update Sheet' }
    ]
  },

  // Slack Alert System (25 примеров)
  {
    name: 'monitoring-slack-alert',
    keywords: ['monitor', 'alert', 'slack', 'notification', 'error'],
    nodes: [
      {
        type: 'n8n-nodes-base.scheduleTrigger',
        typeVersion: 1,
        name: 'Check Every 5 Min',
        parameters: {
          rule: {
            interval: [{ field: 'minutes', minutesInterval: 5 }]
          }
        }
      },
      {
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4,
        name: 'Health Check',
        parameters: {
          method: 'GET',
          url: '{{ $env.MONITOR_URL }}/health',
          options: {
            timeout: 5000,
            response: {
              response: {
                fullResponse: true
              }
            }
          }
        }
      },
      {
        type: 'n8n-nodes-base.if',
        typeVersion: 1,
        name: 'Check Status',
        parameters: {
          conditions: {
            number: [
              {
                value1: '={{ $json.statusCode }}',
                operation: 'notEqual',
                value2: 200
              }
            ]
          }
        }
      },
      {
        type: 'n8n-nodes-base.slack',
        typeVersion: 2,
        name: 'Send Alert',
        parameters: {
          authentication: 'oAuth2',
          channel: '#alerts',
          text: '🚨 *Service Down Alert*\nService: {{ $env.SERVICE_NAME }}\nStatus: {{ $json.statusCode }}\nTime: {{ $now }}',
          otherOptions: {
            mrkdwn: true
          }
        }
      }
    ],
    connections: [
      { from: 'Check Every 5 Min', to: 'Health Check' },
      { from: 'Health Check', to: 'Check Status' },
      { from: 'Check Status', to: 'Send Alert' }
    ]
  },

  // ETL Workflow (74 примеров)
  {
    name: 'advanced-etl',
    keywords: ['etl', 'extract', 'transform', 'load', 'data', 'pipeline'],
    nodes: [
      {
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        name: 'ETL Trigger',
        parameters: {
          httpMethod: 'POST',
          path: 'etl-job'
        }
      },
      {
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4,
        name: 'Extract Data',
        parameters: {
          method: 'GET',
          url: '={{ $json.sourceUrl }}',
          options: {
            pagination: {
              pagination: {
                paginationMode: 'responseContainsNextURL',
                nextURL: '={{ $response.body.next }}'
              }
            }
          }
        }
      },
      {
        type: 'n8n-nodes-base.aggregate',
        typeVersion: 1,
        name: 'Aggregate Results',
        parameters: {
          options: {}
        }
      },
      {
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        name: 'Transform',
        parameters: {
          jsCode: `// Data transformation logic
const transformed = items.map(item => {
  const data = item.json;
  return {
    json: {
      id: data.id,
      processedAt: new Date().toISOString(),
      // Add transformations
    }
  };
});

return transformed;`
        }
      },
      {
        type: 'n8n-nodes-base.splitInBatches',
        typeVersion: 3,
        name: 'Batch Process',
        parameters: {
          batchSize: 100,
          options: {}
        }
      },
      {
        type: 'n8n-nodes-base.postgres',
        typeVersion: 2,
        name: 'Load to Database',
        parameters: {
          operation: 'insert',
          table: 'processed_data',
          columns: 'id,data,processed_at',
          additionalFields: {}
        }
      }
    ],
    connections: [
      { from: 'ETL Trigger', to: 'Extract Data' },
      { from: 'Extract Data', to: 'Aggregate Results' },
      { from: 'Aggregate Results', to: 'Transform' },
      { from: 'Transform', to: 'Batch Process' },
      { from: 'Batch Process', to: 'Load to Database' }
    ]
  },

  // Email Digest (177 примеров)
  {
    name: 'daily-email-digest',
    keywords: ['email', 'digest', 'daily', 'report', 'summary'],
    nodes: [
      {
        type: 'n8n-nodes-base.scheduleTrigger',
        typeVersion: 1,
        name: 'Daily at 9 AM',
        parameters: {
          rule: {
            cronExpression: '0 9 * * *'
          }
        }
      },
      {
        type: 'n8n-nodes-base.postgres',
        typeVersion: 2,
        name: 'Get Daily Data',
        parameters: {
          operation: 'executeQuery',
          query: "SELECT * FROM events WHERE created_at >= NOW() - INTERVAL '24 hours'"
        }
      },
      {
        type: 'n8n-nodes-base.aggregate',
        typeVersion: 1,
        name: 'Aggregate Data',
        parameters: {
          fieldsToAggregate: {
            fieldToAggregate: [
              {
                fieldToAggregate: 'count',
                aggregationFunction: 'count'
              }
            ]
          }
        }
      },
      {
        type: 'n8n-nodes-base.html',
        typeVersion: 1,
        name: 'Generate HTML',
        parameters: {
          html: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; }
    h1 { color: #333; }
    .stats { background: #f0f0f0; padding: 20px; }
  </style>
</head>
<body>
  <h1>Daily Report - {{ $today }}</h1>
  <div class="stats">
    <p>Total Events: {{ $json.count }}</p>
  </div>
</body>
</html>`
        }
      },
      {
        type: 'n8n-nodes-base.emailSend',
        typeVersion: 2,
        name: 'Send Email',
        parameters: {
          sendTo: '={{ $env.REPORT_EMAIL }}',
          subject: 'Daily Report - {{ $today }}',
          emailType: 'html',
          options: {}
        }
      }
    ],
    connections: [
      { from: 'Daily at 9 AM', to: 'Get Daily Data' },
      { from: 'Get Daily Data', to: 'Aggregate Data' },
      { from: 'Aggregate Data', to: 'Generate HTML' },
      { from: 'Generate HTML', to: 'Send Email' }
    ]
  },

  // Webhook to Database (47 примеров)
  {
    name: 'webhook-to-database',
    keywords: ['webhook', 'database', 'postgres', 'mysql', 'save', 'store'],
    nodes: [
      {
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        name: 'Data Webhook',
        parameters: {
          httpMethod: 'POST',
          path: 'data-ingestion',
          responseMode: 'onReceived',
          responseData: 'allEntries',
          responsePropertyName: 'data'
        }
      },
      {
        type: 'n8n-nodes-base.dateTime',
        typeVersion: 2,
        name: 'Add Timestamp',
        parameters: {
          action: 'formatDate',
          value: '={{ $now }}',
          toFormat: 'yyyy-MM-dd HH:mm:ss'
        }
      },
      {
        type: 'n8n-nodes-base.postgres',
        typeVersion: 2,
        name: 'Insert Data',
        parameters: {
          operation: 'insert',
          table: 'webhook_data',
          columns: 'data,created_at',
          additionalFields: {}
        }
      },
      {
        type: 'n8n-nodes-base.respondToWebhook',
        typeVersion: 1,
        name: 'Send Success',
        parameters: {
          respondWith: 'json',
          responseBody: '{"success": true, "id": "{{ $json.id }}"}'
        }
      }
    ],
    connections: [
      { from: 'Data Webhook', to: 'Add Timestamp' },
      { from: 'Add Timestamp', to: 'Insert Data' },
      { from: 'Insert Data', to: 'Send Success' }
    ]
  },

  // File Processing (многие примеры)
  {
    name: 'csv-processing',
    keywords: ['csv', 'file', 'spreadsheet', 'excel', 'process'],
    nodes: [
      {
        type: 'n8n-nodes-base.manualTrigger',
        typeVersion: 1,
        name: 'Manual Trigger',
        parameters: {}
      },
      {
        type: 'n8n-nodes-base.readBinaryFile',
        typeVersion: 1,
        name: 'Read File',
        parameters: {
          filePath: '={{ $json.filePath }}'
        }
      },
      {
        type: 'n8n-nodes-base.spreadsheetFile',
        typeVersion: 2,
        name: 'Parse CSV',
        parameters: {
          operation: 'fromFile',
          fileFormat: 'csv',
          options: {
            headerRow: true,
            delimiter: ','
          }
        }
      },
      {
        type: 'n8n-nodes-base.itemLists',
        typeVersion: 3,
        name: 'Process Rows',
        parameters: {
          operation: 'aggregateItems',
          fieldsToAggregate: {
            fieldToAggregate: [
              {
                fieldToAggregate: 'amount',
                aggregationFunction: 'sum'
              }
            ]
          }
        }
      },
      {
        type: 'n8n-nodes-base.writeBinaryFile',
        typeVersion: 1,
        name: 'Save Result',
        parameters: {
          fileName: 'processed_{{ $now }}.csv',
          filePath: '/output/'
        }
      }
    ],
    connections: [
      { from: 'Manual Trigger', to: 'Read File' },
      { from: 'Read File', to: 'Parse CSV' },
      { from: 'Parse CSV', to: 'Process Rows' },
      { from: 'Process Rows', to: 'Save Result' }
    ]
  }
];

/**
 * Объединяет базовые и расширенные паттерны
 */
export function getAllPatterns(): WorkflowPattern[] {
  // Объединяем и удаляем дубликаты по имени
  const allPatterns = [...WORKFLOW_PATTERNS, ...EXTENDED_PATTERNS];
  const uniquePatterns = new Map<string, WorkflowPattern>();
  
  allPatterns.forEach(pattern => {
    uniquePatterns.set(pattern.name, pattern);
  });
  
  return Array.from(uniquePatterns.values());
}