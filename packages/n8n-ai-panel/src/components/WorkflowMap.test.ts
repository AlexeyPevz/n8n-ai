import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import WorkflowMap from './WorkflowMap.vue';

// Mock fetch
global.fetch = vi.fn();

describe('WorkflowMap', () => {
  const mockWorkflowData = {
    workflows: [
      {
        id: 'wf1',
        name: 'Main Workflow',
        active: true,
        nodeCount: 5,
        tags: ['production'],
        updatedAt: '2024-01-15T10:00:00Z',
      },
      {
        id: 'wf2',
        name: 'Sub Workflow',
        active: false,
        nodeCount: 3,
        tags: ['utility'],
        updatedAt: '2024-01-14T10:00:00Z',
      },
    ],
    dependencies: [
      {
        from: 'wf1',
        to: 'wf2',
        type: 'execute-workflow',
        count: 2,
      },
    ],
    stats: {
      totalWorkflows: 2,
      activeWorkflows: 1,
      totalConnections: 1,
    },
  };

  let wrapper: any;

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockWorkflowData,
    });

    wrapper = mount(WorkflowMap, {
      global: {
        stubs: {
          // Stub child components if needed
        },
      },
    });
  });

  describe('data loading', () => {
    it('should load workflow map data on mount', async () => {
      await wrapper.vm.$nextTick();
      await vi.delay(100); // Wait for async operations

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/workflow-map'),
        expect.any(Object)
      );
    });

    it('should display loading state initially', () => {
      const newWrapper = mount(WorkflowMap);
      expect(newWrapper.find('.loading-container').exists()).toBe(true);
      expect(newWrapper.text()).toContain('Loading workflow map...');
    });

    it('should display workflows after loading', async () => {
      await wrapper.vm.$nextTick();
      await vi.delay(100);

      const nodes = wrapper.findAll('.workflow-node');
      expect(nodes).toHaveLength(2);
      
      expect(nodes[0].text()).toContain('Main Workflow');
      expect(nodes[1].text()).toContain('Sub Workflow');
    });

    it('should handle loading errors', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));
      
      const errorWrapper = mount(WorkflowMap);
      await errorWrapper.vm.$nextTick();
      await vi.delay(100);

      expect(errorWrapper.find('.error-state').exists()).toBe(true);
      expect(errorWrapper.text()).toContain('Failed to load workflow map');
    });
  });

  describe('workflow visualization', () => {
    beforeEach(async () => {
      await wrapper.vm.$nextTick();
      await vi.delay(100);
    });

    it('should render workflow nodes', () => {
      const nodes = wrapper.findAll('.workflow-node');
      expect(nodes).toHaveLength(2);

      // Check first node
      const mainNode = nodes[0];
      expect(mainNode.find('.workflow-name').text()).toBe('Main Workflow');
      expect(mainNode.find('.node-count').text()).toContain('5 nodes');
      expect(mainNode.find('.status-badge').classes()).toContain('active');
    });

    it('should show workflow connections', () => {
      const connections = wrapper.findAll('.workflow-connection');
      expect(connections).toHaveLength(1);

      // Connection should have path element
      const path = connections[0].find('path');
      expect(path.exists()).toBe(true);
    });

    it('should highlight active workflows', () => {
      const activeNode = wrapper.find('.workflow-node.active');
      expect(activeNode.exists()).toBe(true);
      expect(activeNode.find('.workflow-name').text()).toBe('Main Workflow');
    });

    it('should show workflow tags', () => {
      const tags = wrapper.findAll('.workflow-tag');
      expect(tags.length).toBeGreaterThan(0);
      
      const tagTexts = tags.map((t: any) => t.text());
      expect(tagTexts).toContain('production');
      expect(tagTexts).toContain('utility');
    });
  });

  describe('interactions', () => {
    beforeEach(async () => {
      await wrapper.vm.$nextTick();
      await vi.delay(100);
    });

    it('should select workflow on click', async () => {
      const node = wrapper.find('.workflow-node');
      await node.trigger('click');

      expect(node.classes()).toContain('selected');
      expect(wrapper.vm.selectedWorkflow).toBe('wf1');
    });

    it('should show workflow details on selection', async () => {
      await wrapper.find('.workflow-node').trigger('click');

      const details = wrapper.find('.workflow-details');
      expect(details.exists()).toBe(true);
      expect(details.text()).toContain('Main Workflow');
      expect(details.text()).toContain('5 nodes');
      expect(details.text()).toContain('Active');
    });

    it('should highlight connected workflows on hover', async () => {
      const node = wrapper.find('.workflow-node');
      await node.trigger('mouseenter');

      // Connected workflow should be highlighted
      const connectedNode = wrapper.findAll('.workflow-node')[1];
      expect(connectedNode.classes()).toContain('highlighted');
    });

    it('should open workflow on double click', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      
      const node = wrapper.find('.workflow-node');
      await node.trigger('dblclick');

      expect(openSpy).toHaveBeenCalledWith(
        expect.stringContaining('/workflow/wf1'),
        '_blank'
      );
    });
  });

  describe('real-time updates', () => {
    it('should establish WebSocket connection', async () => {
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.ws).toBeDefined();
      expect(wrapper.vm.ws.url).toContain('/workflow-map/live');
    });

    it('should handle execution status updates', async () => {
      await wrapper.vm.$nextTick();
      await vi.delay(100);

      // Simulate WebSocket message
      const statusUpdate = {
        type: 'execution_status',
        workflowId: 'wf1',
        status: 'running',
        startedAt: new Date().toISOString(),
      };

      wrapper.vm.handleWebSocketMessage({ data: JSON.stringify(statusUpdate) });
      await wrapper.vm.$nextTick();

      const runningNode = wrapper.find('.workflow-node.running');
      expect(runningNode.exists()).toBe(true);
      expect(runningNode.find('.execution-status').exists()).toBe(true);
    });

    it('should update execution progress', async () => {
      await wrapper.vm.$nextTick();
      await vi.delay(100);

      const progressUpdate = {
        type: 'execution_progress',
        workflowId: 'wf1',
        progress: 60,
        currentNode: 'HTTP Request',
      };

      wrapper.vm.handleWebSocketMessage({ data: JSON.stringify(progressUpdate) });
      await wrapper.vm.$nextTick();

      const progressBar = wrapper.find('.execution-progress');
      expect(progressBar.exists()).toBe(true);
      expect(progressBar.attributes('style')).toContain('width: 60%');
    });

    it('should show cost updates', async () => {
      await wrapper.vm.$nextTick();
      await vi.delay(100);

      const costUpdate = {
        type: 'cost_update',
        workflowId: 'wf1',
        cost: {
          total: 0.05,
          breakdown: {
            api: 0.03,
            compute: 0.02,
          },
        },
      };

      wrapper.vm.handleWebSocketMessage({ data: JSON.stringify(costUpdate) });
      await wrapper.vm.$nextTick();

      const costBadge = wrapper.find('.workflow-cost');
      expect(costBadge.exists()).toBe(true);
      expect(costBadge.text()).toContain('$0.05');
    });
  });

  describe('filtering and search', () => {
    beforeEach(async () => {
      await wrapper.vm.$nextTick();
      await vi.delay(100);
    });

    it('should filter workflows by search term', async () => {
      const searchInput = wrapper.find('.search-input');
      await searchInput.setValue('Sub');

      const visibleNodes = wrapper.findAll('.workflow-node:not(.hidden)');
      expect(visibleNodes).toHaveLength(1);
      expect(visibleNodes[0].text()).toContain('Sub Workflow');
    });

    it('should filter by active status', async () => {
      const activeFilter = wrapper.find('.filter-active');
      await activeFilter.trigger('click');

      const visibleNodes = wrapper.findAll('.workflow-node:not(.hidden)');
      expect(visibleNodes).toHaveLength(1);
      expect(visibleNodes[0].text()).toContain('Main Workflow');
    });

    it('should filter by tags', async () => {
      const tagFilter = wrapper.find('.tag-filter[data-tag="utility"]');
      await tagFilter.trigger('click');

      const visibleNodes = wrapper.findAll('.workflow-node:not(.hidden)');
      expect(visibleNodes).toHaveLength(1);
      expect(visibleNodes[0].text()).toContain('Sub Workflow');
    });

    it('should clear filters', async () => {
      // Apply filter
      await wrapper.find('.search-input').setValue('Sub');
      expect(wrapper.findAll('.workflow-node:not(.hidden)')).toHaveLength(1);

      // Clear filters
      await wrapper.find('.clear-filters').trigger('click');
      expect(wrapper.findAll('.workflow-node:not(.hidden)')).toHaveLength(2);
    });
  });

  describe('layout controls', () => {
    beforeEach(async () => {
      await wrapper.vm.$nextTick();
      await vi.delay(100);
    });

    it('should support different layout modes', async () => {
      const layoutButtons = wrapper.findAll('.layout-button');
      
      // Hierarchical layout
      await layoutButtons[0].trigger('click');
      expect(wrapper.vm.layoutMode).toBe('hierarchical');

      // Force-directed layout
      await layoutButtons[1].trigger('click');
      expect(wrapper.vm.layoutMode).toBe('force');

      // Grid layout
      await layoutButtons[2].trigger('click');
      expect(wrapper.vm.layoutMode).toBe('grid');
    });

    it('should zoom in and out', async () => {
      const initialZoom = wrapper.vm.zoomLevel;
      
      await wrapper.find('.zoom-in').trigger('click');
      expect(wrapper.vm.zoomLevel).toBeGreaterThan(initialZoom);

      await wrapper.find('.zoom-out').trigger('click');
      await wrapper.find('.zoom-out').trigger('click');
      expect(wrapper.vm.zoomLevel).toBeLessThan(initialZoom);
    });

    it('should fit to screen', async () => {
      await wrapper.find('.fit-to-screen').trigger('click');
      
      // Should calculate and apply appropriate zoom/pan
      expect(wrapper.vm.zoomLevel).toBeDefined();
      expect(wrapper.vm.panX).toBeDefined();
      expect(wrapper.vm.panY).toBeDefined();
    });
  });

  describe('statistics panel', () => {
    beforeEach(async () => {
      await wrapper.vm.$nextTick();
      await vi.delay(100);
    });

    it('should display workflow statistics', () => {
      const stats = wrapper.find('.stats-panel');
      expect(stats.exists()).toBe(true);

      expect(stats.text()).toContain('2 workflows');
      expect(stats.text()).toContain('1 active');
      expect(stats.text()).toContain('1 connection');
    });

    it('should update stats in real-time', async () => {
      const statsUpdate = {
        type: 'stats_update',
        stats: {
          totalWorkflows: 3,
          activeWorkflows: 2,
          totalConnections: 2,
          executionsToday: 15,
        },
      };

      wrapper.vm.handleWebSocketMessage({ data: JSON.stringify(statsUpdate) });
      await wrapper.vm.$nextTick();

      const stats = wrapper.find('.stats-panel');
      expect(stats.text()).toContain('3 workflows');
      expect(stats.text()).toContain('2 active');
      expect(stats.text()).toContain('15 executions today');
    });
  });

  describe('refresh functionality', () => {
    it('should refresh data on button click', async () => {
      await wrapper.vm.$nextTick();
      await vi.delay(100);

      vi.clearAllMocks();
      
      await wrapper.find('.refresh-button').trigger('click');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/workflow-map/refresh'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should show refresh animation', async () => {
      const refreshBtn = wrapper.find('.refresh-button');
      expect(refreshBtn.classes()).not.toContain('refreshing');

      await refreshBtn.trigger('click');
      expect(refreshBtn.classes()).toContain('refreshing');
    });
  });

  describe('error states', () => {
    it('should show error when no workflows found', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ workflows: [], dependencies: [], stats: {} }),
      });

      const emptyWrapper = mount(WorkflowMap);
      await emptyWrapper.vm.$nextTick();
      await vi.delay(100);

      expect(emptyWrapper.find('.empty-state').exists()).toBe(true);
      expect(emptyWrapper.text()).toContain('No workflows found');
    });

    it('should handle WebSocket disconnection', async () => {
      await wrapper.vm.$nextTick();

      // Simulate WebSocket close
      wrapper.vm.ws.close();
      await wrapper.vm.$nextTick();

      const reconnectMsg = wrapper.find('.connection-status.disconnected');
      expect(reconnectMsg.exists()).toBe(true);
      expect(reconnectMsg.text()).toContain('Disconnected');
    });
  });
});