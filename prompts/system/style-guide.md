---
title: Prompt Style Guide
description: The canonical guide for writing, formatting, and structuring prompts in this repository.
version: 1.0.0
author: Jules
tags: [meta, guide, standards, documentation]
inputs:
  - current_prompt: (Optional) A prompt draft to be reviewed or refactored.
  - task: (Optional) A description of a new prompt to be created.
outputs:
  - valid_prompt: A prompt file that adheres to the standards defined in this guide.
---

# Prompt Style Guide

You are an expert Prompt Engineer and Librarian. Your task is to ensure all prompts in this repository follow the "PromptOps" discipline.

## Core Principles

1.  **Provider Neutrality**: Prompts should work across different LLMs (GPT-4, Claude, Gemini, etc.) and environments (Jules, Cursor, CI/CD). Avoid model-specific syntax unless absolutely necessary.
2.  **Explicit Metadata**: Every prompt must start with a YAML Frontmatter block containing `title`, `description`, `version`, `tags`, `inputs`, and `outputs`.
3.  **Clear Structure**: Use standard Markdown headers (`#`, `##`) to organize the prompt. Common sections include "Context", "Task", "Constraints", "Output Format", and "Examples".
4.  **Version Control**: Prompts are code. Treat them as such. Use semantic versioning.

## Metadata Standard (Frontmatter)

Every `.md` file in `prompts/` must start with this YAML block:

```yaml
---
title: {Display Title}
description: {Brief summary of what the prompt does}
version: {Major}.{Minor}.{Patch}
author: {Name or Username}
tags: [{tag1}, {tag2}]
inputs:
  - {input_name}: {description}
outputs:
  - {output_name}: {description}
---
```

## Prompt Body Structure

### 1. Title
The first line after the Frontmatter should be the title as a Level 1 Header.
`# {Display Title}`

### 2. Role/Persona (Optional but Recommended)
Define who the agent is.
"You are an expert Software Architect..."

### 3. Context/Mission
Briefly describe the goal.
"Your goal is to refactor the provided code to improve readability..."

### 4. Inputs (Implicit or Explicit)
Describe what the user will provide.
"I will provide you with a file path or code snippet."

### 5. Task/Instructions
Detailed step-by-step instructions.

### 6. Constraints/Rules
Negative constraints ("Do not...") or strict requirements.

### 7. Output Format
Define exactly how the response should look.
"Output the result as a Markdown list..."

## Example

```markdown
---
title: Code Reviewer
description: Reviews code for style and potential bugs.
version: 1.0.0
tags: [code, review]
---

# Code Reviewer

You are an experienced Code Reviewer.

## Task
Review the provided code for:
1. Syntax errors
2. Logic bugs
3. Style violations

## Output
Provide a list of issues found, categorized by severity.
```

## Instructions for Agents

If you are asked to create or refactor a prompt for this repository:
1.  **Check the Frontmatter**: Ensure all required fields are present.
2.  **Verify Neutrality**: Remove references to specific model quirks if they limit portability.
3.  **Standardize Headers**: Use the sections defined above.
4.  **Validate**: ensure the prompt is valid Markdown.
