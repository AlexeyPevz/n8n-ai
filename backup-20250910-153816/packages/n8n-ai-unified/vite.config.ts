import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/ui/AIFirstTool.vue'),
      name: 'N8nAIPanel',
      formats: ['umd', 'es'],
      fileName: (format) => `n8n-ai-panel.${format}.js`,
    },
    rollupOptions: {
      external: ['vue', 'n8n-workflow', 'n8n-core'],
      output: {
        globals: {
          vue: 'Vue',
        },
        // Включаем CSS в билд
        assetFileNames: 'n8n-ai-panel.[ext]',
      },
    },
  },
  
  resolve: {
    alias: {
      '@n8n-ai/schemas': path.resolve(__dirname, '../n8n-ai-schemas/src'),
      '@n8n-ai/hooks': path.resolve(__dirname, '../n8n-ai-hooks/src'),
    },
  },
});