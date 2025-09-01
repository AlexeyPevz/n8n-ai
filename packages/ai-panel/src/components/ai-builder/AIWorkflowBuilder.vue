<template>
  <div class="ai-workflow-builder">
    <!-- Header -->
    <div class="builder-header">
      <div class="header-content">
        <h1 class="builder-title">
          <IconMagic class="title-icon" />
          AI Workflow Builder
        </h1>
        <p class="builder-subtitle">
          Describe what you want to automate, and AI will create the workflow for you
        </p>
      </div>
      
      <div class="header-actions">
        <button @click="showExamples = true" class="action-btn secondary">
          <IconLightbulb />
          Examples
        </button>
        <button @click="resetBuilder" class="action-btn secondary">
          <IconRefresh />
          Start Over
        </button>
      </div>
    </div>
    
    <!-- Progress Indicator -->
    <div class="progress-container">
      <div class="progress-steps">
        <div
          v-for="(step, index) in steps"
          :key="step.id"
          class="progress-step"
          :class="{
            'step-completed': index < currentStepIndex,
            'step-active': index === currentStepIndex,
            'step-upcoming': index > currentStepIndex,
          }"
        >
          <div class="step-indicator">
            <IconCheck v-if="index < currentStepIndex" />
            <span v-else>{{ index + 1 }}</span>
          </div>
          <span class="step-label">{{ step.label }}</span>
        </div>
      </div>
      <div class="progress-bar">
        <div 
          class="progress-fill"
          :style="{ width: `${progressPercentage}%` }"
        />
      </div>
    </div>
    
    <!-- Main Content -->
    <div class="builder-content">
      <transition name="step" mode="out-in">
        <!-- Step 1: Description -->
        <div v-if="currentStep.id === 'description'" key="description" class="step-content">
          <div class="step-header">
            <h2>What would you like to automate?</h2>
            <p>Describe your workflow in natural language. Be as specific as possible.</p>
          </div>
          
          <div class="input-section">
            <div class="input-wrapper">
              <textarea
                v-model="workflowDescription"
                placeholder="Example: When someone fills out my contact form, save their information to Google Sheets, send them a thank you email, and notify me on Slack"
                class="description-input"
                rows="6"
                @keydown.enter.ctrl="processDescription"
              />
              
              <div class="input-actions">
                <div class="char-count">
                  {{ workflowDescription.length }} / 1000
                </div>
                <button
                  @click="processDescription"
                  :disabled="!workflowDescription.trim() || isProcessing"
                  class="action-btn primary"
                >
                  <IconSparkles v-if="!isProcessing" />
                  <IconLoader v-else class="spinning" />
                  {{ isProcessing ? 'Analyzing...' : 'Analyze with AI' }}
                </button>
              </div>
            </div>
            
            <!-- Quick Templates -->
            <div class="quick-templates">
              <h3>Quick Start Templates</h3>
              <div class="template-grid">
                <button
                  v-for="template in quickTemplates"
                  :key="template.id"
                  @click="workflowDescription = template.description"
                  class="template-card"
                >
                  <div class="template-icon">{{ template.icon }}</div>
                  <div class="template-name">{{ template.name }}</div>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Step 2: AI Analysis -->
        <div v-else-if="currentStep.id === 'analysis'" key="analysis" class="step-content">
          <div class="step-header">
            <h2>AI Analysis</h2>
            <p>Here's what I understood from your description:</p>
          </div>
          
          <div class="analysis-results">
            <!-- Workflow Summary -->
            <div class="analysis-section">
              <h3>
                <IconTarget />
                Workflow Summary
              </h3>
              <div class="summary-card">
                <p>{{ aiAnalysis.summary }}</p>
              </div>
            </div>
            
            <!-- Identified Components -->
            <div class="analysis-section">
              <h3>
                <IconPuzzle />
                Identified Components
              </h3>
              <div class="components-grid">
                <div
                  v-for="component in aiAnalysis.components"
                  :key="component.id"
                  class="component-card"
                  :class="{ 'component-selected': component.selected }"
                  @click="toggleComponent(component)"
                >
                  <div class="component-icon" :style="{ backgroundColor: component.color + '20' }">
                    <img :src="`/node-icons/${component.icon}`" :alt="component.name" />
                  </div>
                  <div class="component-info">
                    <h4>{{ component.name }}</h4>
                    <p>{{ component.purpose }}</p>
                  </div>
                  <div class="component-check">
                    <IconCheck v-if="component.selected" />
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Clarifications -->
            <div v-if="aiAnalysis.clarifications.length > 0" class="analysis-section">
              <h3>
                <IconQuestion />
                Need Clarification
              </h3>
              <div class="clarifications">
                <div
                  v-for="clarification in aiAnalysis.clarifications"
                  :key="clarification.id"
                  class="clarification-card"
                >
                  <p class="clarification-question">{{ clarification.question }}</p>
                  <div class="clarification-options">
                    <label
                      v-for="option in clarification.options"
                      :key="option.value"
                      class="option-label"
                    >
                      <input
                        type="radio"
                        :name="`clarification-${clarification.id}`"
                        :value="option.value"
                        v-model="clarification.answer"
                      />
                      <span>{{ option.label }}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="step-actions">
            <button @click="currentStepIndex--" class="action-btn secondary">
              Back
            </button>
            <button
              @click="generateWorkflow"
              :disabled="!canProceedToGeneration"
              class="action-btn primary"
            >
              Generate Workflow
              <IconArrowRight />
            </button>
          </div>
        </div>
        
        <!-- Step 3: Configuration -->
        <div v-else-if="currentStep.id === 'configuration'" key="configuration" class="step-content">
          <div class="step-header">
            <h2>Configure Your Workflow</h2>
            <p>Fine-tune the settings for each component:</p>
          </div>
          
          <div class="configuration-sections">
            <div
              v-for="config in workflowConfig"
              :key="config.nodeId"
              class="config-section"
            >
              <div class="config-header">
                <div class="config-icon" :style="{ backgroundColor: config.color + '20' }">
                  <img :src="`/node-icons/${config.icon}`" :alt="config.name" />
                </div>
                <h3>{{ config.name }}</h3>
              </div>
              
              <div class="config-fields">
                <div
                  v-for="field in config.fields"
                  :key="field.name"
                  class="config-field"
                >
                  <label class="field-label">
                    {{ field.label }}
                    <span v-if="field.required" class="required">*</span>
                  </label>
                  
                  <!-- Text Input -->
                  <input
                    v-if="field.type === 'string'"
                    v-model="field.value"
                    type="text"
                    :placeholder="field.placeholder"
                    class="field-input"
                  />
                  
                  <!-- Select -->
                  <select
                    v-else-if="field.type === 'select'"
                    v-model="field.value"
                    class="field-select"
                  >
                    <option value="">Choose...</option>
                    <option
                      v-for="option in field.options"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </option>
                  </select>
                  
                  <!-- Checkbox -->
                  <label
                    v-else-if="field.type === 'boolean'"
                    class="field-checkbox"
                  >
                    <input
                      type="checkbox"
                      v-model="field.value"
                    />
                    <span>{{ field.description }}</span>
                  </label>
                  
                  <p v-if="field.hint" class="field-hint">{{ field.hint }}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div class="step-actions">
            <button @click="currentStepIndex--" class="action-btn secondary">
              Back
            </button>
            <button
              @click="buildWorkflow"
              :disabled="!isConfigValid"
              class="action-btn primary"
            >
              <IconBuild />
              Build Workflow
            </button>
          </div>
        </div>
        
        <!-- Step 4: Preview -->
        <div v-else-if="currentStep.id === 'preview'" key="preview" class="step-content">
          <div class="step-header">
            <h2>Your AI-Generated Workflow</h2>
            <p>Review your workflow and make any final adjustments:</p>
          </div>
          
          <div class="preview-container">
            <!-- Mini Workflow Visualization -->
            <div class="workflow-preview">
              <WorkflowMiniMap :nodes="generatedNodes" :connections="generatedConnections" />
            </div>
            
            <!-- Workflow Details -->
            <div class="workflow-details">
              <h3>Workflow Steps</h3>
              <ol class="workflow-steps">
                <li v-for="step in workflowSteps" :key="step.id">
                  <strong>{{ step.name }}</strong>: {{ step.description }}
                </li>
              </ol>
              
              <div class="workflow-stats">
                <div class="stat">
                  <span class="stat-value">{{ generatedNodes.length }}</span>
                  <span class="stat-label">Nodes</span>
                </div>
                <div class="stat">
                  <span class="stat-value">{{ generatedConnections.length }}</span>
                  <span class="stat-label">Connections</span>
                </div>
                <div class="stat">
                  <span class="stat-value">~{{ estimatedTime }}</span>
                  <span class="stat-label">Setup Time</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="step-actions">
            <button @click="currentStepIndex--" class="action-btn secondary">
              Back
            </button>
            <button @click="openInEditor" class="action-btn primary large">
              <IconEdit />
              Open in Workflow Editor
            </button>
          </div>
          
          <!-- Alternative Actions -->
          <div class="alternative-actions">
            <button @click="downloadWorkflow" class="alt-action">
              <IconDownload />
              Download as JSON
            </button>
            <button @click="shareWorkflow" class="alt-action">
              <IconShare />
              Share Workflow
            </button>
            <button @click="saveAsTemplate" class="alt-action">
              <IconSave />
              Save as Template
            </button>
          </div>
        </div>
      </transition>
    </div>
    
    <!-- Examples Modal -->
    <ExamplesModal
      v-if="showExamples"
      @close="showExamples = false"
      @select="selectExample"
    />
    
    <!-- AI Thinking Indicator -->
    <AIThinkingOverlay v-if="isAIThinking" :message="aiThinkingMessage" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useWorkflowStore } from '@/stores/workflow';
