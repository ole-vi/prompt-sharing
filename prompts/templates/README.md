# Prompt Templates

This folder contains reusable templates for creating daily, weekly, and project-specific prompts.

## Available Templates

### 1. Daily Issue Solver (`daily-issue-solver.md`)
**Purpose:** Generate prioritized task stubs from GitHub issues

**When to use:**
- Daily triage of open issues
- Identifying solvable bugs or features
- Prioritizing work based on impact/feasibility

**Key features:**
- GitHub API integration
- Scoring system (impact × feasibility)
- Automated PR workflow instructions

### 2. Daily Refactor (`daily-refactor.md`)
**Purpose:** Identify refactoring opportunities based on technical roadmap

**When to use:**
- Systematic code improvements
- Breaking down large refactoring efforts
- Finding "easy wins" for daily progress

**Key features:**
- Constraint-based (PR limits, merge conflicts)
- Focus on specific technical areas
- Granular, reviewable changes

### 3. Daily Code Sweep (`daily-code-sweep.md`)
**Purpose:** Systematic code quality analysis and cleanup

**When to use:**
- Dead code removal
- Performance optimization
- Security audits
- Code smell detection

**Key features:**
- Comprehensive reporting before changes
- False positive detection
- Systematic cleanup workflow

### 4. Weekly Maintenance (`weekly-maintenance.md`)
**Purpose:** Simple, focused maintenance tasks

**When to use:**
- Quick organizational improvements
- Low-risk cleanup tasks
- Routine maintenance work

**Key features:**
- Single-file or small-scope changes
- Clear step-by-step instructions
- Easy to review and merge

## How to Use Templates

1. **Copy the template** to your project's prompt folder (e.g., `prompts/planet/daily/`)
2. **Replace placeholders** with actual values:
   - `{Project}` → your project name
   - `{repo}` → GitHub repository path
   - `{owner}` → repository owner
   - `{Category}` → specific category/focus
3. **Customize constraints** to match your workflow
4. **Save with descriptive filename** (e.g., `daily-bug-triage.md`, `weekly-sort-imports.md`)

## Example: Creating a Bug Triage Prompt

Starting from `daily-issue-solver.md`:

```markdown
# Planet: Daily Issue Solver - Bug Triage

Create task stubs for issues in Planet:

1. Retrieve open issues from `open-learning-exchange/planet` labeled 'bug'
   - Use `gh` or GitHub REST/GraphQL API
   - Cache responses and handle rate limits
   - Exclude "wontfix", "invalid", "duplicate"

2. For each issue:
   - Verify no open PR already linked
   - Read body/comments and linked discussions
   - Score **impact** (1-100) and **feasibility** (1-100)
   - Output: `Issue #<number>: <title> – impact <score>, feasibility <score>`
   - One-line problem/solution summary
   - Implementation instructions ending with:
     a. Commit and push changes
     b. Open PR titled "<title> (fixes #<number>)" with "fixes #<number>" + summary
     c. Do not run automated tests until reviewers request them

3. Sort by highest impact × feasibility product (descending)
```

## Tips

- **Be specific:** The more specific your template customization, the better the AI results
- **Set constraints:** Daily PR limits, merge conflict avoidance, reviewability
- **Include context:** Reference roadmaps, technical decisions, or architectural goals
- **Define outputs:** Specify exact format for task stubs, commit messages, PR titles
- **Iterate:** Refine templates based on what works for your team

## Common Patterns

### PR Workflow Standard
```
a. Commit and push changes
b. Open PR titled "<title> (fixes #<number>)" with "fixes #<number>" + summary
c. [test instructions]
```

### Scoring Systems
- **Impact × Feasibility** (product, descending)
- **Solvability** (single score, 1-100, descending)
- **Complexity × Urgency** (for prioritization)

### Constraints
- Daily PR limit (~9-10 PRs)
- Avoid merge conflicts
- Keep changes granular and reviewable
- No unused code additions
- Technology-specific constraints (e.g., "No Jetpack Compose yet")
