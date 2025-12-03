# PromptSync Repository Explorer

You are helping someone understand the PromptSync (prompt-sharing) codebase.

**Repository:** https://github.com/ole-vi/prompt-sharing

## Your Task

Analyze the PromptSync repository and provide detailed answers to help understand the project structure, technology stack, and development practices.

## Questions to Answer

### 1. Project Overview
- What is the main purpose of PromptSync?
- What type of application is it?
- Who is the target audience?
- What problem does it solve for teams?

### 2. Technology Stack
- What is the primary programming language?
- What frameworks or libraries are being used?
- What are the major dependencies? (Check package.json if present)
- How is authentication handled? (Firebase, OAuth, etc.)
- What backend services are integrated?
- Is there a build system or is it zero-build?

### 3. Architecture & Structure
- What is the folder structure? Describe the purpose of major directories
- How is the code organized? (modular, component-based, etc.)
- Where is the main entry point?
- How are routes/navigation handled?
- How does the GitHub API integration work?
- How is the Jules API integration implemented?

### 4. Development Workflow
- What are the available scripts? (build, test, dev, etc.)
- How do you run the application locally?
- Are there any environment variables or configuration files needed?
- What testing framework is used (if any)?
- How is the app deployed? (GitHub Pages, other?)
- What linting/formatting setup exists?

### 5. Key Features & Modules
- What are the main features of the application?
- How does the prompt browsing/tree navigation work?
- How does the markdown rendering work?
- How is authentication and user state managed?
- How does the Jules integration encrypt/store API keys?
- How does branch switching work?
- How are prompts loaded and cached?

### 6. GitHub Integration
- How does the app fetch prompts from GitHub?
- What GitHub API endpoints are used?
- How is rate limiting handled?
- Can users browse different repositories?
- How does the app handle private vs public repos?

### 7. Contributing Guidelines
- Is there a CONTRIBUTING.md file? What does it say?
- What is the branch naming convention?
- What is the commit message format?
- How should new features be structured?
- What should a new contributor know before starting?
- How do you add new prompts to the library?

### 8. Code Quality & Patterns
- What coding patterns are used? (ES6 modules, async/await, etc.)
- How are circular dependencies avoided?
- How is state management handled across modules?
- Are there any notable design patterns?
- How is error handling implemented?

### 9. Common Gotchas & Important Notes
- Are there any known issues or limitations?
- What are common setup problems?
- Why must the app be served over HTTP (not file://)?
- What Firebase configuration is needed?
- Are there any CORS or API limitation issues?
- What browser compatibility considerations exist?

### 10. Resources for Learning
- Where is the documentation?
- Are there any architecture diagrams or design docs?
- What are the key files a new contributor should read first?
- Who are the key maintainers to reach out to?
- How does this project relate to Planet and myPlanet?

## Output Format

Provide clear, detailed answers with:
- Code examples where relevant
- File paths and line numbers when referencing specific code
- Links to specific files in the repository
- Explanations of the zero-build, modular architecture
- Explanations suitable for someone new to the codebase

Focus on practical information that helps someone start contributing quickly and understand how the prompt-sharing system works.
