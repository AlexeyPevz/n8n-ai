import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ProgressBar from '../src/components/ProgressBar.vue';
import ChangesSummary from '../src/components/ChangesSummary.vue';

describe('ProgressBar', () => {
  it('renders percentage when value >= 0', () => {
    const w = mount(ProgressBar, { props: { value: 42 } });
    expect(w.text()).toContain('42%');
  });
});

describe('ChangesSummary', () => {
  it('renders counts when total > 0', () => {
    const w = mount(ChangesSummary, { props: { add_node: 1, connect: 2, set_params: 3, annotate: 0, del: 1, total: 7 } });
    expect(w.text()).toContain('+ 1');
    expect(w.text()).toContain('→ 2');
    expect(w.text()).toContain('⋯ 3');
    expect(w.text()).toContain('− 1');
  });
});

