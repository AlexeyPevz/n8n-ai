/**
 * Загрузчик встроенных нод n8n
 * Этот модуль загружает описания всех базовых нод из n8n-nodes-base
 */

import type { INodeTypeDescription } from 'n8n-workflow';

// Список основных нод n8n, которые мы хотим поддерживать в MVP
const CORE_NODES = [
  // Triggers
  { name: 'n8n-nodes-base.manualTrigger', displayName: 'Manual Trigger' },
  { name: 'n8n-nodes-base.webhook', displayName: 'Webhook' },
  { name: 'n8n-nodes-base.scheduleTrigger', displayName: 'Schedule Trigger' },
  { name: 'n8n-nodes-base.emailReadImap', displayName: 'Email Trigger (IMAP)' },
  
  // Actions
  { name: 'n8n-nodes-base.httpRequest', displayName: 'HTTP Request' },
  { name: 'n8n-nodes-base.code', displayName: 'Code' },
  { name: 'n8n-nodes-base.set', displayName: 'Set' },
  { name: 'n8n-nodes-base.if', displayName: 'IF' },
  { name: 'n8n-nodes-base.switch', displayName: 'Switch' },
  { name: 'n8n-nodes-base.merge', displayName: 'Merge' },
  { name: 'n8n-nodes-base.splitInBatches', displayName: 'Split In Batches' },
  
  // Integrations
  { name: 'n8n-nodes-base.slack', displayName: 'Slack' },
  { name: 'n8n-nodes-base.telegram', displayName: 'Telegram' },
  { name: 'n8n-nodes-base.emailSend', displayName: 'Send Email' },
  { name: 'n8n-nodes-base.googleSheets', displayName: 'Google Sheets' },
  { name: 'n8n-nodes-base.postgres', displayName: 'Postgres' },
  { name: 'n8n-nodes-base.redis', displayName: 'Redis' },
  
  // File operations
  { name: 'n8n-nodes-base.readBinaryFiles', displayName: 'Read Binary Files' },
  { name: 'n8n-nodes-base.writeBinaryFile', displayName: 'Write Binary File' },
  { name: 'n8n-nodes-base.moveBinaryData', displayName: 'Move Binary Data' },
  
  // Data transformation
  { name: 'n8n-nodes-base.itemLists', displayName: 'Item Lists' },
  { name: 'n8n-nodes-base.dateTime', displayName: 'Date & Time' },
  { name: 'n8n-nodes-base.crypto', displayName: 'Crypto' },
];

/**
 * Создает базовое описание ноды для Introspect API
 * Это временное решение пока не подключена реальная n8n
 */
