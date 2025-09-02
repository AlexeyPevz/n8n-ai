<template>
  <n8n-modal
    :name="MODAL_KEY"
    :title="$locale.baseText('ai.secretsWizard.title')"
    :showClose="false"
    :closeOnClickModal="false"
    :closeOnPressEscape="false"
    width="600px"
    :center="true"
    @enter="onNext"
  >
    <template #header>
      <div class="wizard-header">
        <div class="wizard-icon">
          <n8n-icon icon="key" size="xlarge" :color="iconColor" />
        </div>
        <div class="wizard-info">
          <h2>{{ currentStepTitle }}</h2>
          <n8n-text size="small" color="text-light">
            {{ currentStepSubtitle }}
          </n8n-text>
        </div>
      </div>
      
      <!-- Progress indicator -->
      <div class="wizard-progress">
        <div
          v-for="(step, index) in steps"
          :key="step.id"
          class="progress-step"
          :class="{
            active: index === currentStepIndex,
            completed: index < currentStepIndex,
          }"
        >
          <div class="step-indicator">
            <n8n-icon
              v-if="index < currentStepIndex"
              icon="check"
              size="xsmall"
            />
            <span v-else>{{ index + 1 }}</span>
          </div>
          <n8n-text size="xsmall" v-if="index < steps.length - 1">
            {{ step.name }}
          </n8n-text>
        </div>
      </div>
    </template>

    <template #content>
      <div class="wizard-content">
        <!-- Step 1: Detection -->
        <div v-if="currentStep.id === 'detection'" class="step-detection">
          <n8n-notice
            type="info"
            :content="$locale.baseText('ai.secretsWizard.detectionNotice')"
          />
          
          <div class="required-credentials">
            <n8n-text tag="h4">
              {{ $locale.baseText('ai.secretsWizard.requiredCredentials') }}
            </n8n-text>
            
            <div class="credentials-list">
              <div
                v-for="cred in requiredCredentials"
                :key="cred.type"
                class="credential-item"
                :class="{ resolved: cred.resolved }"
              >
                <div class="credential-icon">
                  <CredentialIcon :credentialType="cred.type" />
                </div>
                
                <div class="credential-info">
                  <n8n-text tag="p" :bold="true">
                    {{ cred.displayName }}
                  </n8n-text>
                  <n8n-text tag="p" size="small" color="text-light">
                    {{ cred.description }}
                  </n8n-text>
                  <n8n-text
                    v-if="cred.node"
                    tag="p"
                    size="xsmall"
                    color="text-light"
                  >
                    {{ $locale.baseText('ai.secretsWizard.requiredBy', { 
                      interpolate: { node: cred.node } 
                    }) }}
                  </n8n-text>
                </div>
                
                <div class="credential-status">
                  <n8n-icon
                    v-if="cred.resolved"
                    icon="check-circle"
                    color="success"
                  />
                  <n8n-icon
                    v-else
                    icon="exclamation-triangle"
                    color="warning"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <n8n-callout
            v-if="hasExistingCredentials"
            theme="success"
            icon="info-circle"
          >
            {{ $locale.baseText('ai.secretsWizard.existingCredentialsFound', {
              interpolate: { count: existingCredentialsCount }
            }) }}
          </n8n-callout>
        </div>

        <!-- Step 2: Selection -->
        <div v-else-if="currentStep.id === 'selection'" class="step-selection">
          <div
            v-for="cred in unresolvedCredentials"
            :key="cred.type"
            class="credential-setup"
          >
            <div class="setup-header">
              <CredentialIcon :credentialType="cred.type" />
              <n8n-text tag="h4">{{ cred.displayName }}</n8n-text>
            </div>
            
            <n8n-radio-buttons
              v-model="credentialChoices[cred.type]"
              :options="getCredentialOptions(cred)"
              @update:modelValue="onCredentialChoiceChange(cred.type, $event)"
            />
            
            <!-- Existing credential selector -->
            <div
              v-if="credentialChoices[cred.type] === 'existing'"
              class="existing-selector"
            >
              <n8n-select
                v-model="selectedCredentials[cred.type]"
                :placeholder="$locale.baseText('ai.secretsWizard.selectCredential')"
                size="medium"
              >
                <n8n-option
                  v-for="existing in getExistingCredentials(cred.type)"
                  :key="existing.id"
                  :label="existing.name"
                  :value="existing.id"
                >
                  <div class="credential-option">
                    <span>{{ existing.name }}</span>
                    <n8n-icon
                      v-if="existing.isValid"
                      icon="check-circle"
                      color="success"
                      size="xsmall"
                    />
                  </div>
                </n8n-option>
              </n8n-select>
              
              <n8n-button
                type="tertiary"
                size="small"
                icon="sync"
                @click="testCredential(cred.type)"
                :loading="testingCredentials[cred.type]"
              >
                {{ $locale.baseText('ai.secretsWizard.testConnection') }}
              </n8n-button>
            </div>
            
            <!-- New credential info -->
            <div
              v-else-if="credentialChoices[cred.type] === 'create'"
              class="create-info"
            >
              <n8n-notice type="info">
                {{ $locale.baseText('ai.secretsWizard.createInfo') }}
              </n8n-notice>
            </div>
          </div>
        </div>

        <!-- Step 3: Creation -->
        <div v-else-if="currentStep.id === 'creation'" class="step-creation">
          <div
            v-for="cred in credentialsToCreate"
            :key="cred.type"
            class="credential-form"
          >
            <div class="form-header">
              <CredentialIcon :credentialType="cred.type" />
              <n8n-text tag="h4">{{ cred.displayName }}</n8n-text>
            </div>
            
            <!-- Dynamic credential form based on type -->
            <CredentialForm
              :credentialType="cred.type"
              v-model="newCredentials[cred.type]"
              @test="onTestNewCredential(cred.type)"
              @valid="onCredentialValid(cred.type, $event)"
            />
            
            <!-- Help links -->
            <div class="credential-help">
              <n8n-link
                v-if="cred.documentationUrl"
                :href="cred.documentationUrl"
                :newWindow="true"
                size="small"
              >
                <n8n-icon icon="book" size="xsmall" />
                {{ $locale.baseText('ai.secretsWizard.documentation') }}
              </n8n-link>
              
              <n8n-info-tip
                v-if="cred.hint"
                :content="cred.hint"
                theme="info"
              />
            </div>
          </div>
        </div>

        <!-- Step 4: Summary -->
        <div v-else-if="currentStep.id === 'summary'" class="step-summary">
          <n8n-notice
            type="success"
            :content="$locale.baseText('ai.secretsWizard.summarySuccess')"
          />
          
          <div class="summary-list">
            <n8n-text tag="h4">
              {{ $locale.baseText('ai.secretsWizard.configuredCredentials') }}
            </n8n-text>
            
            <div
              v-for="(config, type) in finalConfiguration"
              :key="type"
              class="summary-item"
            >
              <CredentialIcon :credentialType="type" />
              <div class="summary-info">
                <n8n-text tag="p">
                  {{ getCredentialDisplayName(type) }}
                </n8n-text>
                <n8n-text tag="p" size="small" color="text-light">
                  {{ config.isNew ? 
                    $locale.baseText('ai.secretsWizard.newlyCreated') : 
                    $locale.baseText('ai.secretsWizard.existing', { 
                      interpolate: { name: config.name } 
                    }) 
                  }}
                </n8n-text>
              </div>
              <n8n-icon
                icon="check-circle"
                color="success"
              />
            </div>
          </div>
          
          <n8n-callout
            theme="info"
            icon="lightbulb"
          >
            {{ $locale.baseText('ai.secretsWizard.nextSteps') }}
          </n8n-callout>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="wizard-footer">
        <n8n-button
          v-if="currentStepIndex > 0"
          type="tertiary"
          @click="onBack"
        >
          {{ $locale.baseText('ai.secretsWizard.back') }}
        </n8n-button>
        
        <div class="footer-actions">
          <n8n-button
            type="secondary"
            @click="onSkip"
            v-if="canSkip"
          >
            {{ $locale.baseText('ai.secretsWizard.skip') }}
          </n8n-button>
          
          <n8n-button
            type="primary"
            @click="onNext"
            :disabled="!canProceed"
            :loading="isProcessing"
          >
            {{ nextButtonText }}
            <template #icon>
              <n8n-icon :icon="isLastStep ? 'check' : 'arrow-right'" />
            </template>
          </n8n-button>
        </div>
      </div>
    </template>
  </n8n-modal>
