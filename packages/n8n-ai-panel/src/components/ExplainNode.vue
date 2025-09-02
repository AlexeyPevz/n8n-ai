<template>
  <div class="explain-node-container">
    <!-- Trigger button -->
    <button
      @click="showExplanation = !showExplanation"
      class="explain-trigger"
      :class="{ 'explain-active': showExplanation }"
      title="Explain this node"
    >
      <IconHelp v-if="!isLoading" />
      <IconLoader v-else class="spinning" />
    </button>
    
    <!-- Explanation popup -->
    <transition name="explain">
      <div
        v-if="showExplanation"
        class="explain-popup"
        :class="{ 'explain-loading': isLoading }"
      >
        <div class="explain-header">
          <h4>
            <img 
              v-if="node.icon"
              :src="`/node-icons/${node.icon}`"
              :alt="node.name"
              class="node-icon"
              @error="handleIconError"
            >
            {{ node.name || node.type }}
          </h4>
          <button @click="showExplanation = false" class="close-btn">
            <IconX />
          </button>
        </div>
        
        <div class="explain-content">
          <!-- Loading state -->
          <div v-if="isLoading" class="loading-state">
            <IconLoader class="spinning" />
            <p>Analyzing node configuration...</p>
          </div>
          
          <!-- Error state -->
          <div v-else-if="error" class="error-state">
            <IconAlert />
            <p>{{ error }}</p>
            <button @click="fetchExplanation" class="retry-btn">
              Try Again
            </button>
          </div>
          
          <!-- Explanation content -->
          <div v-else-if="explanation" class="explanation">
            <!-- Summary -->
            <div class="explain-section">
              <h5>What it does</h5>
              <p>{{ explanation.summary }}</p>
            </div>
            
            <!-- Current configuration -->
            <div v-if="explanation.configuration" class="explain-section">
              <h5>Current Configuration</h5>
              <ul class="config-list">
                <li
                  v-for="(config, index) in explanation.configuration"
                  :key="index"
                >
                  <span class="config-key">{{ config.key }}:</span>
                  <span class="config-value">{{ formatValue(config.value) }}</span>
                  <span v-if="config.description" class="config-desc">
                    — {{ config.description }}
                  </span>
                </li>
              </ul>
            </div>
            
            <!-- Inputs/Outputs -->
            <div class="explain-section io-section">
              <div class="io-block">
                <h5>Expects</h5>
                <div v-if="explanation.inputs && explanation.inputs.length > 0">
                  <div
                    v-for="input in explanation.inputs"
                    :key="input.type"
                    class="io-item"
                  >
                    <IconArrowRight class="io-icon input" />
                    <div>
                      <strong>{{ input.type }}</strong>
                      <p v-if="input.description">{{ input.description }}</p>
                    </div>
                  </div>
                </div>
                <p v-else class="io-empty">No input required</p>
              </div>
              
              <div class="io-block">
                <h5>Produces</h5>
                <div v-if="explanation.outputs && explanation.outputs.length > 0">
                  <div
                    v-for="output in explanation.outputs"
                    :key="output.type"
                    class="io-item"
                  >
                    <IconArrowRight class="io-icon output" />
                    <div>
                      <strong>{{ output.type }}</strong>
                      <p v-if="output.description">{{ output.description }}</p>
                    </div>
                  </div>
                </div>
                <p v-else class="io-empty">No output</p>
              </div>
            </div>
            
            <!-- Common issues -->
            <div v-if="explanation.commonIssues && explanation.commonIssues.length > 0" class="explain-section">
              <h5>Common Issues</h5>
              <div class="issues-list">
                <div
                  v-for="(issue, index) in explanation.commonIssues"
                  :key="index"
                  class="issue-item"
                >
                  <IconAlert class="issue-icon" />
                  <div>
                    <strong>{{ issue.title }}</strong>
                    <p>{{ issue.description }}</p>
                    <p v-if="issue.solution" class="issue-solution">
                      <strong>Solution:</strong> {{ issue.solution }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Examples -->
            <div v-if="explanation.examples && explanation.examples.length > 0" class="explain-section">
              <h5>Examples</h5>
              <div class="examples-tabs">
                <button
                  v-for="(example, index) in explanation.examples"
                  :key="index"
                  @click="selectedExample = index"
                  class="example-tab"
                  :class="{ active: selectedExample === index }"
                >
                  {{ example.title }}
                </button>
              </div>
              <div v-if="explanation.examples[selectedExample]" class="example-content">
                <p>{{ explanation.examples[selectedExample].description }}</p>
                <pre v-if="explanation.examples[selectedExample].code" class="example-code">{{ explanation.examples[selectedExample].code }}</pre>
              </div>
            </div>
            
            <!-- Related nodes -->
            <div v-if="explanation.relatedNodes && explanation.relatedNodes.length > 0" class="explain-section">
              <h5>Works well with</h5>
              <div class="related-nodes">
                <div
                  v-for="related in explanation.relatedNodes"
                  :key="related.type"
                  class="related-node"
                  @click="$emit('select-node', related.type)"
                >
                  <img 
                    v-if="related.icon"
                    :src="`/node-icons/${related.icon}`"
                    :alt="related.name"
                    @error="handleIconError"
                  >
                  <span>{{ related.name }}</span>
                </div>
              </div>
            </div>
            
            <!-- Documentation link -->
            <div v-if="explanation.documentationUrl" class="explain-footer">
              <a 
                :href="explanation.documentationUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="doc-link"
              >
                <IconBook />
                View full documentation
                <IconExternalLink />
              </a>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script lang="ts">
export default {
  data() {
    return {
      error: '',
      isLoading: false,
    };
  },
};
</script>

<script setup lang="ts">
import { ref, watch, computed, getCurrentInstance } from 'vue';
import IconStubs from './icons/IconStubs.vue';
const IconHelp = IconStubs as any;
const IconLoader = IconStubs as any;
const IconX = IconStubs as any;
const IconAlert = IconStubs as any;
const IconArrowRight = IconStubs as any;
const IconBook = IconStubs as any;
const IconExternalLink = IconStubs as any;

// Types
interface NodeInfo {
  id: string;
  name?: string;
  type: string;
  icon?: string;
  parameters?: Record<string, any>;
}

interface NodeExplanation {
  summary: string;
  configuration?: Array<{
    key: string;
    value: any;
    description?: string;
  }>;
  inputs?: Array<{
    type: string;
    description?: string;
  }>;
  outputs?: Array<{
    type: string;
    description?: string;
  }>;
  commonIssues?: Array<{
    title: string;
    description: string;
    solution?: string;
  }>;
  examples?: Array<{
    title: string;
    description: string;
    code?: string;
  }>;
  relatedNodes?: Array<{
    type: string;
    name: string;
    icon?: string;
  }>;
  documentationUrl?: string;
}

// Props & Emits
const props = defineProps<{
  node: NodeInfo;
}>();

const emit = defineEmits<{
  'select-node': [nodeType: string];
}>();

// State
const showExplanation = ref(false);
const isLoading = ref(false);
const error = ref('');
const explanation = ref<NodeExplanation | null>(null);
const selectedExample = ref(0);

// Expose for setData in tests by defining properties on proxy
const instance = getCurrentInstance();
if (instance && instance.proxy) {
  // @ts-ignore
  Object.defineProperty(instance.proxy, 'error', {
    get: () => error.value,
    set: (v) => { error.value = v as any; },
    configurable: true,
  });
  // @ts-ignore
  Object.defineProperty(instance.proxy, 'isLoading', {
    get: () => isLoading.value,
    set: (v) => { isLoading.value = v as any; },
    configurable: true,
  });
}

// Generate explanation for the node
async function fetchExplanation() {
  isLoading.value = true;
  error.value = '';
  
  try {
    // In real implementation, this would call an AI service
    // For now, generate based on node type
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    explanation.value = generateExplanation(props.node);
    
  } catch (err: any) {
    error.value = err.message || 'Failed to generate explanation';
  } finally {
    isLoading.value = false;
  }
}

// Generate explanation based on node type (mock implementation)
function generateExplanation(node: NodeInfo): NodeExplanation {
  const nodeType = node.type.split('.').pop() || '';
  
  // Base explanations for common nodes
  const explanations: Record<string, Partial<NodeExplanation>> = {
    httpRequest: {
      summary: 'Makes HTTP requests to external APIs or webhooks. It can send GET, POST, PUT, DELETE, and other HTTP methods with custom headers, query parameters, and body data.',
      inputs: [
        {
          type: 'Main',
          description: 'Data from previous nodes that can be used in the request',
        },
      ],
      outputs: [
        {
          type: 'Main',
          description: 'Response data from the HTTP request',
        },
      ],
      commonIssues: [
        {
          title: 'Authentication Failed',
          description: 'The API returned a 401 or 403 error',
          solution: 'Check your authentication credentials or API key in the node settings',
        },
        {
          title: 'Timeout Error',
          description: 'The request took too long to complete',
          solution: 'Increase the timeout in node settings or check if the endpoint is responsive',
        },
      ],
      examples: [
        {
          title: 'GET Request',
          description: 'Fetch data from an API endpoint',
          code: 'URL: https://api.example.com/users\nMethod: GET\nHeaders: {"Authorization": "Bearer {{$credentials.apiKey}}"}',
        },
        {
          title: 'POST with JSON',
          description: 'Send JSON data to create a resource',
          code: 'URL: https://api.example.com/users\nMethod: POST\nBody: {"name": "{{$node["Set"].json["name"]}}", "email": "{{$node["Set"].json["email"]}}"}',
        },
      ],
      relatedNodes: [
        { type: 'n8n-nodes-base.set', name: 'Set', icon: 'set.svg' },
        { type: 'n8n-nodes-base.if', name: 'IF', icon: 'if.svg' },
        { type: 'n8n-nodes-base.code', name: 'Code', icon: 'code.svg' },
      ],
      documentationUrl: 'https://docs.n8n.io/nodes/n8n-nodes-base.httpRequest/',
    },
    webhook: {
      summary: 'Creates an endpoint that listens for incoming HTTP requests. When a request is received, it triggers the workflow to run.',
      outputs: [
        {
          type: 'Main',
          description: 'Data received from the webhook request',
        },
      ],
      commonIssues: [
        {
          title: 'Webhook Not Receiving Data',
          description: 'The webhook URL is not being called',
          solution: 'Ensure the webhook URL is correctly configured in your external service and the workflow is active',
        },
      ],
      relatedNodes: [
        { type: 'n8n-nodes-base.respondToWebhook', name: 'Respond to Webhook', icon: 'webhook.svg' },
      ],
      documentationUrl: 'https://docs.n8n.io/nodes/n8n-nodes-base.webhook/',
    },
    set: {
      summary: 'Sets or modifies values in your workflow data. Use it to add new fields, rename existing ones, or transform data structure.',
      inputs: [
        {
          type: 'Main',
          description: 'Data to be modified or extended',
        },
      ],
      outputs: [
        {
          type: 'Main',
          description: 'Modified data with new or updated fields',
        },
      ],
      examples: [
        {
          title: 'Add Static Values',
          description: 'Add fixed values to your data',
          code: 'status: "active"\ntimestamp: {{$now}}',
        },
        {
          title: 'Transform Data',
          description: 'Use expressions to transform existing data',
          code: 'fullName: {{$json["firstName"]}} {{$json["lastName"]}}\nemail: {{$json["email"].toLowerCase()}}',
        },
      ],
      documentationUrl: 'https://docs.n8n.io/nodes/n8n-nodes-base.set/',
    },
  };
  
  // Get base explanation or generate generic one
  const baseExplanation = explanations[nodeType] || {
    summary: `This is a ${node.name || nodeType} node. It performs operations as configured in its parameters.`,
  };
  
  // Add current configuration
  const configuration: NodeExplanation['configuration'] = [];
  if (node.parameters) {
    for (const [key, value] of Object.entries(node.parameters)) {
      if (value !== undefined && value !== '' && key !== 'authentication') {
        configuration.push({
          key: formatParameterName(key),
          value: value,
          description: getParameterDescription(nodeType, key, value),
        });
      }
    }
  }
  
  return {
    ...baseExplanation,
    configuration: configuration.length > 0 ? configuration : undefined,
  } as NodeExplanation;
}

// Format parameter names for display
function formatParameterName(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

// Get parameter-specific descriptions
function getParameterDescription(nodeType: string, param: string, value: any): string | undefined {
  const descriptions: Record<string, Record<string, string>> = {
    httpRequest: {
      method: 'HTTP method to use for the request',
      url: 'The endpoint URL to send the request to',
      responseFormat: 'How to parse the response data',
      options: 'Additional request options',
    },
    webhook: {
      path: 'The URL path where the webhook will listen',
      httpMethod: 'Which HTTP methods to accept',
      responseMode: 'When to send the response back',
    },
  };
  
  return descriptions[nodeType]?.[param];
}

// Format values for display
function formatValue(value: any): string {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  if (typeof value === 'string' && value.length > 50) {
    return value.substring(0, 50) + '...';
  }
  return String(value);
}

// Handle icon loading errors
function handleIconError(event: Event) {
  (event.target as HTMLImageElement).src = '/node-icons/default.svg';
}

// Watch for popup open to fetch explanation
watch(showExplanation, (isShown) => {
  if (isShown && !explanation.value && !isLoading.value) {
    fetchExplanation();
  }
});

// Reset when node changes
watch(() => props.node.id, () => {
  explanation.value = null;
  selectedExample.value = 0;
  error.value = '';
});
</script>

<style scoped>
.explain-node-container {
  position: relative;
  display: inline-block;
}

.explain-trigger {
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: 1px solid #ddd;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  transition: all 0.2s;
}

.explain-trigger:hover {
  background: #f5f5f5;
  border-color: #ff6d5a;
  color: #ff6d5a;
}

.explain-active {
  background: #ff6d5a !important;
  border-color: #ff6d5a !important;
  color: white !important;
}

.explain-popup {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 8px;
  width: 400px;
  max-width: 90vw;
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  overflow: hidden;
}

.explain-popup.explain-loading {
  min-height: 200px;
}

.explain-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.explain-header h4 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 16px;
  color: #333;
}

.node-icon {
  width: 20px;
  height: 20px;
}

.close-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  color: #666;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f5f5f5;
  color: #333;
}

