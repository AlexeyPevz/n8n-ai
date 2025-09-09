<template>
  <div class="cost-tooltip-container">
    <!-- Cost indicator -->
    <div
      class="cost-indicator"
      :class="costLevel"
      @mouseenter="showTooltip = true"
      @mouseleave="showTooltip = false"
    >
      <IconDollar />
      <span class="cost-value">{{ formatCost(totalCost) }}</span>
    </div>

    <!-- Tooltip -->
    <transition name="tooltip">
      <div
        v-if="showTooltip"
        class="cost-tooltip"
        :class="{ 'tooltip-above': position === 'above' }"
      >
        <div class="tooltip-header">
          <h4>Execution Cost Breakdown</h4>
          <span class="cost-total">{{ formatCost(totalCost, true) }}</span>
        </div>

        <!-- Cost breakdown by type -->
        <div class="cost-breakdown">
          <div
v-for="item in costBreakdown" :key="item.type"
class="cost-item"
>
            <div class="cost-item-header">
              <span class="cost-type">
                <component :is="item.icon" class="cost-icon" />
                {{ item.label }}
              </span>
              <span class="cost-amount">{{ formatCost(item.amount) }}</span>
            </div>

            <div v-if="item.details" class="cost-details">
              <div
v-for="(detail, index) in item.details" :key="index"
class="detail-row"
>
                <span class="detail-label">{{ detail.label }}</span>
                <span class="detail-value">{{ detail.value }}</span>
              </div>
            </div>

            <div
              v-if="item.amount > 0"
              class="cost-bar"
              :style="{ width: `${(item.amount / totalCost) * 100}%` }"
            />
          </div>
        </div>

        <!-- Optimization suggestions -->
        <div v-if="optimizations.length > 0" class="cost-optimizations">
          <h5>
            <IconLightbulb />
            Cost Optimization Tips
          </h5>
          <ul>
            <li
v-for="(tip, index) in optimizations" :key="index"
>
              {{ tip.text }}
              <span v-if="tip.savings" class="savings">
                (Save ~{{ formatCost(tip.savings) }})
              </span>
            </li>
          </ul>
        </div>

        <!-- Historical comparison -->
        <div v-if="historicalData" class="cost-history">
          <div class="history-item">
            <span>Average (last 7 days):</span>
            <span :class="{ 'cost-up': isAboveAverage, 'cost-down': !isAboveAverage }">
              {{ formatCost(historicalData.average) }}
              <IconTrendUp v-if="isAboveAverage" />
              <IconTrendDown v-else />
            </span>
          </div>
          <div class="history-item">
            <span>This run vs average:</span>
            <span :class="{ 'cost-up': percentageChange > 0, 'cost-down': percentageChange < 0 }">
              {{ percentageChange > 0 ? '+' : '' }}{{ percentageChange.toFixed(1) }}%
            </span>
          </div>
        </div>

        <!-- Pricing info -->
        <div class="pricing-info">
          <p>
            <IconInfo />
            Costs are estimated based on current pricing. Actual costs may vary.
          </p>
          <a href="#" @click.prevent="$emit('show-pricing')"> View pricing details → </a>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

import IconStubs from './icons/IconStubs.vue';
const IconDollar = IconStubs as any;
const IconCloud = IconStubs as any;
const IconCpu = IconStubs as any;
const IconDatabase = IconStubs as any;
const IconBot = IconStubs as any;
const IconLightbulb = IconStubs as any;
const IconInfo = IconStubs as any;
const IconTrendUp = IconStubs as any;
const IconTrendDown = IconStubs as any;

// Types
interface CostData {
  tokens?: number;
  apiCalls?: number;
  executionTime?: number; // milliseconds
  dataProcessed?: number; // bytes
  llmTokens?: {
    prompt: number;
    completion: number;
    model: string;
  };
}

interface HistoricalData {
  average: number;
  min: number;
  max: number;
  runs: number;
}

interface Optimization {
  text: string;
  savings?: number;
}

// Props
const props = defineProps<{
  cost: CostData;
  historicalData?: HistoricalData;
  position?: 'above' | 'below';
}>();

// const emit = defineEmits<{
//   'show-pricing': [];
// }>();

// State
const showTooltip = ref(false);

// Cost calculations
const costRates = {
  // API calls
  httpRequest: 0.0001, // $0.0001 per request
  webhook: 0.00005, // $0.00005 per webhook

  // Compute
  executionTime: 0.00001, // $0.00001 per second

  // Data
  dataTransfer: 0.00000001, // $0.00000001 per byte

  // LLM tokens (per 1K tokens)
  'gpt-4': 0.03,
  'gpt-3.5-turbo': 0.002,
  'claude-3': 0.015,
  'claude-2': 0.008,
};

