import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import CostTooltip from './CostTooltip.vue';

describe('CostTooltip', () => {
  const mockCostData = {
    apiCalls: 10,
    executionTime: 5000, // 5 seconds
    dataProcessed: 1024 * 1024, // 1MB
    llmTokens: {
      prompt: 100,
      completion: 200,
      model: 'gpt-4',
    },
  };

  const mockHistoricalData = {
    average: 0.05,
    min: 0.01,
    max: 0.1,
    runs: 100,
  };

  let wrapper: any;

  beforeEach(() => {
    wrapper = mount(CostTooltip, {
      props: {
        cost: mockCostData,
        historicalData: mockHistoricalData,
      },
    });
  });

  describe('cost indicator', () => {
    it('should render cost indicator with formatted value', () => {
      const indicator = wrapper.find('.cost-indicator');
      expect(indicator.exists()).toBe(true);
      
      const costValue = indicator.find('.cost-value');
      expect(costValue.exists()).toBe(true);
      // Should show formatted cost
      expect(costValue.text()).toMatch(/[\d.]+/);
    });

    it('should apply correct cost level class', async () => {
      const indicator = wrapper.find('.cost-indicator');
      
      // Default should be low/medium/high based on cost
      expect(
        indicator.classes().some((c: string) => 
          ['cost-low', 'cost-medium', 'cost-high'].includes(c)
        )
      ).toBe(true);
    });

    it('should show tooltip on hover', async () => {
      expect(wrapper.find('.cost-tooltip').exists()).toBe(false);
      
      await wrapper.find('.cost-indicator').trigger('mouseenter');
      expect(wrapper.find('.cost-tooltip').exists()).toBe(true);
      
      await wrapper.find('.cost-indicator').trigger('mouseleave');
      expect(wrapper.find('.cost-tooltip').exists()).toBe(false);
    });
  });

  describe('cost breakdown', () => {
    it('should display cost breakdown by type', async () => {
      await wrapper.find('.cost-indicator').trigger('mouseenter');
      
      const breakdown = wrapper.find('.cost-breakdown');
      expect(breakdown.exists()).toBe(true);
      
      const costItems = breakdown.findAll('.cost-item');
      expect(costItems.length).toBeGreaterThan(0);
      
      // Should show AI costs (highest)
      const aiItem = costItems.find((item: any) => 
        item.find('.cost-type').text().includes('AI Processing')
      );
      expect(aiItem).toBeTruthy();
    });

    it('should show cost details for each type', async () => {
      await wrapper.find('.cost-indicator').trigger('mouseenter');
      
      const details = wrapper.findAll('.cost-details');
      expect(details.length).toBeGreaterThan(0);
      
      // Check API calls details
      const apiDetails = wrapper.find('.cost-item .detail-row');
      if (apiDetails.exists()) {
        expect(apiDetails.text()).toMatch(/Requests|Rate/);
      }
    });

    it('should display cost bars proportionally', async () => {
      await wrapper.find('.cost-indicator').trigger('mouseenter');
      
      const costBars = wrapper.findAll('.cost-bar');
      expect(costBars.length).toBeGreaterThan(0);
      
      // Bars should have width style
      costBars.forEach((bar: any) => {
        const style = bar.attributes('style');
        expect(style).toMatch(/width:\s*\d+(\.\d+)?%/);
      });
    });
  });

  describe('optimization suggestions', () => {
    it('should show optimization tips for high usage', async () => {
      await wrapper.find('.cost-indicator').trigger('mouseenter');
      
      const optimizations = wrapper.find('.cost-optimizations');
      if (optimizations.exists()) {
        const tips = optimizations.findAll('li');
        expect(tips.length).toBeGreaterThan(0);
        
        // Should show API batching tip
        const apiTip = tips.find((tip: any) => 
          tip.text().includes('batching')
        );
        expect(apiTip).toBeTruthy();
      }
    });

    it('should show potential savings', async () => {
      await wrapper.find('.cost-indicator').trigger('mouseenter');
      
      const savings = wrapper.find('.savings');
      if (savings.exists()) {
        expect(savings.text()).toMatch(/Save.*\$[\d.]+/);
      }
    });
  });

  describe('historical comparison', () => {
    it('should show comparison with average', async () => {
      await wrapper.find('.cost-indicator').trigger('mouseenter');
      
      const history = wrapper.find('.cost-history');
      expect(history.exists()).toBe(true);
      
      const avgItem = history.find('.history-item');
      expect(avgItem.text()).toContain('Average (last 7 days)');
      expect(avgItem.text()).toMatch(/\$?[\d.]+/);
    });

    it('should show percentage change', async () => {
      await wrapper.find('.cost-indicator').trigger('mouseenter');
      
      const percentageItem = wrapper.findAll('.history-item')[1];
      if (percentageItem) {
        expect(percentageItem.text()).toMatch(/[+-]?\d+(\.\d+)?%/);
        
        // Should have appropriate styling
        const value = percentageItem.find('span:last-child');
        expect(
          value.classes().includes('cost-up') || 
          value.classes().includes('cost-down')
        ).toBe(true);
      }
    });

    it('should show trend icon', async () => {
      await wrapper.find('.cost-indicator').trigger('mouseenter');
      
      const trendIcon = wrapper.find('.cost-up svg, .cost-down svg');
      expect(trendIcon.exists()).toBe(true);
    });
  });

  describe('cost calculation', () => {
    it('should calculate total cost correctly', () => {
      // Total should be sum of all components
      const totalText = wrapper.find('.cost-value').text();
      expect(totalText).toBeTruthy();
      
      // For the mock data, should be > 0
      const totalValue = parseFloat(totalText) || 0;
      expect(totalValue).toBeGreaterThan(0);
    });

    it('should handle missing cost components', () => {
      const minimalWrapper = mount(CostTooltip, {
        props: {
          cost: { apiCalls: 5 }, // Only API calls
        },
      });
      
      // Should still render without errors
      expect(minimalWrapper.find('.cost-indicator').exists()).toBe(true);
      const value = minimalWrapper.find('.cost-value').text();
      expect(value).toBeTruthy();
    });

    it('should format costs appropriately', async () => {
      await wrapper.find('.cost-indicator').trigger('mouseenter');
      
      const totalCost = wrapper.find('.cost-total');
      expect(totalCost.text()).toMatch(/^\$[\d.]+$/);
      
      // Very small costs should show <0.01
      const smallCostWrapper = mount(CostTooltip, {
        props: {
          cost: { apiCalls: 1 },
        },
      });
      
      await smallCostWrapper.find('.cost-indicator').trigger('mouseenter');
      const smallTotal = smallCostWrapper.find('.cost-total').text();
      expect(smallTotal).toMatch(/\$(<0\.01|0\.00\d)/);
    });
  });

  describe('pricing info', () => {
    it('should show pricing disclaimer', async () => {
      await wrapper.find('.cost-indicator').trigger('mouseenter');
      
      const pricingInfo = wrapper.find('.pricing-info');
      expect(pricingInfo.exists()).toBe(true);
      expect(pricingInfo.text()).toContain('estimated based on current pricing');
    });

    it('should emit event when pricing link clicked', async () => {
      await wrapper.find('.cost-indicator').trigger('mouseenter');
      
      const pricingLink = wrapper.find('.pricing-info a');
      await pricingLink.trigger('click');
      
      expect(wrapper.emitted('show-pricing')).toBeTruthy();
    });
  });

  describe('tooltip positioning', () => {
    it('should position tooltip above when specified', async () => {
      const aboveWrapper = mount(CostTooltip, {
        props: {
          cost: mockCostData,
          position: 'above',
        },
      });
      
      await aboveWrapper.find('.cost-indicator').trigger('mouseenter');
      
      const tooltip = aboveWrapper.find('.cost-tooltip');
      expect(tooltip.classes()).toContain('tooltip-above');
    });
  });

  describe('empty state', () => {
    it('should handle zero cost', () => {
      const zeroCostWrapper = mount(CostTooltip, {
        props: {
          cost: {},
        },
      });
      
      const value = zeroCostWrapper.find('.cost-value').text();
      expect(value).toBe('0');
    });
  });
});