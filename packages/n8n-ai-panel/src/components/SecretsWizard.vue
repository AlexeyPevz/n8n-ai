<template>
  <transition name="modal">
    <div v-if="isOpen" class="secrets-wizard-overlay" @click.self="close">
      <div class="secrets-wizard">
        <!-- Header -->
        <div class="wizard-header">
          <h2>
            <IconKey class="header-icon" />
            Credentials Required
          </h2>
          <button @click="close" class="close-btn" aria-label="Close">
            <IconX />
          </button>
        </div>
        
        <!-- Progress -->
        <div class="wizard-progress">
          <div 
            class="progress-bar"
            :style="{ width: `${progressPercentage}%` }"
          />
        </div>
        
        <!-- Content -->
        <div class="wizard-content">
          <div v-if="currentStep === 'select'" class="step-select">
            <p class="step-description">
              This workflow requires credentials for the following services:
            </p>
            
            <div class="required-credentials">
              <div
                v-for="cred in requiredCredentials"
                :key="cred.type"
                class="credential-item"
                :class="{ 'credential-configured': cred.configured }"
              >
                <div class="credential-icon">
                  <img 
                    :src="`/node-icons/${cred.icon || 'default.svg'}`"
                    :alt="cred.name"
                    @error="handleIconError"
                  >
                </div>
                
                <div class="credential-info">
                  <h4>{{ cred.name }}</h4>
                  <p>{{ cred.description }}</p>
                  
                  <div v-if="cred.configured" class="credential-status configured">
                    <IconCheck /> Configured
                  </div>
                  <div v-else class="credential-status missing">
                    <IconAlert /> Not configured
                  </div>
                </div>
                
                <div class="credential-actions">
                  <button
                    v-if="!cred.configured"
                    @click="configureCredential(cred)"
                    class="btn-configure"
                  >
                    Configure
                  </button>
                  <button
                    v-else
                    @click="testCredential(cred)"
                    class="btn-test"
                    :disabled="testingCredential === cred.type"
                  >
                    <span v-if="testingCredential !== cred.type">Test</span>
                    <span v-else>
                      <IconLoader class="spinning" /> Testing...
                    </span>
                  </button>
                </div>
              </div>
            </div>
            
            <div class="wizard-actions">
              <button @click="close" class="btn-secondary">
                Cancel
              </button>
              <button
                @click="proceedToApply"
                :disabled="!allCredentialsConfigured"
                class="btn-primary"
              >
                {{ allCredentialsConfigured ? 'Apply Workflow' : 'Configure All First' }}
              </button>
            </div>
          </div>
          
          <div v-else-if="currentStep === 'configure'" class="step-configure">
            <button @click="currentStep = 'select'" class="back-btn">
              <IconArrowLeft /> Back
            </button>
            
            <h3>Configure {{ selectedCredential?.name }}</h3>
            <p class="step-description">
              {{ selectedCredential?.helpText || 'Enter the required credentials below.' }}
            </p>
            
            <form @submit.prevent="saveCredential" class="credential-form">
              <div
                v-for="field in credentialFields"
                :key="field.name"
                class="form-field"
              >
                <label :for="field.name">
                  {{ field.displayName }}
                  <span v-if="field.required" class="required">*</span>
                </label>
                
                <div v-if="field.type === 'string'" class="field-input">
                  <input
                    :id="field.name"
                    v-model="credentialData[field.name]"
                    :type="field.typeOptions?.password ? 'password' : 'text'"
                    :placeholder="field.placeholder"
                    :required="field.required"
                  >
                  <button
                    v-if="field.typeOptions?.password"
                    @click.prevent="togglePasswordVisibility(field.name)"
                    type="button"
                    class="toggle-password"
                  >
                    <IconEye v-if="!passwordVisible[field.name]" />
                    <IconEyeOff v-else />
                  </button>
                </div>
                
                <select
                  v-else-if="field.type === 'options'"
                  :id="field.name"
                  v-model="credentialData[field.name]"
                  :required="field.required"
                >
                  <option value="">Choose...</option>
                  <option
                    v-for="option in field.options"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.name }}
                  </option>
                </select>
                
                <textarea
                  v-else-if="field.type === 'text'"
                  :id="field.name"
                  v-model="credentialData[field.name]"
                  :placeholder="field.placeholder"
                  :required="field.required"
                  rows="4"
                />
                
                <p v-if="field.hint" class="field-hint">
                  {{ field.hint }}
                </p>
              </div>
              
              <div v-if="configureError" class="error-message">
                <IconAlert /> {{ configureError }}
              </div>
              
              <div class="form-actions">
                <button type="button" @click="currentStep = 'select'" class="btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  :disabled="isSaving"
                  class="btn-primary"
                >
                  <span v-if="!isSaving">Save & Test</span>
                  <span v-else>
                    <IconLoader class="spinning" /> Saving...
                  </span>
                </button>
              </div>
            </form>
          </div>
          
          <div v-else-if="currentStep === 'test'" class="step-test">
            <div class="test-status" :class="testStatus">
              <div v-if="testStatus === 'testing'" class="test-icon">
                <IconLoader class="spinning large" />
              </div>
              <div v-else-if="testStatus === 'success'" class="test-icon">
                <IconCheckCircle class="large success" />
              </div>
              <div v-else-if="testStatus === 'error'" class="test-icon">
                <IconXCircle class="large error" />
              </div>
              
              <h3>{{ testMessage }}</h3>
              <p v-if="testDetails" class="test-details">{{ testDetails }}</p>
              
              <div v-if="testStatus !== 'testing'" class="test-actions">
                <button
                  v-if="testStatus === 'error'"
                  @click="currentStep = 'configure'"
                  class="btn-secondary"
                >
                  Back to Configure
                </button>
                <button
                  v-else
                  @click="currentStep = 'select'"
                  class="btn-primary"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import axios from 'axios';
