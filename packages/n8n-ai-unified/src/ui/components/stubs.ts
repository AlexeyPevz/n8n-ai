/**
 * Заглушки для n8n компонентов
 * В реальной интеграции будут использоваться настоящие компоненты n8n
 */

import { defineComponent, h } from 'vue';

// Stub компоненты, которые будут заменены реальными из n8n
export const WorkflowCanvas = defineComponent({
  name: 'WorkflowCanvas',
  props: ['nodes', 'connections', 'readonly', 'zoom', 'highlights'],
  render() {
    return h('div', { class: 'workflow-canvas-stub' }, 'Workflow Canvas');
  }
});

export const CredentialIcon = defineComponent({
  name: 'CredentialIcon',
  props: ['credentialType'],
  render() {
    return h('span', { class: 'credential-icon' }, '🔑');
  }
});

export const CredentialForm = defineComponent({
  name: 'CredentialForm',
  props: ['credentialType', 'modelValue'],
  emits: ['update:modelValue', 'test', 'valid'],
  render() {
    return h('div', { class: 'credential-form-stub' }, 'Credential Form');
  }
});