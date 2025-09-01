# n8n-ai Demo Video Script

**Duration**: 5-7 minutes  
**Target Audience**: n8n users, developers, automation enthusiasts

---

## Scene 1: Introduction (0:00-0:30)

**Visual**: n8n logo transitions to n8n-ai logo with tagline "AI-first Workflow Builder"

**Narration**:
"What if you could build complex n8n workflows just by describing what you want in plain English? Meet n8n-ai - an AI-powered extension that transforms n8n into an intelligent automation platform. Let me show you how it works."

**Screen**: Show the standard n8n interface with AI Panel button highlighted

---

## Scene 2: Simple Workflow Creation (0:30-1:30)

**Action**: Click on AI Panel, type a simple prompt

**Prompt**: "When someone fills out my contact form, save their info to Google Sheets and send them a thank you email"

**Narration**:
"Let's start with something simple. I'll describe a common automation need - handling contact form submissions."

**Visual**: 
- Show AI thinking animation
- Display the generated plan with bullet points
- Show the diff preview with nodes being added

**Action**: Click "Apply"

**Visual**: Workflow appears in n8n canvas with:
- Webhook node
- Google Sheets node  
- Send Email node
- All properly connected

**Narration**:
"In seconds, n8n-ai understood my request, identified the right nodes, and created a complete workflow. But it gets better..."

---

## Scene 3: Credentials Wizard (1:30-2:30)

**Action**: Click "Execute Workflow"

**Visual**: Secrets Wizard pops up showing required credentials

**Narration**:
"n8n-ai knows this workflow needs credentials. The Secrets Wizard guides you through setting them up."

**Action**: 
- Click "Configure" on Google Sheets
- Show the credential form
- Fill in mock credentials
- Show successful connection test

**Visual**: Green checkmarks appear as each credential is configured

**Narration**:
"It even tests the connections to make sure everything works before you run the workflow."

---

## Scene 4: Advanced Features - Workflow Map (2:30-3:30)

**Action**: Switch to Map tab

**Visual**: Interactive dependency graph showing multiple workflows

**Narration**:
"As your automation grows, n8n-ai helps you understand how workflows connect. The Workflow Map shows dependencies, live execution status, and even cost estimates."

**Action**: 
- Hover over a node to show cost tooltip
- Show execution flowing through the graph
- Click on a connection to see details

**Visual**: Cost breakdown appears showing API calls, execution time, and optimization tips

---

## Scene 5: AI-Powered Refactoring (3:30-4:30)

**Action**: Return to AI Panel with a complex workflow open

**Prompt**: "Optimize this workflow to reduce API calls"

**Narration**:
"n8n-ai can also improve existing workflows. Watch as it analyzes and suggests optimizations."

**Visual**:
- AI identifies redundant HTTP requests
- Shows plan to batch them
- Preview shows nodes being merged

**Action**: Apply the optimization

**Visual**: Workflow updates with fewer nodes but same functionality

**Narration**:
"It automatically applied the 'batch_http' optimization, reducing costs while maintaining the same results."

---

## Scene 6: Enterprise Features (4:30-5:30)

**Visual**: Show policy configuration screen

**Narration**:
"For teams, n8n-ai includes governance features like approval policies, audit logging, and Git integration."

**Action**:
- Show policy violation when trying to add restricted node
- Display audit log with user actions
- Show Git commit being created from workflow change

**Visual**: 
- Red alert for policy violation
- Detailed audit trail
- GitHub PR with workflow changes

---

## Scene 7: Performance & Scale (5:30-6:30)

**Visual**: Show metrics dashboard

**Narration**:
"Built for production, n8n-ai includes performance monitoring, intelligent caching, and can handle workflows with hundreds of nodes."

**Action**: Show large workflow being paginated and efficiently loaded

**Visual**: 
- Performance metrics
- Cache hit rates
- Real-time execution monitoring

---

## Scene 8: Call to Action (6:30-7:00)

**Visual**: Return to main interface, show various successful workflows running

**Narration**:
"n8n-ai brings the power of AI to workflow automation. From natural language workflow creation to intelligent optimization and enterprise governance - it's everything you need to build automation at scale."

**Text Overlay**:
- Open Source
- Get started at github.com/n8n-ai
- Join our community

**Final Visual**: Show logos of supported AI providers (OpenAI, Anthropic, OpenRouter)

---

## Key Features to Highlight:

1. **Natural Language to Workflow**: The magic of describing and getting a working workflow
2. **Intelligent Assistance**: Context-aware suggestions and node explanations  
3. **Visual Feedback**: Diff preview, workflow map, cost tooltips
4. **Enterprise Ready**: Policies, audit logs, Git integration
5. **Performance**: Caching, optimization, monitoring

## Technical Details to Mention:

- Works with existing n8n installation
- Supports multiple AI providers
- Open source and extensible
- Production-ready with monitoring and security

## Demo Tips:

- Keep the pace brisk but clear
- Use realistic examples that viewers can relate to
- Show both simple and complex use cases
- Emphasize time savings and ease of use
- Include some "wow" moments (like the map visualization)

## Post-Production Notes:

- Add smooth transitions between scenes
- Include keyboard shortcuts on screen
- Highlight cursor movements for clarity
- Add background music (upbeat, technical)
- Include captions for accessibility