import IconKey from './icons/IconKey.vue';
import IconX from './icons/IconX.vue';
import IconCheck from './icons/IconCheck.vue';
import IconAlert from './icons/IconAlert.vue';
import IconLoader from './icons/IconLoader.vue';
import IconArrowLeft from './icons/IconArrowLeft.vue';
import IconEye from './icons/IconEye.vue';
import IconEyeOff from './icons/IconEyeOff.vue';
import IconCheckCircle from './icons/IconCheckCircle.vue';
import IconXCircle from './icons/IconXCircle.vue';

// Types
interface RequiredCredential {
  type: string;
  name: string;
  description: string;
  icon?: string;
  configured: boolean;
  helpText?: string;
}

interface CredentialField {
  name: string;
  displayName: string;
  type: 'string' | 'options' | 'text';
  required: boolean;
  placeholder?: string;
  hint?: string;
  typeOptions?: {
    password?: boolean;
  };
  options?: Array<{ name: string; value: string }>;
}

// Props & Emits
const props = defineProps<{
  isOpen: boolean;
  requiredCredentials: RequiredCredential[];
}>();

const emit = defineEmits<{
  close: [];
  configured: [credentials: Record<string, any>];
  apply: [];
}>();

// State
const currentStep = ref<'select' | 'configure' | 'test'>('select');
const selectedCredential = ref<RequiredCredential | null>(null);
const credentialData = ref<Record<string, any>>({});
const passwordVisible = ref<Record<string, boolean>>({});
const testingCredential = ref<string | null>(null);
const isSaving = ref(false);
const configureError = ref('');
const testStatus = ref<'idle' | 'testing' | 'success' | 'error'>('idle');
const testMessage = ref('');
const testDetails = ref('');

