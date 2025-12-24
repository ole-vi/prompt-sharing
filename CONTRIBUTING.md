# Contributing to Prompt-Sharing

Welcome to the `prompt-sharing` repository! This project is the canonical source of truth for reusable, provider-neutral prompts. We treat prompts as code ("PromptOps"), meaning they are versioned, reviewed, and standardized.

## Vision

Our goal is to decouple high-quality instruction sets from any single model provider, IDE, or execution environment. Whether you are using Jules, Cursor, a CI agent, or a local script, the prompts here should work reliably.

## How to Contribute

We welcome contributions! Whether you are adding a new prompt, improving an existing one, or fixing a bug, please follow these guidelines.

### 1. Adding a New Prompt

1.  **Check for Duplicates**: Look through existing folders to see if a similar prompt already exists.
2.  **Follow the Style Guide**: All prompts must adhere to the [Prompt Style Guide](prompts/system/style-guide.md).
    *   Include the required YAML Frontmatter (Title, Description, Version, Tags, etc.).
    *   Use standard Markdown headers.
    *   Keep the prompt provider-neutral (avoid model-specific quirks unless necessary).
3.  **Choose the Right Location**:
    *   `prompts/templates/`: Generic, reusable templates (e.g., refactoring, code review).
    *   `prompts/system/`: Meta-prompts and standards for the repository itself.
    *   Create a new directory if your prompts form a cohesive group (e.g., specific to a language or framework), but try to keep them as generic as possible.
4.  **Submit a Pull Request**:
    *   Use a descriptive branch name (e.g., `feature/add-react-component-generator`).
    *   Explain the purpose of the prompt in the PR description.

### 2. Improving Existing Prompts

*   **Refactoring**: If you see a prompt that doesn't follow the standards or could be clearer, feel free to improve it.
*   **Versioning**: Increment the version number in the Frontmatter (e.g., `1.0.0` -> `1.1.0`) if you make substantive changes.

### 3. Review Process

All changes are reviewed to ensuring they meet the "PromptOps" standards:
*   **Clarity**: Is the prompt easy to understand for both humans and agents?
*   **Portability**: Does it rely on specific tool features that might not exist elsewhere?
*   **Structure**: Does it have valid metadata and sections?

## Prompt Style Guide

Please read the full [Style Guide](prompts/system/style-guide.md) before contributing.

**Quick Checklist:**
- [ ] YAML Frontmatter included?
- [ ] Provider-neutral language?
- [ ] Clear Inputs and Outputs defined?
- [ ] Checked for typos and formatting issues?

Thank you for helping us build the best prompt library!