// Computed
const totalCost = computed(() => {
  let total = 0;

  // API calls cost
  if (props.cost.apiCalls) {
    total += props.cost.apiCalls * costRates.httpRequest;
  }

  // Execution time cost
  if (props.cost.executionTime) {
    total += (props.cost.executionTime / 1000) * costRates.executionTime;
  }

  // Data transfer cost
  if (props.cost.dataProcessed) {
    total += props.cost.dataProcessed * costRates.dataTransfer;
  }

  // LLM tokens cost
  if (props.cost.llmTokens) {
    const rate = costRates[props.cost.llmTokens.model as keyof typeof costRates] || 0.01;
    const totalTokens = props.cost.llmTokens.prompt + props.cost.llmTokens.completion;
    total += (totalTokens / 1000) * rate;
  }

  return total;
});

const costLevel = computed(() => {
  if (totalCost.value < 0.01) return 'cost-low';
  if (totalCost.value < 0.1) return 'cost-medium';
  return 'cost-high';
});

const costBreakdown = computed(() => {
  const breakdown = [];

  // API Calls
  if (props.cost.apiCalls) {
    breakdown.push({
      type: 'api',
      label: 'API Calls',
      icon: IconCloud,
      amount: props.cost.apiCalls * costRates.httpRequest,
      details: [
        { label: 'Requests', value: props.cost.apiCalls },
        { label: 'Rate', value: `$${costRates.httpRequest}/call` },
      ],
    });
  }

  // Compute
  if (props.cost.executionTime) {
    const seconds = props.cost.executionTime / 1000;
    breakdown.push({
      type: 'compute',
      label: 'Compute Time',
      icon: IconCpu,
      amount: seconds * costRates.executionTime,
      details: [
        { label: 'Duration', value: `${seconds.toFixed(2)}s` },
        { label: 'Rate', value: `$${costRates.executionTime}/sec` },
      ],
    });
  }

  // Data
  if (props.cost.dataProcessed) {
    const mb = props.cost.dataProcessed / (1024 * 1024);
    breakdown.push({
      type: 'data',
      label: 'Data Transfer',
      icon: IconDatabase,
      amount: props.cost.dataProcessed * costRates.dataTransfer,
      details: [
        { label: 'Volume', value: `${mb.toFixed(2)} MB` },
        { label: 'Rate', value: `$${costRates.dataTransfer}/byte` },
      ],
    });
  }

  // AI/LLM
  if (props.cost.llmTokens) {
    const { prompt, completion, model } = props.cost.llmTokens;
    const totalTokens = prompt + completion;
    const rate = costRates[model as keyof typeof costRates] || 0.01;
    breakdown.push({
      type: 'ai',
      label: 'AI Processing',
      icon: IconBot,
      amount: (totalTokens / 1000) * rate,
      details: [
        { label: 'Model', value: model },
        { label: 'Tokens', value: totalTokens.toLocaleString() },
        { label: 'Prompt', value: prompt.toLocaleString() },
        { label: 'Response', value: completion.toLocaleString() },
      ],
    });
  }

  // Preserve a stable order (API, Compute, Data, AI) to satisfy tests that
  // inspect the first detail row without filtering by type.
  return breakdown;
});

const optimizations = computed((): Optimization[] => {
  const tips: Optimization[] = [];

  // Check for expensive API calls
  if (props.cost.apiCalls && props.cost.apiCalls > 10) {
    tips.push({
      text: 'Consider batching API requests to reduce call count',
      savings: props.cost.apiCalls * costRates.httpRequest * 0.3,
    });
  }

  // Check for long execution time
  if (props.cost.executionTime && props.cost.executionTime > 30000) {
    tips.push({
      text: 'Long execution time detected. Consider splitting into smaller workflows',
      savings: (props.cost.executionTime / 1000) * costRates.executionTime * 0.2,
    });
  }

  // Check for large data processing
  if (props.cost.dataProcessed && props.cost.dataProcessed > 10 * 1024 * 1024) {
    tips.push({
      text: 'Processing large amounts of data. Consider filtering or pagination',
      savings: props.cost.dataProcessed * costRates.dataTransfer * 0.4,
    });
  }

  // Check for expensive LLM usage
  if (props.cost.llmTokens) {
    const { model, prompt, completion } = props.cost.llmTokens;

    if (model === 'gpt-4' && prompt + completion > 1000) {
      tips.push({
        text: 'Consider using GPT-3.5 for this task to reduce costs',
        savings: ((prompt + completion) / 1000) * (costRates['gpt-4'] - costRates['gpt-3.5-turbo']),
      });
    }

    if (prompt > completion * 2) {
      tips.push({
        text: 'Large prompt detected. Consider caching or reducing context',
      });
    }
  }

  return tips.slice(0, 3); // Show max 3 tips
});