// Mock credential fields based on type
const credentialFields = computed((): CredentialField[] => {
  if (!selectedCredential.value) return [];
  
  // Mock fields - in real implementation, fetch from n8n
  const fieldsByType: Record<string, CredentialField[]> = {
    'httpBasicAuth': [
      {
        name: 'user',
        displayName: 'Username',
        type: 'string',
        required: true,
        placeholder: 'Enter username',
      },
      {
        name: 'password',
        displayName: 'Password',
        type: 'string',
        required: true,
        placeholder: 'Enter password',
        typeOptions: { password: true },
      },
    ],
    'httpHeaderAuth': [
      {
        name: 'name',
        displayName: 'Header Name',
        type: 'string',
        required: true,
        placeholder: 'X-API-Key',
      },
      {
        name: 'value',
        displayName: 'Header Value',
        type: 'string',
        required: true,
        placeholder: 'Enter API key',
        typeOptions: { password: true },
      },
    ],
    'googleApi': [
      {
        name: 'email',
        displayName: 'Service Account Email',
        type: 'string',
        required: true,
        placeholder: 'your-service-account@project.iam.gserviceaccount.com',
      },
      {
        name: 'privateKey',
        displayName: 'Private Key',
        type: 'text',
        required: true,
        placeholder: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----',
        hint: 'The private key from your service account JSON file',
      },
    ],
    'slackApi': [
      {
        name: 'accessToken',
        displayName: 'Access Token',
        type: 'string',
        required: true,
        placeholder: 'xoxb-your-token',
        typeOptions: { password: true },
        hint: 'Bot User OAuth Access Token from your Slack app',
      },
    ],
  };
  
  return fieldsByType[selectedCredential.value.type] || [
    {
      name: 'apiKey',
      displayName: 'API Key',
      type: 'string',
      required: true,
      placeholder: 'Enter API key',
      typeOptions: { password: true },
    },
  ];
});

// Computed
const allCredentialsConfigured = computed(() => 
  props.requiredCredentials.every(c => c.configured)
);

const progressPercentage = computed(() => {
  const configured = props.requiredCredentials.filter(c => c.configured).length;
  const total = props.requiredCredentials.length;
  return total > 0 ? (configured / total) * 100 : 0;
});

// Methods
function close() {
  emit('close');
}

function configureCredential(credential: RequiredCredential) {
  selectedCredential.value = credential;
  credentialData.value = {};
  passwordVisible.value = {};
  configureError.value = '';
  currentStep.value = 'configure';
}

async function testCredential(credential: RequiredCredential) {
  testingCredential.value = credential.type;
  
  try {
    // Mock test - in real implementation, call n8n API
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Simulate random success/failure
    if (Math.random() > 0.2) {
      console.log('Credential test passed:', credential.type);
    } else {
      throw new Error('Connection failed');
    }
  } catch (error) {
    console.error('Credential test failed:', error);
  } finally {
    testingCredential.value = null;
  }
}

async function saveCredential() {
  isSaving.value = true;
  configureError.value = '';
  
  try {
    // Validate required fields
    for (const field of credentialFields.value) {
      if (field.required && !credentialData.value[field.name]) {
        throw new Error(`${field.displayName} is required`);
      }
    }
    
    // Save credential (mock)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test credential
    currentStep.value = 'test';
    testStatus.value = 'testing';
    testMessage.value = 'Testing connection...';
    testDetails.value = '';
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate test result
    if (Math.random() > 0.1) {
      testStatus.value = 'success';
      testMessage.value = 'Connection successful!';
      testDetails.value = 'Your credentials have been verified and saved.';
      
      // Mark as configured
      if (selectedCredential.value) {
        selectedCredential.value.configured = true;
        emit('configured', { [selectedCredential.value.type]: credentialData.value });
      }
    } else {
      testStatus.value = 'error';
      testMessage.value = 'Connection failed';
      testDetails.value = 'Unable to authenticate with the provided credentials.';
    }
    
  } catch (error: any) {
    configureError.value = error.message || 'Failed to save credential';
  } finally {
    isSaving.value = false;
  }
}

function togglePasswordVisibility(field: string) {
  passwordVisible.value[field] = !passwordVisible.value[field];
}

function proceedToApply() {
  emit('apply');
}

function handleIconError(event: Event) {
  (event.target as HTMLImageElement).src = '/node-icons/default.svg';
}