</template>

<script lang="ts">
import { defineComponent, ref, computed } from 'vue';
import { useCredentialsStore } from '@/stores/credentials';
import { useI18n } from '@/composables';
import CredentialIcon from './CredentialIcon.vue';
import CredentialForm from './CredentialForm.vue';

export const SECRETS_WIZARD_MODAL_KEY = 'secretsWizard';

interface RequiredCredential {
  type: string;
  displayName: string;
  description: string;
  node?: string;
  resolved: boolean;
  documentationUrl?: string;
  hint?: string;
}

export default defineComponent({
  name: 'SecretsWizardModal',
  components: {
    CredentialIcon,
    CredentialForm,
  },
  props: {
    requiredCredentials: {
      type: Array as () => RequiredCredential[],
      required: true,
    },
  },
  emits: ['complete', 'skip'],
  setup(props, { emit }) {
    const i18n = useI18n();
    const credentialsStore = useCredentialsStore();
    const MODAL_KEY = SECRETS_WIZARD_MODAL_KEY;
    
    const steps = [
      { id: 'detection', name: i18n.baseText('ai.secretsWizard.step.detection') },
      { id: 'selection', name: i18n.baseText('ai.secretsWizard.step.selection') },
      { id: 'creation', name: i18n.baseText('ai.secretsWizard.step.creation') },
      { id: 'summary', name: i18n.baseText('ai.secretsWizard.step.summary') },
    ];
    
    const currentStepIndex = ref(0);
    const credentialChoices = ref<Record<string, 'existing' | 'create' | 'skip'>>({});
    const selectedCredentials = ref<Record<string, string>>({});
    const newCredentials = ref<Record<string, any>>({});
    const testingCredentials = ref<Record<string, boolean>>({});
    const validCredentials = ref<Record<string, boolean>>({});
    const isProcessing = ref(false);
    
    const currentStep = computed(() => steps[currentStepIndex.value]);
    const isLastStep = computed(() => currentStepIndex.value === steps.length - 1);
    
    const unresolvedCredentials = computed(() => 
      props.requiredCredentials.filter(c => !c.resolved)
    );
    
    const hasExistingCredentials = computed(() => 
      props.requiredCredentials.some(c => c.resolved)
    );
    
    const existingCredentialsCount = computed(() => 
      props.requiredCredentials.filter(c => c.resolved).length
    );
    
    const credentialsToCreate = computed(() => 
      unresolvedCredentials.value.filter(c => credentialChoices.value[c.type] === 'create')
    );
    
    const canSkip = computed(() => {
      return currentStep.value.id === 'selection' && 
        unresolvedCredentials.value.every(c => 
          credentialChoices.value[c.type] === 'skip'
        );
    });
    
    const canProceed = computed(() => {
      switch (currentStep.value.id) {
        case 'detection':
          return true;
          
        case 'selection':
          return unresolvedCredentials.value.every(c => {
            const choice = credentialChoices.value[c.type];
            if (choice === 'existing') {
              return !!selectedCredentials.value[c.type];
            }
            return !!choice;
          });
          
        case 'creation':
          return credentialsToCreate.value.every(c => 
            validCredentials.value[c.type]
          );
          
        case 'summary':
          return true;
          
        default:
          return false;
      }
    });
    
    const currentStepTitle = computed(() => {
      switch (currentStep.value.id) {
        case 'detection':
          return i18n.baseText('ai.secretsWizard.title.detection');
        case 'selection':
          return i18n.baseText('ai.secretsWizard.title.selection');
        case 'creation':
          return i18n.baseText('ai.secretsWizard.title.creation');
        case 'summary':
          return i18n.baseText('ai.secretsWizard.title.summary');
        default:
          return '';
      }
    });
    
    const currentStepSubtitle = computed(() => {
      switch (currentStep.value.id) {
        case 'detection':
          return i18n.baseText('ai.secretsWizard.subtitle.detection', {
            interpolate: { count: unresolvedCredentials.value.length }
          });
        case 'selection':
          return i18n.baseText('ai.secretsWizard.subtitle.selection');
        case 'creation':
          return i18n.baseText('ai.secretsWizard.subtitle.creation', {
            interpolate: { count: credentialsToCreate.value.length }
          });
        case 'summary':
          return i18n.baseText('ai.secretsWizard.subtitle.summary');
        default:
          return '';
      }
    });
    
    const iconColor = computed(() => {
      switch (currentStep.value.id) {
        case 'detection': return 'warning';
        case 'selection': return 'primary';
        case 'creation': return 'secondary';
        case 'summary': return 'success';
        default: return 'text-base';
      }
    });
    
    const nextButtonText = computed(() => {
      if (isLastStep.value) {
        return i18n.baseText('ai.secretsWizard.complete');
      }
      return i18n.baseText('ai.secretsWizard.next');
    });
    
    const finalConfiguration = computed(() => {
      const config: Record<string, any> = {};
      
      for (const cred of props.requiredCredentials) {
        if (cred.resolved) {
          config[cred.type] = { isNew: false, name: 'Existing' };
        } else if (credentialChoices.value[cred.type] === 'existing') {
          const selected = selectedCredentials.value[cred.type];
          const existing = getExistingCredentials(cred.type).find(e => e.id === selected);
          config[cred.type] = { isNew: false, name: existing?.name || 'Unknown' };
        } else if (credentialChoices.value[cred.type] === 'create') {
          config[cred.type] = { isNew: true, name: 'New credential' };
        }
      }
      
      return config;
    });
    
    const getCredentialOptions = (cred: RequiredCredential) => {
      const options = [
        {
          label: i18n.baseText('ai.secretsWizard.useExisting'),
          value: 'existing',
          disabled: !hasExistingCredentialsOfType(cred.type),
        },
        {
          label: i18n.baseText('ai.secretsWizard.createNew'),
          value: 'create',
        },
      ];
      
      if (!cred.required) {
        options.push({
          label: i18n.baseText('ai.secretsWizard.skipForNow'),
          value: 'skip',
        });
      }
      
      return options;
    };
    
    const hasExistingCredentialsOfType = (type: string) => {
      // В реальном коде здесь бы был запрос к store
      return Math.random() > 0.5; // Mock
    };
    
    const getExistingCredentials = (type: string) => {
      // В реальном коде здесь бы был запрос к store
      return [
        { id: '1', name: `My ${type} credentials`, isValid: true },
        { id: '2', name: `${type} - Production`, isValid: false },
      ];
    };
    
    const testCredential = async (type: string) => {
      testingCredentials.value[type] = true;
      
      // Симуляция теста
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      testingCredentials.value[type] = false;
    };
    
    const onCredentialChoiceChange = (type: string, value: string) => {
      // Сброс выбора при изменении
      delete selectedCredentials.value[type];
      delete newCredentials.value[type];
      delete validCredentials.value[type];
    };
    
    const onTestNewCredential = async (type: string) => {
      testingCredentials.value[type] = true;
      
      // Симуляция теста
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      testingCredentials.value[type] = false;
    };
    
    const onCredentialValid = (type: string, isValid: boolean) => {
      validCredentials.value[type] = isValid;
    };
    
    const getCredentialDisplayName = (type: string) => {
      const cred = props.requiredCredentials.find(c => c.type === type);
      return cred?.displayName || type;
    };
    
    const onNext = async () => {
      if (isLastStep.value) {
        isProcessing.value = true;
        
        // Применяем конфигурацию
        const configuration = {
          credentials: finalConfiguration.value,
          skipped: unresolvedCredentials.value
            .filter(c => credentialChoices.value[c.type] === 'skip')
            .map(c => c.type),
        };
        
        emit('complete', configuration);
        
        setTimeout(() => {
          isProcessing.value = false;
        }, 500);
      } else {
        // Пропускаем шаг создания если нет credentials для создания
        if (currentStep.value.id === 'selection' && credentialsToCreate.value.length === 0) {
          currentStepIndex.value = steps.findIndex(s => s.id === 'summary');
        } else {
          currentStepIndex.value++;
        }
      }
    };
    
    const onBack = () => {
      currentStepIndex.value--;
    };
    
    const onSkip = () => {
      emit('skip');
    };
    
    return {
      MODAL_KEY,
      steps,
      currentStep,
      currentStepIndex,
      isLastStep,
      unresolvedCredentials,
      hasExistingCredentials,
      existingCredentialsCount,
      credentialsToCreate,
      credentialChoices,
      selectedCredentials,
      newCredentials,
      testingCredentials,
      validCredentials,
      isProcessing,
      canSkip,
      canProceed,
      currentStepTitle,
      currentStepSubtitle,
      iconColor,
      nextButtonText,
      finalConfiguration,
      getCredentialOptions,
      getExistingCredentials,
      testCredential,
      onCredentialChoiceChange,
      onTestNewCredential,
      onCredentialValid,
      getCredentialDisplayName,
      onNext,
      onBack,
      onSkip,
    };
  },
});
</script>

