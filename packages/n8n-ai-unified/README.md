# n8n-ai-unified

Unified n8n application with integrated AI features.

## Overview

This package combines all n8n-ai components into a single, deployable n8n instance with built-in AI capabilities. No separate services required!

## Features

- Embedded orchestrator
- Integrated UI components
- Single port operation
- Native n8n plugin architecture
- Zero additional configuration

## Quick Start

```bash
# Build
pnpm build

# Run unified n8n
pnpm start

# Or use Docker
docker build -f Dockerfile.unified -t n8n-ai .
docker run -p 5678:5678 n8n-ai
```

## Architecture

```
┌─────────────────────────────────┐
│         n8n Instance            │
├─────────────────────────────────┤
│    n8n-ai Plugin                │
│  ┌──────────────────────────┐  │
│  │  Embedded Orchestrator   │  │
│  ├──────────────────────────┤  │
│  │  AI Routes (/api/v1/ai)  │  │
│  ├──────────────────────────┤  │
│  │  UI Components (Vue)     │  │
│  └──────────────────────────┘  │
└─────────────────────────────────┘
```

## Components

### n8n Plugin
Main integration point:
```typescript
export class N8nAIPlugin {
  init(app: express.Application) {
    // Start embedded orchestrator
    this.orchestrator = await startOrchestrator();
    
    // Add AI routes
    app.use('/api/v1/ai', aiRoutes);
    
    // Inject UI components
    this.setupUIInjection(app);
  }
}
```

### Embedded Orchestrator
Runs in-process with n8n:
```typescript
const orchestrator = await startOrchestrator({
  port: 0, // Random port
  embedded: true
});
```

### UI Integration
Vue components injected into n8n:
- AI-first tool button
- Sliding panel interface
- Diff preview modals
- Secrets wizard

## Configuration

### Environment Variables
Same as standalone, but prefixed:
```bash
# AI Configuration
N8N_AI_PROVIDER=openrouter
N8N_AI_API_KEY=your-key

# Optional overrides
N8N_AI_ENABLED=true
N8N_AI_ORCHESTRATOR_PORT=0
```

### Plugin Options
```typescript
{
  // Enable/disable AI features
  enabled: true,
  
  // UI configuration
  ui: {
    position: 'bottom',
    theme: 'auto'
  },
  
  // Orchestrator settings
  orchestrator: {
    embedded: true,
    port: 0
  }
}
```

## Building

### Development
```bash
# Watch mode
pnpm dev

# Build plugin
pnpm build:plugin

# Build UI
pnpm build:ui
```

### Production Build
```bash
# Full build
pnpm build

# Optimized build
NODE_ENV=production pnpm build
```

## Deployment

### Docker
```dockerfile
FROM n8nio/n8n:latest
COPY --from=builder /app/packages/n8n-ai-unified/dist /usr/local/lib/node_modules/n8n/dist/ai
ENV N8N_AI_ENABLED=true
```

### Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: n8n-ai
spec:
  template:
    spec:
      containers:
      - name: n8n
        image: n8n-ai:latest
        env:
        - name: N8N_AI_ENABLED
          value: "true"
        - name: N8N_AI_API_KEY
          valueFrom:
            secretKeyRef:
              name: ai-secrets
              key: api-key
```

## UI Components

### AIFirstTool
Main AI interface, accessible via button in n8n UI:
- Natural language workflow creation
- Real-time diff preview
- Undo/redo support

### Integration Points
- Workflow editor toolbar
- Node context menu
- Settings panel
- Help menu

## Troubleshooting

### AI features not showing
1. Check `N8N_AI_ENABLED=true`
2. Verify plugin loaded in logs
3. Clear browser cache

### Orchestrator errors
1. Check embedded server started
2. Verify no port conflicts
3. Check API key is set

### UI not updating
1. Rebuild UI bundle
2. Clear n8n static cache
3. Check console for errors

## Development Tips

### Hot Reload
```bash
# Terminal 1: n8n
pnpm dev

# Terminal 2: UI
cd packages/n8n-ai-panel
pnpm dev
```

### Debugging
```bash
# Enable debug logs
DEBUG=n8n-ai:* pnpm start

# Chrome DevTools
node --inspect pnpm start
```

## License

MIT