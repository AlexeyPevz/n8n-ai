# n8n-ai-panel

Vue UI components for n8n-ai.

## Overview

This package provides Vue 3 components that integrate with n8n's UI to add AI-powered features:
- AI-first workflow builder interface
- Node explanation tooltips
- Workflow dependency visualization
- Credential setup wizard

## Components

### AIFirstTool
Main AI interface with chat-like interaction:
```vue
<AIFirstTool 
  :workflow-id="currentWorkflowId"
  @workflow-updated="handleUpdate"
/>
```

Features:
- Natural language input
- Quick action buttons
- Real-time updates
- Diff preview

### ExplainNode
Contextual help for nodes:
```vue
<ExplainNode 
  :node="selectedNode"
  @select-node="handleNodeSelect"
/>
```

Features:
- AI-generated explanations
- Configuration details
- Common issues & solutions
- Related nodes

### WorkflowMap
Visual dependency graph:
```vue
<WorkflowMap 
  :workflows="workflowList"
  @select-workflow="handleSelect"
/>
```

Features:
- Interactive graph
- Real-time status
- Cost tracking
- WebSocket updates

### SecretsWizard
Credential configuration helper:
```vue
<SecretsWizard 
  :required-credentials="credentials"
  @save="handleSave"
/>
```

Features:
- Step-by-step setup
- Validation
- Testing
- Multi-credential support

## Development

### Setup
```bash
# Install dependencies
pnpm install

# Development server
pnpm dev

# Build for production
pnpm build
```

### Testing
```bash
# Unit tests
pnpm test

# E2E tests
pnpm e2e:ui
```

### Styling
Components use n8n's design system with custom styles in SCSS:
```scss
<style lang="scss" scoped>
.ai-panel {
  // Uses n8n variables
  background: var(--color-background-light);
  border: 1px solid var(--color-foreground-base);
}
</style>
```

## Integration

### With n8n
Components are designed to work within n8n's Vue app:

```typescript
// In n8n plugin
import { AIFirstTool } from '@n8n-ai/panel';

app.component('AIFirstTool', AIFirstTool);
```

### Standalone
Can also be used standalone:

```typescript
import { createApp } from 'vue';
import { AIPanel } from '@n8n-ai/panel';

const app = createApp(App);
app.use(AIPanel);
```

## Configuration

### Props
All components accept configuration via props:

```typescript
interface AIFirstToolProps {
  workflowId: string;
  apiUrl?: string;
  enableWebSocket?: boolean;
  theme?: 'light' | 'dark';
}
```

### Events
Components emit events for integration:

```typescript
// Workflow updated
emit('workflow-updated', { 
  workflowId: string, 
  operations: OperationBatch 
});

// Error occurred
emit('error', { 
  message: string, 
  code: string 
});
```

## Composables

### useAIWorkflow
Main composable for AI workflow management:

```typescript
const { 
  generateWorkflow, 
  applyOperations, 
  undo, 
  state 
} = useAIWorkflow();
```

### useAIApi
API client composable:

```typescript
const { 
  planWorkflow, 
  applyBatch, 
  validateWorkflow 
} = useAIApi({ 
  baseUrl: 'http://localhost:3000' 
});
```

## Build Configuration

Uses Vite for fast builds:

```javascript
// vite.config.ts
export default {
  build: {
    lib: {
      entry: './src/index.ts',
      formats: ['es', 'umd']
    }
  }
}
```

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions

## License

MIT