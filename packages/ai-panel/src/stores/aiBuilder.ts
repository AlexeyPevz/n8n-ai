import { defineStore } from 'pinia';
import { ref } from 'vue';

interface Component {
  id: string;
  name: string;
  type: string;
  icon: string;
  color: string;
  purpose: string;
  selected: boolean;
}

interface Clarification {
  id: string;
  question: string;
  options: Array<{ label: string; value: string }>;
  answer?: string;
}

interface ConfigField {
  name: string;
  label: string;
  type: 'string' | 'select' | 'boolean' | 'number';
  value?: any;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  options?: Array<{ label: string; value: string }>;
  description?: string;
}

interface NodeConfig {
  nodeId: string;
  name: string;
  type: string;
  icon: string;
  color: string;
  fields: ConfigField[];
}

export const useAIBuilderStore = defineStore('aiBuilder', () => {
  // State
  const isProcessing = ref(false);
  const lastAnalysis = ref<any>(null);
  
  // Mock AI responses for demo
  const mockComponents: Record<string, Component[]> = {
    'contact form': [
      {
        id: 'webhook',
        name: 'Webhook Trigger',
        type: 'n8n-nodes-base.webhook',
        icon: 'webhook.svg',
        color: '#ff6d5a',
        purpose: 'Receive form submissions from your website',
        selected: true,
      },
      {
        id: 'sheets',
        name: 'Google Sheets',
        type: 'n8n-nodes-base.googleSheets',
        icon: 'google-sheets.svg',
        color: '#0f9d58',
        purpose: 'Save contact information to a spreadsheet',
        selected: true,
      },
      {
        id: 'email',
        name: 'Send Email',
        type: 'n8n-nodes-base.emailSend',
        icon: 'email.svg',
        color: '#ea4335',
        purpose: 'Send thank you email to the visitor',
        selected: true,
      },
      {
        id: 'slack',
        name: 'Slack',
        type: 'n8n-nodes-base.slack',
        icon: 'slack.svg',
        color: '#4a154b',
        purpose: 'Notify your team about new contacts',
        selected: true,
      },
    ],
    'social media': [
      {
        id: 'twitter',
        name: 'Twitter Trigger',
        type: 'n8n-nodes-base.twitterTrigger',
        icon: 'twitter.svg',
        color: '#1da1f2',
        purpose: 'Monitor Twitter for mentions',
        selected: true,
      },
      {
        id: 'sentiment',
        name: 'Sentiment Analysis',
        type: 'n8n-nodes-base.sentimentAnalysis',
        icon: 'ai.svg',
        color: '#5fa3d3',
        purpose: 'Analyze sentiment of mentions',
        selected: true,
      },
      {
        id: 'database',
        name: 'Database',
        type: 'n8n-nodes-base.postgres',
        icon: 'database.svg',
        color: '#336791',
        purpose: 'Store positive mentions',
        selected: true,
      },
      {
        id: 'alert',
        name: 'Send Alert',
        type: 'n8n-nodes-base.emailSend',
        icon: 'alert.svg',
        color: '#ff3333',
        purpose: 'Alert for negative feedback',
        selected: true,
      },
    ],
  };
  
  // Actions
  async function analyzeDescription(description: string) {
    isProcessing.value = true;
    
    try {
      // Simulate AI processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Determine which template to use based on keywords
      let components: Component[] = [];
      let summary = '';
      
      if (description.toLowerCase().includes('form') || description.toLowerCase().includes('contact')) {
        components = mockComponents['contact form'];
        summary = 'I\'ll help you create a workflow that captures form submissions, stores them in Google Sheets, sends confirmation emails, and notifies your team on Slack.';
      } else if (description.toLowerCase().includes('social') || description.toLowerCase().includes('twitter')) {
        components = mockComponents['social media'];
        summary = 'I\'ll help you create a workflow that monitors social media mentions, analyzes sentiment, saves positive feedback, and alerts you to negative comments.';
      } else {
        // Generic components
        components = [
          {
            id: 'trigger',
            name: 'Webhook Trigger',
            type: 'n8n-nodes-base.webhook',
            icon: 'webhook.svg',
            color: '#ff6d5a',
            purpose: 'Start your workflow with an external trigger',
            selected: true,
          },
          {
            id: 'transform',
            name: 'Data Transformation',
            type: 'n8n-nodes-base.set',
            icon: 'set.svg',
            color: '#5fa3d3',
            purpose: 'Process and transform your data',
            selected: true,
          },
          {
            id: 'action',
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            icon: 'http.svg',
            color: '#ff6d5a',
            purpose: 'Send data to external services',
            selected: true,
          },
        ];
        summary = 'I\'ll help you create a custom workflow based on your requirements.';
      }
      
      // Add some clarifications
      const clarifications: Clarification[] = [];
      
      if (description.toLowerCase().includes('email')) {
        clarifications.push({
          id: 'email-provider',
          question: 'Which email service would you like to use?',
          options: [
            { label: 'Gmail', value: 'gmail' },
            { label: 'SendGrid', value: 'sendgrid' },
            { label: 'SMTP Server', value: 'smtp' },
          ],
        });
      }
      
      if (description.toLowerCase().includes('database') || description.toLowerCase().includes('save')) {
        clarifications.push({
          id: 'data-storage',
          question: 'Where would you like to store the data?',
          options: [
            { label: 'Google Sheets', value: 'sheets' },
            { label: 'MySQL Database', value: 'mysql' },
            { label: 'PostgreSQL', value: 'postgres' },
            { label: 'Airtable', value: 'airtable' },
          ],
        });
      }
      
      lastAnalysis.value = { description, components, clarifications };
      
      return {
        summary,
        components,
        clarifications,
      };
    } finally {
      isProcessing.value = false;
    }
  }
  
  async function generateConfiguration(params: {
    description: string;
    components: Component[];
    clarifications: Clarification[];
  }) {
    isProcessing.value = true;
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const configs: NodeConfig[] = [];
      
      for (const component of params.components) {
        const config: NodeConfig = {
          nodeId: `node_${component.id}`,
          name: component.name,
          type: component.type,
          icon: component.icon,
          color: component.color,
          fields: [],
        };
        
        // Add fields based on component type
        switch (component.type) {
          case 'n8n-nodes-base.webhook':
            config.fields = [
              {
                name: 'path',
                label: 'Webhook Path',
                type: 'string',
                placeholder: '/webhook/contact-form',
                required: true,
                hint: 'The URL path where your form will send data',
              },
              {
                name: 'method',
                label: 'HTTP Method',
                type: 'select',
                value: 'POST',
                options: [
                  { label: 'GET', value: 'GET' },
                  { label: 'POST', value: 'POST' },
                ],
              },
            ];
            break;
            
          case 'n8n-nodes-base.googleSheets':
            config.fields = [
              {
                name: 'spreadsheetId',
                label: 'Spreadsheet ID',
                type: 'string',
                placeholder: 'Enter your Google Sheets ID',
                required: true,
                hint: 'You can find this in the spreadsheet URL',
              },
              {
                name: 'sheetName',
                label: 'Sheet Name',
                type: 'string',
                value: 'Sheet1',
                required: true,
              },
              {
                name: 'operation',
                label: 'Operation',
                type: 'select',
                value: 'append',
                options: [
                  { label: 'Append Row', value: 'append' },
                  { label: 'Update Row', value: 'update' },
                ],
              },
            ];
            break;
            
          case 'n8n-nodes-base.emailSend':
            config.fields = [
              {
                name: 'toEmail',
                label: 'To Email',
                type: 'string',
                placeholder: '{{$node["Webhook"].json["email"]}}',
                required: true,
                hint: 'Use expressions to reference data from other nodes',
              },
              {
                name: 'subject',
                label: 'Email Subject',
                type: 'string',
                value: 'Thank you for contacting us!',
                required: true,
              },
              {
                name: 'html',
                label: 'Use HTML',
                type: 'boolean',
                value: true,
                description: 'Send email as HTML',
              },
            ];
            break;
            
          case 'n8n-nodes-base.slack':
            config.fields = [
              {
                name: 'channel',
                label: 'Channel',
                type: 'string',
                placeholder: '#general',
                required: true,
                hint: 'Channel name or ID',
              },
              {
                name: 'messageType',
                label: 'Message Type',
                type: 'select',
                value: 'text',
                options: [
                  { label: 'Simple Text', value: 'text' },
                  { label: 'Rich Message', value: 'block' },
                ],
              },
            ];
            break;
            
          default:
            config.fields = [
              {
                name: 'configure',
                label: 'Configuration',
                type: 'string',
                placeholder: 'Configure this node',
                required: true,
              },
            ];
        }
        
        configs.push(config);
      }
      
      return configs;
    } finally {
      isProcessing.value = false;
    }
  }
  
  async function buildWorkflow(configs: NodeConfig[]) {
    isProcessing.value = true;
    
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const nodes: any[] = [];
      const connections: any[] = [];
      const steps: any[] = [];
      
      // Create nodes with positions
      let xPos = 250;
      let yPos = 250;
      
      configs.forEach((config, index) => {
        const node = {
          id: config.nodeId,
          name: config.name,
          type: config.type,
          position: [xPos, yPos] as [number, number],
          parameters: {},
        };
        
        // Build parameters from configured fields
        config.fields.forEach(field => {
          if (field.value !== undefined) {
            node.parameters[field.name] = field.value;
          }
        });
        
        nodes.push(node);
        
        // Create step description
        steps.push({
          id: config.nodeId,
          name: config.name,
          description: getStepDescription(config),
        });
        
        // Create connection to previous node
        if (index > 0) {
          connections.push({
            from: configs[index - 1].nodeId,
            to: config.nodeId,
          });
        }
        
        // Update position for next node
        xPos += 300;
        if (xPos > 1000) {
          xPos = 250;
          yPos += 150;
        }
      });
      
      return { nodes, connections, steps };
    } finally {
      isProcessing.value = false;
    }
  }
  
  function getStepDescription(config: NodeConfig): string {
    switch (config.type) {
      case 'n8n-nodes-base.webhook':
        return 'Receives incoming data from your form or external service';
      case 'n8n-nodes-base.googleSheets':
        return 'Saves the data to your Google Sheets spreadsheet';
      case 'n8n-nodes-base.emailSend':
        return 'Sends a confirmation email to the user';
      case 'n8n-nodes-base.slack':
        return 'Notifies your team in Slack about the new submission';
      default:
        return 'Processes the data according to your configuration';
    }
  }
  
  return {
    // State
    isProcessing,
    lastAnalysis,
    
    // Actions
    analyzeDescription,
    generateConfiguration,
    buildWorkflow,
  };
});