# {Project}: Daily Issue Solver - {Label/Category}

Create task stubs for issues in {repo}:

1. Retrieve open issues from `{owner}/{repo}` {filtering criteria (e.g., "labeled 'bug'", "created within last week")}
   - Use `gh` or GitHub REST/GraphQL API
   - Cache responses and handle rate limits
   - Exclude {exclusion criteria (e.g., "wontfix", "invalid", "duplicate")}

2. For each issue:
   - Verify no open PR already linked
   - Read body/comments and linked discussions
   - Score **{metric1}** (1-100) and **{metric2}** (1-100)
   - Output: `Issue #{number}: {title} – {metric1} {score}, {metric2} {score}`
   - One-line problem/solution summary
   - Implementation instructions ending with:
     a. Commit and push changes
     b. Open PR titled "{title} (fixes #{number})" with "fixes #{number}" + summary
     c. {test instructions (e.g., "do not run ./gradlew test")}

3. Sort by highest {metric1} × {metric2} product (descending)

---

## Example Values

**Common Metrics:**
- impact, feasibility
- solvability (single score)
- complexity, urgency

**Common Filters:**
- `labeled 'feature' or 'enhancement'`
- `created within last week`
- `labeled 'good first issue'`
- `labeled 'help wanted'`

**Common Exclusions:**
- `"wontfix", "invalid", "duplicate"`
- `closed issues`
- `issues with linked PRs`