import { useAIBuilderStore } from '@/stores/aiBuilder';
import WorkflowMiniMap from './WorkflowMiniMap.vue';
import ExamplesModal from './ExamplesModal.vue';
import AIThinkingOverlay from './AIThinkingOverlay.vue';
import IconMagic from '../icons/IconMagic.vue';
import IconLightbulb from '../icons/IconLightbulb.vue';
import IconRefresh from '../icons/IconRefresh.vue';
import IconCheck from '../icons/IconCheck.vue';
import IconSparkles from '../icons/IconSparkles.vue';
import IconLoader from '../icons/IconLoader.vue';
import IconArrowRight from '../icons/IconArrowRight.vue';
import IconTarget from '../icons/IconTarget.vue';
import IconPuzzle from '../icons/IconPuzzle.vue';
import IconQuestion from '../icons/IconQuestion.vue';
import IconBuild from '../icons/IconBuild.vue';
import IconEdit from '../icons/IconEdit.vue';
import IconDownload from '../icons/IconDownload.vue';
import IconShare from '../icons/IconShare.vue';
import IconSave from '../icons/IconSave.vue';

const router = useRouter();
const workflowStore = useWorkflowStore();
const aiBuilderStore = useAIBuilderStore();

// Steps configuration
const steps = [
  { id: 'description', label: 'Describe' },
  { id: 'analysis', label: 'Analyze' },
  { id: 'configuration', label: 'Configure' },
  { id: 'preview', label: 'Preview' },
];