export function createNodeTypeDescription(
  name: string, 
  displayName: string
): INodeTypeDescription {
  // Базовая структура для всех нод
  const baseDescription: INodeTypeDescription = {
    displayName,
    name,
    group: ['transform'],
    version: 1,
    description: `${displayName} node`,
    defaults: {
      name: displayName,
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [],
    credentials: []
  };

  // Добавляем специфичные свойства для разных типов нод
  switch (name) {
    case 'n8n-nodes-base.httpRequest':
      return {
        ...baseDescription,
        version: 4,
        group: ['input'],
        description: 'Makes HTTP requests and returns the response data',
        properties: [
          {
            displayName: 'Method',
            name: 'method',
            type: 'options',
            options: [
              { name: 'GET', value: 'GET' },
              { name: 'POST', value: 'POST' },
              { name: 'PUT', value: 'PUT' },
              { name: 'DELETE', value: 'DELETE' },
              { name: 'PATCH', value: 'PATCH' },
              { name: 'HEAD', value: 'HEAD' },
              { name: 'OPTIONS', value: 'OPTIONS' },
            ],
            default: 'GET',
            description: 'The request method to use',
          },
          {
            displayName: 'URL',
            name: 'url',
            type: 'string',
            default: '',
            placeholder: 'https://example.com/endpoint',
            description: 'The URL to make the request to',
            required: true,
          },
          {
            displayName: 'Authentication',
            name: 'authentication',
            type: 'options',
            options: [
              { name: 'None', value: 'none' },
              { name: 'Basic Auth', value: 'basicAuth' },
              { name: 'Header Auth', value: 'headerAuth' },
              { name: 'OAuth2', value: 'oAuth2' },
              { name: 'API Key', value: 'apiKey' },
            ],
            default: 'none',
          },
          {
            displayName: 'Response Format',
            name: 'responseFormat',
            type: 'options',
            options: [
              { name: 'JSON', value: 'json' },
              { name: 'Text', value: 'text' },
              { name: 'Binary', value: 'binary' },
            ],
            default: 'json',
          },
          {
            displayName: 'Options',
            name: 'options',
            type: 'collection',
            placeholder: 'Add Option',
            default: {},
            options: [
              {
                displayName: 'Headers',
                name: 'headers',
                type: 'json',
                default: '',
                description: 'Request headers as JSON',
              },
              {
                displayName: 'Query Parameters',
                name: 'queryParameters',
                type: 'json',
                default: '',
                description: 'Query parameters as JSON',
              },
              {
                displayName: 'Body Content Type',
                name: 'bodyContentType',
                type: 'options',
                options: [
                  { name: 'JSON', value: 'json' },
                  { name: 'Form Data', value: 'form-data' },
                  { name: 'Form URL Encoded', value: 'form-urlencoded' },
                  { name: 'Raw', value: 'raw' },
                ],
                default: 'json',
              },
              {
                displayName: 'Timeout',
                name: 'timeout',
                type: 'number',
                default: 10000,
                description: 'Request timeout in milliseconds',
              },
            ],
          },
        ],
      };

    case 'n8n-nodes-base.webhook':
      return {
        ...baseDescription,
        group: ['trigger'],
        description: 'Starts the workflow when a webhook is called',
        inputs: [],
        properties: [
          {
            displayName: 'HTTP Method',
            name: 'httpMethod',
            type: 'options',
            options: [
              { name: 'GET', value: 'GET' },
              { name: 'POST', value: 'POST' },
              { name: 'PUT', value: 'PUT' },
              { name: 'DELETE', value: 'DELETE' },
              { name: 'HEAD', value: 'HEAD' },
              { name: 'PATCH', value: 'PATCH' },
            ],
            default: 'POST',
            description: 'The HTTP method to listen for',
          },
          {
            displayName: 'Path',
            name: 'path',
            type: 'string',
            default: '',
            placeholder: 'webhook-endpoint',
            description: 'The path to listen on',
            required: true,
          },
          {
            displayName: 'Response Code',
            name: 'responseCode',
            type: 'number',
            default: 200,
            description: 'The HTTP response code to return',
          },
        ],
      };

    case 'n8n-nodes-base.scheduleTrigger':
      return {
        ...baseDescription,
        group: ['trigger'],
        description: 'Triggers the workflow on a schedule',
        inputs: [],
        properties: [
          {
            displayName: 'Rule',
            name: 'rule',
            type: 'fixedCollection',
            default: { cronExpression: '0 * * * *' },
            options: [
              {
                displayName: 'Cron Expression',
                name: 'cronExpression',
                values: [
                  {
                    displayName: 'Expression',
                    name: 'expression',
                    type: 'string',
                    default: '0 * * * *',
                    placeholder: '0 */5 * * * *',
                    description: 'Cron expression for schedule',
                  },
                ],
              },
            ],
          },
        ],
      };

    case 'n8n-nodes-base.manualTrigger':
      return {
        ...baseDescription,
        group: ['trigger'],
        description: 'Triggers the workflow manually',
        inputs: [],
        properties: [],
      };

    case 'n8n-nodes-base.code':
      return {
        ...baseDescription,
        version: 2,
        group: ['transform'],
        description: 'Run custom JavaScript code',
        properties: [
          {
            displayName: 'Language',
            name: 'language',
            type: 'options',
            options: [
              { name: 'JavaScript', value: 'javaScript' },
              { name: 'Python', value: 'python' },
            ],
            default: 'javaScript',
          },
          {
            displayName: 'JavaScript Code',
            name: 'jsCode',
            type: 'string',
            typeOptions: {
              editor: 'codeNodeEditor',
              rows: 10,
            },
            default: '// Add your code here\nreturn items;',
            description: 'JavaScript code to execute',
            displayOptions: {
              show: {
                language: ['javaScript'],
              },
            },
          },
        ],
      };

    case 'n8n-nodes-base.set':
      return {
        ...baseDescription,
        group: ['input'],
        description: 'Sets values on items and optionally remove other values',
        properties: [
          {
            displayName: 'Keep Only Set',
            name: 'keepOnlySet',
            type: 'boolean',
            default: false,
            description: 'Whether to keep only the values set in this node',
          },
          {
            displayName: 'Values to Set',
            name: 'values',
            type: 'fixedCollection',
            default: {},
            typeOptions: {
              multipleValues: true,
            },
            options: [
              {
                displayName: 'String',
                name: 'string',
                values: [
                  {
                    displayName: 'Name',
                    name: 'name',
                    type: 'string',
                    default: '',
                  },
                  {
                    displayName: 'Value',
                    name: 'value',
                    type: 'string',
                    default: '',
                  },
                ],
              },
              {
                displayName: 'Number',
                name: 'number',
                values: [
                  {
                    displayName: 'Name',
                    name: 'name',
                    type: 'string',
                    default: '',
                  },
                  {
                    displayName: 'Value',
                    name: 'value',
                    type: 'number',
                    default: 0,
                  },
                ],
              },
              {
                displayName: 'Boolean',
                name: 'boolean',
                values: [
                  {
                    displayName: 'Name',
                    name: 'name',
                    type: 'string',
                    default: '',
                  },
                  {
                    displayName: 'Value',
                    name: 'value',
                    type: 'boolean',
                    default: true,
                  },
                ],
              },
            ],
          },
        ],
      };

    case 'n8n-nodes-base.if':
      return {
        ...baseDescription,
        group: ['transform'],
        description: 'Route items based on conditional logic',
        outputs: ['main', 'main'],
        outputNames: ['True', 'False'],
        properties: [
          {
            displayName: 'Conditions',
            name: 'conditions',
            type: 'fixedCollection',
            default: { conditions: [] },
            typeOptions: {
              multipleValues: true,
            },
            options: [
              {
                displayName: 'Conditions',
                name: 'conditions',
                values: [
                  {
                    displayName: 'Value 1',
                    name: 'value1',
                    type: 'string',
                    default: '',
                  },
                  {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    options: [
                      { name: 'Equals', value: 'equals' },
                      { name: 'Not Equals', value: 'notEquals' },
                      { name: 'Contains', value: 'contains' },
                      { name: 'Not Contains', value: 'notContains' },
                      { name: 'Greater Than', value: 'gt' },
                      { name: 'Less Than', value: 'lt' },
                      { name: 'Is Empty', value: 'isEmpty' },
                      { name: 'Is Not Empty', value: 'isNotEmpty' },
                    ],
                    default: 'equals',
                  },
                  {
                    displayName: 'Value 2',
                    name: 'value2',
                    type: 'string',
                    default: '',
                  },
                ],
              },
            ],
          },
        ],
      };

    case 'n8n-nodes-base.slack':
      return {
        ...baseDescription,
        version: 2,
        group: ['output'],
        description: 'Send messages to Slack',
        credentials: [{
          name: 'slackApi',
          required: true,
        }],
        properties: [
          {
            displayName: 'Resource',
            name: 'resource',
            type: 'options',
            options: [
              { name: 'Channel', value: 'channel' },
              { name: 'Message', value: 'message' },
              { name: 'User', value: 'user' },
            ],
            default: 'message',
          },
          {
            displayName: 'Operation',
            name: 'operation',
            type: 'options',
            displayOptions: {
              show: {
                resource: ['message'],
              },
            },
            options: [
              { name: 'Send', value: 'send' },
              { name: 'Update', value: 'update' },
              { name: 'Delete', value: 'delete' },
            ],
            default: 'send',
          },
          {
            displayName: 'Channel',
            name: 'channel',
            type: 'string',
            default: '',
            placeholder: '#general',
            description: 'Channel to send message to',
            required: true,
            displayOptions: {
              show: {
                resource: ['message'],
                operation: ['send'],
              },
            },
          },
          {
            displayName: 'Text',
            name: 'text',
            type: 'string',
            default: '',
            description: 'Text of the message',
            displayOptions: {
              show: {
                resource: ['message'],
                operation: ['send'],
              },
            },
          },
        ],
      };

    default:
      return baseDescription;
  }
}

/**
 * Загружает все базовые ноды
 */
export function loadBuiltinNodes(): INodeTypeDescription[] {
  return CORE_NODES.map(node => 
    createNodeTypeDescription(node.name, node.displayName)
  );
}