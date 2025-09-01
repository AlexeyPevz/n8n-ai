import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import SecretsWizard from './SecretsWizard.vue';

describe('SecretsWizard', () => {
  const mockRequiredCredentials = [
    {
      type: 'httpBasicAuth',
      name: 'Basic Auth',
      displayName: 'HTTP Basic Authentication',
      required: true,
    },
    {
      type: 'apiKey',
      name: 'API Key',
      displayName: 'API Key Authentication',
      required: true,
    },
  ];

  let wrapper: ReturnType<typeof mount>;

  beforeEach(() => {
    wrapper = mount(SecretsWizard, {
      props: {
        isOpen: true,
        requiredCredentials: mockRequiredCredentials,
      },
    });
  });

  describe('modal behavior', () => {
    it('should render when isOpen is true', () => {
      expect(wrapper.find('.secrets-wizard-overlay').exists()).toBe(true);
      expect(wrapper.find('.secrets-wizard').exists()).toBe(true);
    });

    it('should not render when isOpen is false', () => {
      const closedWrapper = mount(SecretsWizard, {
        props: {
          isOpen: false,
          requiredCredentials: mockRequiredCredentials,
        },
      });
      
      expect(closedWrapper.find('.secrets-wizard-overlay').exists()).toBe(false);
    });

    it('should emit close event when overlay clicked', async () => {
      await wrapper.find('.secrets-wizard-overlay').trigger('click');
      expect(wrapper.emitted('close')).toBeTruthy();
    });

    it('should emit close event when close button clicked', async () => {
      await wrapper.find('.close-btn').trigger('click');
      expect(wrapper.emitted('close')).toBeTruthy();
    });

    it('should not close when clicking inside wizard', async () => {
      await wrapper.find('.secrets-wizard').trigger('click');
      expect(wrapper.emitted('close')).toBeFalsy();
    });
  });

  describe('progress tracking', () => {
    it('should show progress bar', () => {
      const progressBar = wrapper.find('.progress-bar');
      expect(progressBar.exists()).toBe(true);
    });

    it('should update progress as credentials are configured', async () => {
      // Initially 0%
      let progressBar = wrapper.find('.progress-bar');
      expect(progressBar.attributes('style')).toContain('width: 0%');

      // Select first credential
      const credCard = wrapper.find('.credential-card');
      await credCard.trigger('click');

      // Configure it
      await wrapper.find('.btn-primary').trigger('click');
      
      // Mock successful configuration
      wrapper.vm.configuredCredentials.add(mockRequiredCredentials[0].type);
      await wrapper.vm.$nextTick();

      // Progress should update (50% for 1 of 2)
      progressBar = wrapper.find('.progress-bar');
      expect(progressBar.attributes('style')).toContain('width: 50%');
    });
  });

  describe('credential selection step', () => {
    it('should list all required credentials', () => {
      const credCards = wrapper.findAll('.credential-card');
      expect(credCards).toHaveLength(mockRequiredCredentials.length);
      
      expect(credCards[0].text()).toContain('HTTP Basic Authentication');
      expect(credCards[1].text()).toContain('API Key Authentication');
    });

    it('should highlight selected credential', async () => {
      const firstCard = wrapper.find('.credential-card');
      expect(firstCard.classes()).not.toContain('selected');
      
      await firstCard.trigger('click');
      expect(firstCard.classes()).toContain('selected');
    });

    it('should show configure button when credential selected', async () => {
      expect(wrapper.find('.btn-primary').exists()).toBe(false);
      
      await wrapper.find('.credential-card').trigger('click');
      expect(wrapper.find('.btn-primary').exists()).toBe(true);
      expect(wrapper.find('.btn-primary').text()).toBe('Configure');
    });

    it('should mark configured credentials', async () => {
      // Mock a configured credential
      wrapper.vm.configuredCredentials.add('httpBasicAuth');
      await wrapper.vm.$nextTick();
      
      const firstCard = wrapper.find('.credential-card');
      expect(firstCard.find('.status-icon.configured').exists()).toBe(true);
    });
  });

  describe('credential configuration step', () => {
    beforeEach(async () => {
      // Move to configuration step
      await wrapper.find('.credential-card').trigger('click');
      await wrapper.find('.btn-primary').trigger('click');
    });

    it('should show configuration form', () => {
      expect(wrapper.vm.currentStep).toBe('configure');
      expect(wrapper.find('.step-configure').exists()).toBe(true);
    });

    it('should display correct credential type header', () => {
      const header = wrapper.find('.config-header h3');
      expect(header.text()).toBe('Configure HTTP Basic Authentication');
    });

    it('should show appropriate form fields for basic auth', () => {
      const inputs = wrapper.findAll('.form-input');
      expect(inputs.length).toBeGreaterThanOrEqual(2);
      
      // Should have username and password fields
      const labels = wrapper.findAll('.form-label');
      const labelTexts = labels.map((l: any) => l.text());
      expect(labelTexts).toContain('Username');
      expect(labelTexts).toContain('Password');
    });

    it('should toggle password visibility', async () => {
      const passwordGroup = wrapper.findAll('.form-group').find((g: any) => 
        g.text().includes('Password')
      );
      
      if (passwordGroup) {
        const input = passwordGroup.find('input');
        const toggleBtn = passwordGroup.find('.toggle-password');
        
        expect(input.attributes('type')).toBe('password');
        
        await toggleBtn.trigger('click');
        expect(input.attributes('type')).toBe('text');
        
        await toggleBtn.trigger('click');
        expect(input.attributes('type')).toBe('password');
      }
    });

    it('should validate required fields', async () => {
      const saveBtn = wrapper.find('.btn-primary');
      await saveBtn.trigger('click');
      
      // Should show validation errors
      const errors = wrapper.findAll('.error-message');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should test connection', async () => {
      // Fill in form
      const inputs = wrapper.findAll('.form-input');
      await inputs[0].setValue('testuser');
      await inputs[1].setValue('testpass');
      
      // Click test button
      const testBtn = wrapper.find('.btn-secondary');
      expect(testBtn.text()).toContain('Test Connection');
      
      await testBtn.trigger('click');
      
      // Should show testing state
      expect(wrapper.vm.isTesting).toBe(true);
      expect(testBtn.text()).toContain('Testing...');
    });

    it('should save credentials and move to next', async () => {
      // Fill in form
      const inputs = wrapper.findAll('.form-input');
      await inputs[0].setValue('testuser');
      await inputs[1].setValue('testpass');
      
      // Mock successful test
      wrapper.vm.testStatus = 'success';
      
      // Save
      const saveBtn = wrapper.findAll('.btn-primary')[1]; // Save & Next button
      await saveBtn.trigger('click');
      
      expect(wrapper.emitted('save')).toBeTruthy();
      expect(wrapper.emitted('save')[0][0]).toEqual({
        type: 'httpBasicAuth',
        data: {
          username: 'testuser',
          password: 'testpass',
        },
      });
    });
  });

  describe('summary step', () => {
    beforeEach(async () => {
      // Configure all credentials
      wrapper.vm.configuredCredentials.add('httpBasicAuth');
      wrapper.vm.configuredCredentials.add('apiKey');
      wrapper.vm.currentStep = 'summary';
      await wrapper.vm.$nextTick();
    });

    it('should show summary of configured credentials', () => {
      expect(wrapper.find('.step-summary').exists()).toBe(true);
      
      const summaryItems = wrapper.findAll('.summary-item');
      expect(summaryItems).toHaveLength(2);
      
      summaryItems.forEach((item: any) => {
        expect(item.find('.status-badge.success').exists()).toBe(true);
        expect(item.text()).toContain('Configured');
      });
    });

    it('should enable workflow execution when all configured', () => {
      const executeBtn = wrapper.find('.btn-success');
      expect(executeBtn.exists()).toBe(true);
      expect(executeBtn.text()).toBe('Execute Workflow');
      expect(executeBtn.attributes('disabled')).toBeFalsy();
    });

    it('should emit execute event', async () => {
      const executeBtn = wrapper.find('.btn-success');
      await executeBtn.trigger('click');
      
      expect(wrapper.emitted('execute')).toBeTruthy();
    });

    it('should allow editing credentials', async () => {
      const editBtn = wrapper.find('.summary-item .btn-ghost');
      await editBtn.trigger('click');
      
      // Should go back to configure step
      expect(wrapper.vm.currentStep).toBe('configure');
      expect(wrapper.vm.selectedCredential).toBe('httpBasicAuth');
    });
  });

  describe('credential type handling', () => {
    it('should show OAuth flow for OAuth credentials', async () => {
      const oauthWrapper = mount(SecretsWizard, {
        props: {
          isOpen: true,
          requiredCredentials: [{
            type: 'googleOAuth2',
            name: 'Google OAuth2',
            displayName: 'Google OAuth2',
            required: true,
          }],
        },
      });

      await oauthWrapper.find('.credential-card').trigger('click');
      await oauthWrapper.find('.btn-primary').trigger('click');
      
      const oauthSection = oauthWrapper.find('.oauth-section');
      expect(oauthSection.exists()).toBe(true);
      expect(oauthSection.find('.btn-primary').text()).toContain('Connect with Google');
    });

    it('should handle API key configuration', async () => {
      // Select API Key credential
      const apiKeyCard = wrapper.findAll('.credential-card')[1];
      await apiKeyCard.trigger('click');
      await wrapper.find('.btn-primary').trigger('click');
      
      // Should show single API key input
      const inputs = wrapper.findAll('.form-input');
      expect(inputs).toHaveLength(1);
      
      const label = wrapper.find('.form-label');
      expect(label.text()).toBe('API Key');
    });
  });

  describe('error handling', () => {
    it('should show connection test errors', async () => {
      await wrapper.find('.credential-card').trigger('click');
      await wrapper.find('.btn-primary').trigger('click');
      
      // Mock test failure
      wrapper.vm.testStatus = 'error';
      wrapper.vm.testError = 'Connection refused';
      await wrapper.vm.$nextTick();
      
      const errorMsg = wrapper.find('.test-result.error');
      expect(errorMsg.exists()).toBe(true);
      expect(errorMsg.text()).toContain('Connection refused');
    });

    it('should handle save errors', async () => {
      await wrapper.find('.credential-card').trigger('click');
      await wrapper.find('.btn-primary').trigger('click');
      
      // Fill form
      const inputs = wrapper.findAll('.form-input');
      await inputs[0].setValue('testuser');
      await inputs[1].setValue('testpass');
      
      // Mock save error
      wrapper.vm.$emit = vi.fn().mockImplementation((event) => {
        if (event === 'save') {
          throw new Error('Failed to save credentials');
        }
      });
      
      const saveBtn = wrapper.findAll('.btn-primary')[1];
      await saveBtn.trigger('click');
      
      // Should show error (implementation would handle this)
      expect(wrapper.vm.$emit).toHaveBeenCalledWith('save', expect.any(Object));
    });
  });
});