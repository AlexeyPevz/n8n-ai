# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2025-09-02

### 🎉 Initial Production Release

#### Added
- **Core Packages**
  - `n8n-ai-schemas`: Zod-based validation schemas for all operations
  - `n8n-ai-hooks`: n8n integration layer with Express routes
  - `n8n-ai-orchestrator`: Main API server with AI logic
  - `n8n-ai-panel`: Vue 3 UI components
  - `n8n-ai-unified`: Single integrated n8n application

- **AI Features**
  - Natural language to workflow generation
  - Schema-Guided Reasoning (SGR) for validated outputs
  - Pattern matching system for common workflows
  - RAG system for contextual assistance

- **API Endpoints**
  - Health check and status monitoring
  - Workflow planning from prompts
  - Batch operations with undo/redo
  - Node introspection and search
  - Workflow validation and simulation
  - Live workflow map with WebSocket

- **Security**
  - Token-based authentication
  - Rate limiting per endpoint
  - CORS configuration
  - CSP headers
  - Input validation
  - Command injection protection (exec → execFile)

- **Monitoring**
  - Prometheus metrics export
  - Custom metrics API
  - Request tracing
  - Performance monitoring

- **Developer Experience**
  - TypeScript strict mode
  - Comprehensive test suite
  - E2E testing framework
  - Docker support
  - Makefile automation

#### Changed
- Migrated from prototype to production-ready architecture
- Replaced all exec() calls with execFile() for security
- Implemented real n8n type integration (removed stubs)

#### Fixed
- TypeScript compilation errors across all packages
- Module resolution for ESM
- Security vulnerabilities in command execution
- Test compatibility with latest dependencies

#### Security
- Fixed command injection vulnerability in git integration
- Added input validation for workflow IDs
- Implemented path traversal protection

### Development History

#### Sprint 4 (August 2024)
- Unified application integration
- UI components implementation
- Production deployment preparation

#### Sprint 3 (July 2024)
- RAG system implementation
- Pattern matching engine
- WebSocket support

#### Sprint 2 (June 2024)
- Core API implementation
- Schema validation
- Basic UI prototype

#### Sprint 1 (May 2024)
- Project setup
- Architecture design
- n8n fork preparation

#### Sprint 0 (April 2024)
- Concept validation
- Technology selection
- Initial prototypes