// State
const currentStepIndex = ref(0);
const workflowDescription = ref('');
const isProcessing = ref(false);
const isAIThinking = ref(false);
const aiThinkingMessage = ref('');
const showExamples = ref(false);

// Current step
const currentStep = computed(() => steps[currentStepIndex.value]);
const progressPercentage = computed(() => 
  ((currentStepIndex.value + 1) / steps.length) * 100
);

// Quick templates
const quickTemplates = [
  {
    id: 'lead-capture',
    name: 'Lead Capture',
    icon: '📧',
    description: 'When someone submits a form on my website, add them to my CRM, send a welcome email, and notify the sales team on Slack',
  },
  {
    id: 'social-monitor',
    name: 'Social Media Monitor',
    icon: '📱',
    description: 'Monitor Twitter for mentions of my brand, analyze sentiment, save positive mentions to a database, and alert me for negative feedback',
  },
  {
    id: 'invoice-automation',
    name: 'Invoice Automation',
    icon: '💰',
    description: 'When a new invoice is created in my accounting software, generate a PDF, send it to the customer, and create a calendar reminder for follow-up',
  },
  {
    id: 'content-pipeline',
    name: 'Content Pipeline',
    icon: '📝',
    description: 'Take blog posts from my CMS, automatically post to social media platforms, track engagement, and compile weekly analytics reports',
  },
  {
    id: 'customer-onboarding',
    name: 'Customer Onboarding',
    icon: '🎯',
    description: 'When a new customer signs up, create their account, send onboarding emails over 7 days, add to mailing list, and create a task for account manager',
  },
  {
    id: 'data-backup',
    name: 'Data Backup',
    icon: '💾',
    description: 'Every night at midnight, backup my database, compress the files, upload to cloud storage, and email me a confirmation',
  },
];

// AI Analysis results (mock for now)
const aiAnalysis = ref({
  summary: '',
  components: [] as any[],
  clarifications: [] as any[],
});

const workflowConfig = ref<any[]>([]);
const generatedNodes = ref<any[]>([]);
const generatedConnections = ref<any[]>([]);
const workflowSteps = ref<any[]>([]);
const estimatedTime = ref('5 min');

// Computed
const canProceedToGeneration = computed(() => {
  const hasSelectedComponents = aiAnalysis.value.components.some(c => c.selected);
  const allClarificationsAnswered = aiAnalysis.value.clarifications.every(c => c.answer);
  return hasSelectedComponents && allClarificationsAnswered;
});

