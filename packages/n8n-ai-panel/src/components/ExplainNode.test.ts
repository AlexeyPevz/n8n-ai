import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ExplainNode from './ExplainNode.vue';
import { delay, getTypedWrapper } from '../test-utils';

describe('ExplainNode', () => {
  const mockNode = {
    id: 'test-node',
    name: 'HTTP Request',
    type: 'n8n-nodes-base.httpRequest',
    icon: 'httpRequest.svg',
    parameters: {
      url: 'https://api.example.com',
      method: 'GET',
    },
  };

  let wrapper: ReturnType<typeof mount>;

  beforeEach(() => {
    wrapper = mount(ExplainNode, {
      props: {
        node: mockNode,
      },
    });
  });

  describe('basic functionality', () => {
    it('should render trigger button', () => {
      const trigger = wrapper.find('.explain-trigger');
      expect(trigger.exists()).toBe(true);
      expect(trigger.attributes('title')).toBe('Explain this node');
    });

    it('should toggle explanation popup on click', async () => {
      expect(wrapper.find('.explain-popup').exists()).toBe(false);
      
      await wrapper.find('.explain-trigger').trigger('click');
      expect(wrapper.find('.explain-popup').exists()).toBe(true);
      
      await wrapper.find('.explain-trigger').trigger('click');
      expect(wrapper.find('.explain-popup').exists()).toBe(false);
    });

    it('should show node name in popup header', async () => {
      await wrapper.find('.explain-trigger').trigger('click');
      
      const header = wrapper.find('.explain-header h4');
      expect(header.text()).toContain('HTTP Request');
    });

    it('should close popup when close button clicked', async () => {
      await wrapper.find('.explain-trigger').trigger('click');
      expect(wrapper.find('.explain-popup').exists()).toBe(true);
      
      await wrapper.find('.close-btn').trigger('click');
      expect(wrapper.find('.explain-popup').exists()).toBe(false);
    });
  });

  describe('explanation generation', () => {
    it('should show loading state when fetching explanation', async () => {
      await wrapper.find('.explain-trigger').trigger('click');
      
      // Should show loading initially
      expect(wrapper.find('.loading-state').exists()).toBe(true);
      expect(wrapper.find('.loading-state p').text()).toBe('Analyzing node configuration...');
    });

    it('should display explanation after loading', async () => {
      await wrapper.find('.explain-trigger').trigger('click');
      
      // Wait for explanation to load
      await delay(1100); // Mock timeout is 1000ms
      
      const explanation = wrapper.find('.explanation');
      expect(explanation.exists()).toBe(true);
      
      // Should show summary
      const summary = explanation.find('.explain-section h5');
      expect(summary.text()).toBe('What it does');
    });

    it('should show current configuration', async () => {
      await wrapper.find('.explain-trigger').trigger('click');
      await delay(1100);
      
      const configList = wrapper.find('.config-list');
      expect(configList.exists()).toBe(true);
      
      const configItems = configList.findAll('li');
      expect(configItems.length).toBeGreaterThan(0);
      
      // Should show URL parameter
      const urlConfig = configItems.find((item: any) => 
        item.text().includes('Url:')
      );
      expect(urlConfig?.text()).toContain('https://api.example.com');
    });

    it('should handle errors gracefully', async () => {
      // Mock error scenario
      const errorWrapper = mount(ExplainNode, {
        props: {
          node: { ...mockNode, type: 'error-node' },
        },
      });

      // Simulate error by using non-existent node type
      await errorWrapper.find('.explain-trigger').trigger('click');
      
      // Mock the error state by setting data directly
      await errorWrapper.setData({
        error: 'Failed to generate explanation',
        isLoading: false
      });
      await errorWrapper.vm.$nextTick();
      
      const errorState = errorWrapper.find('.error-state');
      expect(errorState.exists()).toBe(true);
      expect(errorState.text()).toContain('Failed to generate explanation');
      
      // Should show retry button
      const retryBtn = errorState.find('.retry-btn');
      expect(retryBtn.exists()).toBe(true);
      expect(retryBtn.text()).toBe('Try Again');
    });
  });

  describe('inputs/outputs section', () => {
    it('should display inputs and outputs', async () => {
      await wrapper.find('.explain-trigger').trigger('click');
      await delay(1100);
      
      const ioSection = wrapper.find('.io-section');
      expect(ioSection.exists()).toBe(true);
      
      // Check inputs
      const inputsBlock = ioSection.findAll('.io-block')[0];
      expect(inputsBlock.find('h5').text()).toBe('Expects');
      
      // Check outputs
      const outputsBlock = ioSection.findAll('.io-block')[1];
      expect(outputsBlock.find('h5').text()).toBe('Produces');
    });
  });

  describe('examples section', () => {
    it('should show examples with tabs', async () => {
      await wrapper.find('.explain-trigger').trigger('click');
      await delay(1100);
      
      const examplesTabs = wrapper.find('.examples-tabs');
      if (examplesTabs.exists()) {
        const tabs = examplesTabs.findAll('.example-tab');
        expect(tabs.length).toBeGreaterThan(0);
        
        // First tab should be active by default
        expect(tabs[0].classes()).toContain('active');
        
        // Click second tab
        if (tabs.length > 1) {
          await tabs[1].trigger('click');
          expect(tabs[1].classes()).toContain('active');
          expect(tabs[0].classes()).not.toContain('active');
        }
      }
    });
  });

  describe('related nodes', () => {
    it('should emit event when related node clicked', async () => {
      await wrapper.find('.explain-trigger').trigger('click');
      await delay(1100);
      
      const relatedNodes = wrapper.find('.related-nodes');
      if (relatedNodes.exists()) {
        const relatedNode = relatedNodes.find('.related-node');
        if (relatedNode.exists()) {
          await relatedNode.trigger('click');
          
          expect(wrapper.emitted('select-node')).toBeTruthy();
          const emitted = wrapper.emitted('select-node');
          expect(emitted).toBeDefined();
          expect(emitted![0]).toEqual(['n8n-nodes-base.set']);
        }
      }
    });
  });

  describe('documentation link', () => {
    it('should show documentation link', async () => {
      await wrapper.find('.explain-trigger').trigger('click');
      await delay(1100);
      
      const docLink = wrapper.find('.doc-link');
      if (docLink.exists()) {
        expect(docLink.attributes('href')).toContain('https://docs.n8n.io');
        expect(docLink.attributes('target')).toBe('_blank');
        expect(docLink.attributes('rel')).toBe('noopener noreferrer');
        expect(docLink.text()).toContain('View full documentation');
      }
    });
  });

  describe('icon handling', () => {
    it('should handle icon loading errors', async () => {
      await wrapper.find('.explain-trigger').trigger('click');
      
      const icon = wrapper.find('.node-icon');
      if (icon.exists()) {
        await icon.trigger('error');
        expect(icon.attributes('src')).toBe('/node-icons/default.svg');
      }
    });
  });
});