<style lang="scss" scoped>
.wizard-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-m);
  margin-bottom: var(--spacing-l);
  
  .wizard-icon {
    padding: var(--spacing-s);
    background: var(--color-background-light);
    border-radius: var(--border-radius-base);
  }
  
  .wizard-info {
    h2 {
      margin: 0;
    }
  }
}

.wizard-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-3xs);
  margin-bottom: var(--spacing-l);
  
  .progress-step {
    display: flex;
    align-items: center;
    gap: var(--spacing-3xs);
    
    .step-indicator {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-background-base);
      border: 2px solid var(--color-foreground-base);
      font-size: var(--font-size-2xs);
      font-weight: var(--font-weight-bold);
      
      &.completed {
        background: var(--color-success);
        border-color: var(--color-success);
        color: white;
      }
      
      &.active {
        background: var(--color-primary);
        border-color: var(--color-primary);
        color: white;
      }
    }
    
    &:not(:last-child)::after {
      content: '';
      width: 40px;
      height: 2px;
      background: var(--color-foreground-base);
      margin: 0 var(--spacing-xs);
    }
    
    &.completed::after {
      background: var(--color-success);
    }
  }
}

.wizard-content {
  min-height: 300px;
}

.credential-item,
.credential-setup,
.credential-form,
.summary-item {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-s);
  padding: var(--spacing-s);
  background: var(--color-background-light);
  border: 1px solid var(--color-foreground-base);
  border-radius: var(--border-radius-base);
  margin-bottom: var(--spacing-s);
  
  &.resolved {
    opacity: 0.7;
  }
  
  .credential-icon {
    flex-shrink: 0;
  }
  
  .credential-info,
  .summary-info {
    flex: 1;
    
    p {
      margin: 0;
    }
  }
  
  .credential-status {
    flex-shrink: 0;
  }
}

.credential-setup {
  flex-direction: column;
  
  .setup-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-s);
    width: 100%;
  }
  
  .existing-selector {
    display: flex;
    gap: var(--spacing-s);
    align-items: center;
    margin-top: var(--spacing-s);
    
    .n8n-select {
      flex: 1;
    }
  }
  
  .create-info {
    margin-top: var(--spacing-s);
  }
}

.credential-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.credential-help {
  display: flex;
  align-items: center;
  gap: var(--spacing-m);
  margin-top: var(--spacing-s);
}

.summary-list {
  margin-top: var(--spacing-l);
}

.wizard-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  .footer-actions {
    display: flex;
    gap: var(--spacing-s);
  }
}
</style>