# Gemini CLI Verification Prompt

You are in a Linux dev container. Do not run any Gradle or project builds.

**Goal:** Verify that the Gemini CLI installed by the startup script works with the API key from the environment.

## Checklist
- [ ] Confirm Gemini CLI is installed: `gemini --version`
- [ ] Run a minimal prompt: `gemini -p "Say hello from Gemini CLI"`
- [ ] Run a second prompt: `gemini -p "Write me a haiku about debugging"`
- [ ] Run a realistic code-context prompt on a myPlanet file:  
  `cat README.md | gemini -p "Summarize the purpose of this project"`

## Deliverable
- Print the version string.
- Print Gemini’s replies exactly as returned (for all three prompts).
- If a step fails, show the exit code and stderr.

## Test Prompts
```bash
gemini --version
gemini -p "Say hello from Gemini CLI"
gemini -p "Write me a haiku about debugging"
cat README.md | gemini -p "Summarize the purpose of this project"