const isAboveAverage = computed(() => {
  return props.historicalData ? totalCost.value > props.historicalData.average : false;
});

const percentageChange = computed(() => {
  if (!props.historicalData || props.historicalData.average === 0) return 0;
  return ((totalCost.value - props.historicalData.average) / props.historicalData.average) * 100;
});

// Methods
function formatCost(amount: number, includeSign = false): string {
  if (amount === 0) return includeSign ? '$0.00' : '0';

  const prefix = includeSign ? '$' : '';

  if (amount < 0.01) {
    return `${prefix}<0.01`;
  } else if (amount < 1) {
    return `${prefix}${amount.toFixed(3)}`;
  } else {
    return `${prefix}${amount.toFixed(2)}`;
  }
}
</script>

<style scoped>
.cost-tooltip-container {
  position: relative;
  display: inline-block;
}

.cost-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  cursor: help;
  transition: all 0.2s;
  font-size: 12px;
  font-weight: 500;
}

.cost-indicator:hover {
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.cost-indicator svg {
  width: 14px;
  height: 14px;
}

.cost-low {
  color: #7fb069;
  border-color: #7fb069;
}

.cost-medium {
  color: #f39c12;
  border-color: #f39c12;
}

.cost-high {
  color: #ff6d5a;
  border-color: #ff6d5a;
}

.cost-value {
  font-family: monospace;
}

/* Tooltip */
.cost-tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 8px;
  width: 360px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  overflow: hidden;
}

.tooltip-above {
  top: auto;
  bottom: 100%;
  margin-top: 0;
  margin-bottom: 8px;
}

.tooltip-header {
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tooltip-header h4 {
  margin: 0;
  font-size: 14px;
  color: #333;
}

.cost-total {
  font-size: 18px;
  font-weight: 600;
  color: #ff6d5a;
  font-family: monospace;
}

/* Cost breakdown */
.cost-breakdown {
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
}

.cost-item {
  margin-bottom: 16px;
}

.cost-item:last-child {
  margin-bottom: 0;
}

.cost-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.cost-type {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #333;
}

.cost-icon {
  width: 16px;
  height: 16px;
  color: #666;
}

.cost-amount {
  font-family: monospace;
  font-size: 13px;
  color: #666;
}

.cost-details {
  margin-left: 22px;
  margin-bottom: 6px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #999;
  padding: 2px 0;
}

.detail-value {
  font-family: monospace;
}

.cost-bar {
  height: 3px;
  background: linear-gradient(90deg, #ff6d5a 0%, #ff8b7a 100%);
  border-radius: 2px;
  margin-left: 22px;
  transition: width 0.3s ease;
}

/* Optimizations */
.cost-optimizations {
  padding: 16px;
  background: #f8f8f8;
  border-bottom: 1px solid #e0e0e0;
}

.cost-optimizations h5 {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 8px 0;
  font-size: 12px;
  font-weight: 600;
  color: #333;
}

.cost-optimizations h5 svg {
  width: 16px;
  height: 16px;
  color: #f39c12;
}

.cost-optimizations ul {
  margin: 0;
  padding-left: 22px;
  list-style: none;
}

.cost-optimizations li {
  position: relative;
  font-size: 12px;
  color: #666;
  padding: 4px 0;
  padding-left: 16px;
}

.cost-optimizations li::before {
  content: '•';
  position: absolute;
  left: 0;
  color: #f39c12;
}

.savings {
  color: #7fb069;
  font-weight: 500;
  font-size: 11px;
}

/* History */
.cost-history {
  padding: 12px 16px;
  background: #f0f0f0;
  border-bottom: 1px solid #e0e0e0;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  padding: 4px 0;
}

.history-item span:first-child {
  color: #666;
}

.cost-up {
  color: #ff6d5a;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
}

.cost-down {
  color: #7fb069;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
}

.cost-up svg,
.cost-down svg {
  width: 12px;
  height: 12px;
}

/* Pricing info */
.pricing-info {
  padding: 12px 16px;
  background: #fafafa;
}

.pricing-info p {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0 0 8px 0;
  font-size: 11px;
  color: #999;
  line-height: 1.4;
}

.pricing-info p svg {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  margin-top: 1px;
}

.pricing-info a {
  font-size: 12px;
  color: #ff6d5a;
  text-decoration: none;
  font-weight: 500;
}

.pricing-info a:hover {
  text-decoration: underline;
}

/* Animations */
.tooltip-enter-active,
.tooltip-leave-active {
  transition: all 0.2s ease;
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-10px) scale(0.95);
}

.tooltip-above.tooltip-enter-from,
.tooltip-above.tooltip-leave-to {
  transform: translateX(-50%) translateY(10px) scale(0.95);
}
</style>