const isConfigValid = computed(() => {
  return workflowConfig.value.every(config => 
    config.fields.every((field: any) => 
      !field.required || field.value
    )
  );
});

// Methods
async function processDescription() {
  if (!workflowDescription.value.trim() || isProcessing.value) return;
  
  isProcessing.value = true;
  isAIThinking.value = true;
  aiThinkingMessage.value = 'Analyzing your workflow description...';
  
  try {
    // Call AI to analyze the description
    const analysis = await aiBuilderStore.analyzeDescription(workflowDescription.value);
    
    aiAnalysis.value = {
      summary: analysis.summary || 'I will help you create a workflow that automates this process.',
      components: analysis.components || [],
      clarifications: analysis.clarifications || [],
    };
    
    // Move to next step
    currentStepIndex.value = 1;
  } catch (error) {
    console.error('Failed to analyze description:', error);
  } finally {
    isProcessing.value = false;
    isAIThinking.value = false;
  }
}

function toggleComponent(component: any) {
  component.selected = !component.selected;
}

async function generateWorkflow() {
  isAIThinking.value = true;
  aiThinkingMessage.value = 'Generating workflow configuration...';
  
  try {
    // Generate workflow configuration based on selected components
    const config = await aiBuilderStore.generateConfiguration({
      description: workflowDescription.value,
      components: aiAnalysis.value.components.filter(c => c.selected),
      clarifications: aiAnalysis.value.clarifications,
    });
    
    workflowConfig.value = config;
    currentStepIndex.value = 2;
  } catch (error) {
    console.error('Failed to generate workflow:', error);
  } finally {
    isAIThinking.value = false;
  }
}

async function buildWorkflow() {
  isAIThinking.value = true;
  aiThinkingMessage.value = 'Building your workflow...';
  
  try {
    // Build the actual workflow
    const result = await aiBuilderStore.buildWorkflow(workflowConfig.value);
    
    generatedNodes.value = result.nodes;
    generatedConnections.value = result.connections;
    workflowSteps.value = result.steps;
    
    currentStepIndex.value = 3;
  } catch (error) {
    console.error('Failed to build workflow:', error);
  } finally {
    isAIThinking.value = false;
  }
}

function openInEditor() {
  // Load workflow into store
  workflowStore.loadWorkflow({
    id: `ai-generated-${Date.now()}`,
    name: 'AI Generated Workflow',
    nodes: generatedNodes.value,
    connections: generatedConnections.value,
  });
  
  // Navigate to editor
  router.push('/editor');
}