// Reset when closed
watch(() => props.isOpen, (isOpen) => {
  if (!isOpen) {
    currentStep.value = 'select';
    selectedCredential.value = null;
    credentialData.value = {};
    passwordVisible.value = {};
    testStatus.value = 'idle';
  }
});
</script>

<style scoped>
.secrets-wizard-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.secrets-wizard {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.wizard-header {
  padding: 24px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.wizard-header h2 {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  font-size: 24px;
  color: #333;
}

.header-icon {
  width: 28px;
  height: 28px;
  color: #ff6d5a;
}

.close-btn {
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  color: #666;
  border-radius: 6px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f5f5f5;
  color: #333;
}

.wizard-progress {
  height: 4px;
  background: #f0f0f0;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #ff6d5a 0%, #ff8b7a 100%);
  transition: width 0.3s ease;
}

.wizard-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.step-description {
  color: #666;
  margin: 0 0 24px 0;
  font-size: 16px;
}

/* Select Step */
.required-credentials {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 32px;
}

.credential-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  transition: all 0.2s;
}

.credential-item:hover {
  border-color: #ff6d5a;
  box-shadow: 0 4px 12px rgba(255, 109, 90, 0.1);
}

.credential-configured {
  border-color: #7fb069;
  background: #f8fdf6;
}

.credential-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f8f8;
  border-radius: 8px;
}

.credential-icon img {
  width: 32px;
  height: 32px;
}

.credential-info {
  flex: 1;
}

.credential-info h4 {
  margin: 0 0 4px 0;
  font-size: 18px;
  color: #333;
}

.credential-info p {
  margin: 0 0 8px 0;
  color: #666;
  font-size: 14px;
}

.credential-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}

.credential-status.configured {
  color: #7fb069;
}

.credential-status.missing {
  color: #ff6d5a;
}

.credential-actions {
  display: flex;
  gap: 8px;
}

.btn-configure,
.btn-test {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-configure {
  background: #ff6d5a;
  color: white;
}

.btn-configure:hover {
  background: #ff5544;
}

.btn-test {
  background: #f0f0f0;
  color: #333;
}

.btn-test:hover:not(:disabled) {
  background: #e0e0e0;
}

.btn-test:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Configure Step */
.back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  color: #666;
  font-size: 14px;
  cursor: pointer;
  padding: 4px 8px;
  margin: -4px -8px 16px -8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.back-btn:hover {
  background: #f5f5f5;
  color: #333;
}

.credential-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-field label {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.required {
  color: #ff3333;
}

.field-input {
  position: relative;
}

.field-input input {
  width: 100%;
  padding: 10px 12px;
  padding-right: 40px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

input:focus,
select:focus,
textarea:focus {
  outline: none;
  border-color: #ff6d5a;
}

select,
textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  transition: border-color 0.2s;
}

.toggle-password {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: #666;
}

.field-hint {
  font-size: 12px;
  color: #999;
  margin: 0;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #ffebee;
  border-radius: 6px;
  color: #c62828;
  font-size: 14px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}

/* Test Step */
.test-status {
  text-align: center;
  padding: 40px 20px;
}

.test-icon {
  margin-bottom: 24px;
}

.test-icon svg.large {
  width: 64px;
  height: 64px;
}

.test-icon svg.success {
  color: #7fb069;
}

.test-icon svg.error {
  color: #ff3333;
}

.test-status h3 {
  margin: 0 0 12px 0;
  font-size: 24px;
  color: #333;
}

.test-details {
  color: #666;
  font-size: 16px;
  margin: 0 0 32px 0;
}

.test-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
}

/* Actions */
.wizard-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #e0e0e0;
}

.btn-primary,
.btn-secondary {
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #ff6d5a;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #ff5544;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 109, 90, 0.25);
}

.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.btn-secondary {
  background: white;
  color: #666;
  border: 1px solid #ddd;
}

.btn-secondary:hover {
  background: #f5f5f5;
  border-color: #ccc;
}

/* Animations */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .secrets-wizard,
.modal-leave-to .secrets-wizard {
  transform: scale(0.9) translateY(20px);
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>