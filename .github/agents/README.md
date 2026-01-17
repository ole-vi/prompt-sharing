# GitHub Copilot Custom Agents for PromptRoot

This directory contains specialized GitHub Copilot agents tailored to PromptRoot's unique architecture and development patterns.

## Available Agents

### 1. `@vanilla-js-specialist`
**Focus**: Zero-build vanilla JavaScript development

Expert in ES6 modules, no framework patterns, and strict adherence to the zero-build philosophy. Enforces:
- Named exports only (no default exports)
- DOM APIs instead of HTML strings
- Async/await patterns
- Proper module organization

**Use when**: Working on frontend JavaScript modules, implementing new features, or refactoring existing code.

### 2. `@firebase-specialist`
**Focus**: Firebase integration and backend services

Expert in Firebase Authentication, Firestore, and Cloud Functions. Covers:
- Environment detection and emulator setup
- Firestore collections and security rules
- Authentication flows
- Cloud Functions deployment

**Use when**: Working on authentication, database operations, or Cloud Functions.

### 3. `@css-bem-specialist`
**Focus**: BEM CSS methodology and modular stylesheets

Expert in Block Element Modifier naming conventions and CSS architecture. Covers:
- BEM naming patterns
- CSS variable usage
- Component and page-specific styles
- Responsive design patterns

**Use when**: Creating new components, updating styles, or refactoring CSS.

### 4. `@jules-integration-specialist`
**Focus**: Jules AI assistant integration

Expert in all Jules-related features including API client, queue system, and session management. Covers:
- Jules modal and UI components
- Queue system and Firestore integration
- Subtask splitting and parsing
- API key encryption and security

**Use when**: Working on Jules features, queue management, or API integrations.

### 5. `@browser-extension-specialist`
**Focus**: Chrome browser extension development

Expert in the web capture Chrome extension. Covers:
- Manifest V3 configuration
- Content extraction and Markdown conversion
- GitHub OAuth flow
- Sync functionality

**Use when**: Modifying the browser extension, updating OAuth flows, or improving content capture.

## How to Use These Agents

### In GitHub Copilot Chat
Simply mention the agent by name in your prompt:
```
@vanilla-js-specialist How should I structure a new module for handling notifications?
```

### In Coding Agent
When creating issues or PRs, these agents will be automatically available and can be invoked by GitHub Copilot to provide specialized guidance.

### Best Practices
- **Choose the right agent**: Use the specialist most relevant to your task
- **Be specific**: Provide context about what you're trying to accomplish
- **Follow patterns**: Agents enforce existing patterns - trust their guidance
- **Ask questions**: Agents can explain why certain patterns are required

## Agent Configuration

All agents are configured with:
- **name**: Identifier for invoking the agent
- **description**: Brief summary of the agent's expertise
- **instructions**: Detailed guidance, patterns, and examples

## Development

When modifying agents:
1. Edit the relevant `.md` file in this directory
2. Test by invoking the agent in Copilot Chat
3. Ensure instructions align with actual codebase patterns
4. Update this README if adding new agents

## Related Documentation

- [`.github/copilot-instructions.md`](../copilot-instructions.md) - Repository-wide Copilot instructions
- [GitHub Docs: Custom Agents](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-custom-agents)
- [Writing Great agents.md Files](https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/)
