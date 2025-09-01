<template>
  <div class="ai-thinking-overlay">
    <div class="thinking-content">
      <div class="thinking-animation">
        <div class="brain-container">
          <IconBrain class="brain-icon" />
          <div class="pulse-ring"></div>
          <div class="pulse-ring delay-1"></div>
          <div class="pulse-ring delay-2"></div>
        </div>
        
        <div class="thinking-dots">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>
      
      <h3 class="thinking-title">AI is thinking...</h3>
      <p class="thinking-message">{{ message }}</p>
      
      <div class="thinking-tips">
        <p class="tip">{{ currentTip }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import IconBrain from '../icons/IconBrain.vue';

const props = defineProps<{
  message: string;
}>();

const tips = [
  'AI is analyzing your requirements and identifying the best nodes to use',
  'Creating optimal connections between workflow components',
  'Configuring node parameters based on your description',
  'Ensuring data flows correctly through your workflow',
  'Adding error handling and validation where needed',
];

const currentTip = ref(tips[0]);
let tipInterval: NodeJS.Timer;

onMounted(() => {
  let tipIndex = 0;
  tipInterval = setInterval(() => {
    tipIndex = (tipIndex + 1) % tips.length;
    currentTip.value = tips[tipIndex];
  }, 3000);
});

onUnmounted(() => {
  if (tipInterval) {
    clearInterval(tipInterval);
  }
});
</script>

<style scoped>
.ai-thinking-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.thinking-content {
  text-align: center;
  padding: 40px;
  max-width: 400px;
}

.thinking-animation {
  margin-bottom: 32px;
}

.brain-container {
  position: relative;
  display: inline-block;
  width: 80px;
  height: 80px;
}

.brain-icon {
  width: 80px;
  height: 80px;
  color: #ff6d5a;
  z-index: 1;
  position: relative;
}

.pulse-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
  border: 2px solid #ff6d5a;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: pulse 3s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite;
}

.pulse-ring.delay-1 {
  animation-delay: 1s;
}

.pulse-ring.delay-2 {
  animation-delay: 2s;
}

@keyframes pulse {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(2.5);
    opacity: 0;
  }
}

.thinking-dots {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 24px;
}

.dot {
  width: 8px;
  height: 8px;
  background: #ff6d5a;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.dot:nth-child(1) {
  animation-delay: -0.32s;
}

.dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

.thinking-title {
  font-size: 24px;
  font-weight: 600;
  color: white;
  margin: 0 0 12px 0;
}

.thinking-message {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.9);
  margin: 0 0 32px 0;
}

.thinking-tips {
  padding: 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.tip {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  margin: 0;
  font-style: italic;
}
</style>