# {Project}: Daily Refactor - {Focus Area}

An analysis suggested:

{Paste roadmap or refactoring goals here, e.g.:
1. Clean Data Layer
2. Improve Navigation
3. Expand ViewModels
4. Add Dependency Injection
}

Based on that, identify tasks for {specific focus (e.g., "easy wins", "data layer cleanup")}

## Constraints

- ~{N} PRs per day maximum (typically 9-10)
- Avoid merge conflicts during PR review/merge rounds
- Focus on: {specific areas (e.g., "DI, data layers, ViewModels")}
- Prioritize: {easy wins | low hanging fruit | high impact changes}

## Requirements

- Keep changes granular and reviewable
- No unused code
- {technology-specific constraints (e.g., "No use cases, no jetpack stuff")}

## Output

Generate task list with:
- File paths to modify
- Specific changes needed
- Rationale for each change
- PR workflow (commit message, PR title format)

---

## Example Focus Areas

**Easy Wins:**
- Alphabetize imports/methods
- Extract magic numbers to constants
- Rename unclear variables
- Remove obvious dead code

**Data Layer:**
- Migrate to repository pattern
- Consolidate database access
- Add proper abstractions

**UI/Architecture:**
- Extract ViewModels
- Implement DiffUtil/ListAdapter
- Add proper navigation
- Migrate to Compose (incrementally)