function downloadWorkflow() {
  const workflow = {
    name: 'AI Generated Workflow',
    nodes: generatedNodes.value,
    connections: generatedConnections.value,
    settings: {},
  };
  
  const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `workflow-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function shareWorkflow() {
  // Implement sharing functionality
}

function saveAsTemplate() {
  // Save as template for future use
}

function resetBuilder() {
  currentStepIndex.value = 0;
  workflowDescription.value = '';
  aiAnalysis.value = {
    summary: '',
    components: [],
    clarifications: [],
  };
  workflowConfig.value = [];
  generatedNodes.value = [];
  generatedConnections.value = [];
}

function selectExample(example: any) {
  workflowDescription.value = example.description;
  showExamples.value = false;
}
</script>

<style scoped>
.ai-workflow-builder {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f9f9f9;
}

/* Header */
.builder-header {
  background: white;
  border-bottom: 1px solid #e0e0e0;
  padding: 24px 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-content {
  flex: 1;
}

.builder-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 28px;
  font-weight: 700;
  color: #333;
  margin: 0 0 8px 0;
}

.title-icon {
  width: 32px;
  height: 32px;
  color: #ff6d5a;
}

.builder-subtitle {
  font-size: 16px;
  color: #666;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 12px;
}

/* Progress */
.progress-container {
  background: white;
  padding: 24px 32px;
  border-bottom: 1px solid #e0e0e0;
}

.progress-steps {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
}

.progress-step {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #999;
  font-size: 14px;
  position: relative;
  flex: 1;
}

.progress-step:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 20px;
  left: 40px;
  right: -50%;
  height: 2px;
  background: #e0e0e0;
  z-index: 0;
}

.step-completed {
  color: #7fb069;
}

.step-completed::after {
  background: #7fb069;
}

.step-active {
  color: #ff6d5a;
  font-weight: 600;
}

.step-indicator {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 2px solid #e0e0e0;
  position: relative;
  z-index: 1;
}

.step-completed .step-indicator {
  background: #7fb069;
  border-color: #7fb069;
  color: white;
}

.step-active .step-indicator {
  background: #ff6d5a;
  border-color: #ff6d5a;
  color: white;
}

.progress-bar {
  height: 4px;
  background: #e0e0e0;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #7fb069 0%, #ff6d5a 100%);
  transition: width 0.3s ease;
}

/* Content */
.builder-content {
  flex: 1;
  overflow-y: auto;
  padding: 32px;
}

.step-content {
  max-width: 1000px;
  margin: 0 auto;
}

.step-header {
  margin-bottom: 32px;
}

.step-header h2 {
  font-size: 24px;
  color: #333;
  margin: 0 0 8px 0;
}

.step-header p {
  font-size: 16px;
  color: #666;
  margin: 0;
}

/* Step 1: Description */
.input-section {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.input-wrapper {
  margin-bottom: 32px;
}

.description-input {
  width: 100%;
  padding: 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 16px;
  line-height: 1.5;
  resize: vertical;
  transition: border-color 0.2s;
}

.description-input:focus {
  outline: none;
  border-color: #ff6d5a;
}

.input-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
}

.char-count {
  font-size: 14px;
  color: #999;
}

/* Quick Templates */
.quick-templates h3 {
  font-size: 18px;
  color: #333;
  margin: 0 0 16px 0;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.template-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: #f8f8f8;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.template-card:hover {
  background: white;
  border-color: #ff6d5a;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 109, 90, 0.15);
}

.template-icon {
  font-size: 32px;
}

.template-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  text-align: center;
}

/* Analysis Results */
.analysis-results {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.analysis-section h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  color: #333;
  margin: 0 0 16px 0;
}

.summary-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.summary-card p {
  margin: 0;
  color: #333;
  line-height: 1.6;
}

.components-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.component-card {
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 12px;
}

.component-card:hover {
  border-color: #ff6d5a;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.component-selected {
  border-color: #7fb069;
  background: #f8fdf6;
}

.component-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.component-icon img {
  width: 32px;
  height: 32px;
}

.component-info {
  flex: 1;
}

.component-info h4 {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin: 0 0 4px 0;
}

.component-info p {
  font-size: 14px;
  color: #666;
  margin: 0;
}

.component-check {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #7fb069;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Clarifications */
.clarifications {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.clarification-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.clarification-question {
  font-size: 16px;
  font-weight: 500;
  color: #333;
  margin: 0 0 16px 0;
}

.clarification-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.option-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #666;
}

.option-label input[type="radio"] {
  width: 16px;
  height: 16px;
}

/* Configuration */
.configuration-sections {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.config-section {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.config-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.config-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.config-icon img {
  width: 24px;
  height: 24px;
}

.config-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.config-fields {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.config-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.required {
  color: #ff3333;
}

.field-input,
.field-select {
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.field-input:focus,
.field-select:focus {
  outline: none;
  border-color: #ff6d5a;
}

.field-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.field-hint {
  font-size: 12px;
  color: #999;
  margin: 0;
}

/* Preview */
.preview-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
  margin-bottom: 32px;
}

.workflow-preview {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  min-height: 400px;
}

.workflow-details {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.workflow-details h3 {
  font-size: 18px;
  color: #333;
  margin: 0 0 16px 0;
}

.workflow-steps {
  margin: 0 0 24px 0;
  padding-left: 20px;
}

.workflow-steps li {
  margin-bottom: 12px;
  color: #666;
  line-height: 1.6;
}

.workflow-stats {
  display: flex;
  gap: 24px;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
}

.stat {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 24px;
  font-weight: 600;
  color: #ff6d5a;
}

.stat-label {
  display: block;
  font-size: 14px;
  color: #999;
  margin-top: 4px;
}

/* Actions */
.step-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 32px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn.primary {
  background: #ff6d5a;
  color: white;
}

.action-btn.primary:hover:not(:disabled) {
  background: #ff5544;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 109, 90, 0.25);
}

.action-btn.secondary {
  background: white;
  color: #666;
  border: 1px solid #ddd;
}

.action-btn.secondary:hover {
  background: #f5f5f5;
  border-color: #ccc;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.large {
  padding: 16px 32px;
  font-size: 18px;
}

.alternative-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 24px;
}

.alt-action {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: transparent;
  border: none;
  color: #666;
  font-size: 14px;
  cursor: pointer;
  transition: color 0.2s;
}

.alt-action:hover {
  color: #ff6d5a;
}

/* Animations */
.step-enter-active,
.step-leave-active {
  transition: all 0.3s ease;
}

.step-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.step-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>