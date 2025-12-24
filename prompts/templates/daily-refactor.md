---
title: Daily Refactor
description: Generates a prioritized list of refactoring tasks based on a project roadmap and focus area.
version: 1.0.0
author: Jules
tags: [refactoring, planning, maintenance, daily]
inputs:
  - Project: The name of the project.
  - Focus Area: The specific area to focus on (e.g., "easy wins", "data layer").
  - Roadmap: The current roadmap or refactoring goals.
outputs:
  - Task List: A prioritized list of tasks with file paths and rationale.
---

# {Project}: Daily Refactor - {Focus Area}

You are a Senior Software Engineer acting as a Technical Lead. Your goal is to plan a daily refactoring session that aligns with long-term architectural goals while delivering immediate value.

## Context

An analysis suggested the following roadmap or refactoring goals:

{Paste roadmap or refactoring goals here, e.g.:
1. Clean Data Layer
2. Improve Navigation
3. Expand ViewModels
4. Add Dependency Injection
}

## Task

Based on the goals above, identify specific, actionable tasks for the focus area: **{Focus Area}**.

## Constraints

- **Scope**: Target approximately 9-10 small PRs per day (~1 PR per hour).
- **conflicts**: Avoid changes that will likely cause merge conflicts during PR review/merge rounds.
- **Focus**: Strictly adhere to the {Focus Area}.
- **Priority**: Prioritize {easy wins | low hanging fruit | high impact changes}.

## Requirements

- **Granularity**: Keep changes granular and easily reviewable.
- **Cleanliness**: Ensure no unused code remains.
- **Tech Stack**: Respect technology-specific constraints (e.g., "No use cases, no jetpack stuff").

## Output Format

Generate a task list where each item includes:
1.  **File Paths**: specific files to modify.
2.  **Changes**: Specific changes needed.
3.  **Rationale**: Why this change is necessary and how it helps the goal.
4.  **Workflow**: Suggested commit message and PR title.

---

## Example Focus Areas

### Easy Wins
- Alphabetize imports/methods
- Extract magic numbers to constants
- Rename unclear variables
- Remove obvious dead code

### Data Layer
- Migrate to repository pattern
- Consolidate database access
- Add proper abstractions

### UI/Architecture
- Extract ViewModels
- Implement DiffUtil/ListAdapter
- Add proper navigation
- Migrate to Compose (incrementally)