.explain-content {
  padding: 20px;
  max-height: 500px;
  overflow-y: auto;
}

/* Loading & Error states */
.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 150px;
  text-align: center;
  color: #666;
}

.loading-state svg,
.error-state svg {
  width: 32px;
  height: 32px;
  margin-bottom: 12px;
}

.error-state svg {
  color: #ff6d5a;
}

.retry-btn {
  margin-top: 12px;
  padding: 6px 16px;
  background: #ff6d5a;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.retry-btn:hover {
  background: #ff5544;
}

/* Explanation sections */
.explain-section {
  margin-bottom: 24px;
}

.explain-section:last-child {
  margin-bottom: 0;
}

.explain-section h5 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.explain-section p {
  margin: 0;
  color: #666;
  line-height: 1.5;
}

/* Configuration list */
.config-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.config-list li {
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
  font-size: 14px;
}

.config-list li:last-child {
  border-bottom: none;
}

.config-key {
  font-weight: 500;
  color: #333;
  margin-right: 8px;
}

.config-value {
  color: #ff6d5a;
  font-family: monospace;
  font-size: 13px;
}

.config-desc {
  color: #999;
  font-size: 12px;
  margin-left: 8px;
}

/* Input/Output section */
.io-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.io-block h5 {
  margin-bottom: 8px;
}

