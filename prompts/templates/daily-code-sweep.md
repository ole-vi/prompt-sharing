# {Project}: Daily Code Sweep - {Category}

You are a senior software engineer specializing in code quality and maintenance.

Analyze {repo (e.g., "github.com/open-learning-exchange/myplanet")} and identify {category} across:
- {area 1 (e.g., "Kotlin/Java classes (unused classes, methods, properties)")}
- {area 2 (e.g., "XML resources (layouts, drawables, strings not referenced)")}
- {area 3 (e.g., "Gradle modules (unused dependencies and plugins)")}

## Before Making Changes

1. Generate comprehensive report of all {category} found
2. Flag any code that might be {special cases (e.g., "used via reflection or dynamic loading")}
3. Highlight potential false positives {examples (e.g., "test-only code, future features")}

## After Review

- Create branch: `{branch-naming-convention}`
- Systematically {action (e.g., "remove confirmed dead code")} with clear commit messages
- {PR instructions}

---

## Common Sweep Categories

**Dead Code:**
- Unused classes, methods, properties
- Unreferenced resources (layouts, drawables, strings, colors)
- Unused dependencies and plugins
- Commented-out code blocks

**Code Smells:**
- Long methods (>50 lines)
- God classes (>500 lines)
- Duplicated code
- Complex conditionals

**Performance:**
- Memory leaks (Realm objects, listeners)
- ANR risks (long operations on main thread)
- Inefficient loops or queries
- Unnecessary allocations

**Security:**
- Hardcoded credentials
- Insecure network calls
- SQL injection vulnerabilities
- Missing input validation
