# Prompt Engineering Guide

## Overview

n8n-ai uses advanced prompt engineering techniques to generate high-quality workflows. The system automatically selects and optimizes prompts based on request complexity and context.

## Key Features

### 1. Automatic Complexity Analysis
The system analyzes each request to determine complexity:
- **Simple**: Basic operations (GET request, send email)
- **Medium**: Multi-step processes with transformations
- **Complex**: Advanced workflows with conditions, loops, error handling

### 2. Chain-of-Thought Reasoning
For complex requests, the AI uses step-by-step reasoning:
```
Step 1: Understanding the requirement
- What data source?
- What transformations?
- What output format?

Step 2: Identifying necessary nodes
- HTTP Request for API calls
- Set node for transformations
- IF node for conditions

Step 3: Planning connections
- Trigger → Fetch → Transform → Output
```

### 3. Dynamic Template Selection
The system selects optimal templates based on:
- Request complexity
- User experience level
- Task type (create, modify, fix, optimize)
- Error context

## Prompt Templates

### System Prompts

#### Default
Standard instructions for general workflow creation.

#### Chain of Thought
Encourages step-by-step reasoning for complex tasks.

#### Expert
Advanced mode with focus on patterns, optimization, and best practices.

### Planner Templates

#### Default
```
Given the user request: "{prompt}"
Generate a plan to fulfill this request...
```

#### Chain of Thought
```
Let me analyze this workflow request step by step.
Step 1: Understanding the requirement...
Step 2: Identifying necessary nodes...
```

#### Guided
Interactive approach with clarifying questions.

## Optimization Techniques

### 1. Few-Shot Learning
The system includes relevant examples:
```json
Example 1:
Input: "Fetch user data from API"
Output: {
  "op": "add_node",
  "node": {
    "type": "n8n-nodes-base.httpRequest",
    "parameters": {
      "method": "GET",
      "url": "https://api.example.com/users"
    }
  }
}
```

### 2. Constraint Specification
Clear constraints improve accuracy:
- Use only available node types
- Follow n8n connection rules
- Include error handling
- Optimize for performance

### 3. Output Formatting
Explicit format instructions ensure valid JSON:
```
Return a valid OperationBatch JSON object:
{
  "version": "v1",
  "ops": [...]
}
```

## Usage Examples

### Simple Request
```
Request: "Create HTTP GET request"
Complexity: Simple
Template: Default
Temperature: 0.3
```

### Complex Request
```
Request: "Build ETL pipeline with error handling and notifications"
Complexity: Complex
Template: Chain of Thought
Temperature: 0.5
Additional: Examples, constraints, performance hints
```

## Best Practices

### 1. Request Clarity
Help the AI understand your needs:
- ❌ "Make API workflow"
- ✅ "Create workflow to fetch GitHub stars daily and save to Google Sheets"

### 2. Include Context
Provide relevant information:
- Data sources and formats
- Authentication requirements
- Error handling needs
- Performance constraints

### 3. Specify Triggers
Be explicit about workflow triggers:
- "Run every morning at 9 AM"
- "Trigger when webhook receives data"
- "Start manually on demand"

## Advanced Features

### 1. Multi-Step Planning
Complex workflows are decomposed into logical steps:
1. Trigger selection
2. Data fetching
3. Transformation
4. Validation
5. Output/storage
6. Error handling

### 2. Context-Aware Examples
Examples are selected based on requested nodes:
- HTTP examples for API workflows
- Database examples for data workflows
- Schedule examples for recurring tasks

### 3. Performance Optimization
Hints based on data size:
- Small: Direct processing
- Medium: Batching recommended
- Large: Streaming and pagination

## Configuration

### Environment Variables
```bash
# Control prompt behavior
AI_USE_CHAIN_OF_THOUGHT=true
AI_ADD_EXAMPLES=true
AI_OPTIMIZE_PROMPTS=true
```

### Per-Request Options
```javascript
{
  "prompt": "Create workflow",
  "options": {
    "complexity": "complex",
    "useChainOfThought": true,
    "addExamples": true
  }
}
```

## Troubleshooting

### Poor Results
1. Make prompts more specific
2. Provide examples
3. Use guided mode for complex tasks
4. Check selected template in logs

### Validation Errors
1. AI output may need refinement
2. Check node parameter requirements
3. Use critic mode for auto-fix

### Performance Issues
1. Simplify complex prompts
2. Break into smaller sub-tasks
3. Use caching for repeated patterns

## Future Enhancements

1. **Learning from Feedback**: Improve based on user corrections
2. **Custom Templates**: User-defined prompt templates
3. **Multi-Language**: Prompt optimization for non-English
4. **Visual Input**: Generate from diagrams/sketches