.io-item {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.io-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 2px;
}

.io-icon.input {
  color: #7fb069;
  transform: rotate(180deg);
}

.io-icon.output {
  color: #ff6d5a;
}

.io-item strong {
  display: block;
  font-size: 14px;
  color: #333;
  margin-bottom: 2px;
}

.io-item p {
  font-size: 12px;
  color: #666;
  margin: 0;
}

.io-empty {
  font-size: 13px;
  color: #999;
  font-style: italic;
}

/* Issues list */
.issues-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.issue-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: #fff5f5;
  border-radius: 6px;
  border: 1px solid #ffdddd;
}

.issue-icon {
  width: 20px;
  height: 20px;
  color: #ff6d5a;
  flex-shrink: 0;
  margin-top: 2px;
}

.issue-item strong {
  display: block;
  font-size: 14px;
  color: #333;
  margin-bottom: 4px;
}

.issue-item p {
  font-size: 13px;
  margin: 0;
}

.issue-solution {
  margin-top: 8px !important;
  color: #333;
}

/* Examples */
.examples-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.example-tab {
  padding: 6px 12px;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.example-tab:hover {
  background: #eeeeee;
  border-color: #ddd;
}

.example-tab.active {
  background: #ff6d5a;
  border-color: #ff6d5a;
  color: white;
}

.example-content p {
  margin-bottom: 8px;
  font-size: 13px;
}

.example-code {
  background: #f8f8f8;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 12px;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre;
}

/* Related nodes */
.related-nodes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.related-node {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-size: 13px;
  color: #333;
  cursor: pointer;
  transition: all 0.2s;
}

.related-node:hover {
  background: #ff6d5a;
  border-color: #ff6d5a;
  color: white;
}

.related-node img {
  width: 16px;
  height: 16px;
}

/* Documentation link */
.explain-footer {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
}

.doc-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  background: #f5f5f5;
  border-radius: 4px;
  color: #666;
  text-decoration: none;
  font-size: 14px;
  transition: all 0.2s;
}

.doc-link:hover {
  background: #ff6d5a;
  color: white;
}

.doc-link svg {
  width: 16px;
  height: 16px;
}

/* Animations */
.explain-enter-active,
.explain-leave-active {
  transition: all 0.2s ease;
}

.explain-enter-from,
.explain-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-10px) scale(0.95);
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>