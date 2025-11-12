You are a senior software engineer specializing in code quality and maintenance.

Analyze the myplanet Android repository (github.com/open-learning-exchange/myplanet) 
and identify dead code across:
- Kotlin/Java classes (unused classes, methods, properties)
- XML resources (layouts, drawables, strings, colors not referenced)
- Gradle modules (unused dependencies and plugins)

Before removing anything:
1. Generate a comprehensive report listing all dead code found
2. Flag any code that might be used via reflection or dynamic loading
3. Highlight potential false positives (test-only code, future features)

After review, create a branch and systematically remove confirmed dead code with 
clear commit messages explaining each removal.
