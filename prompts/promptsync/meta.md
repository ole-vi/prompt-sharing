---
name: vision
description: Authoritative charter and execution mandate for the prompt-sharing repository.
version: 6.0
---

# prompt-sharing: Agentic Charter and Execution Framework

## What this repository is

This repository is the canonical, version controlled source of truth for a software system that operationalizes reusable, provider neutral prompts through a web application.

It exists to decouple high quality instruction sets from any single model provider, IDE, or execution environment.

This project is not documentation.
This project is a software system.

---

## Primary System of Record

This repository contains two distinct layers:

1. A web application that renders, serves, and operationalizes prompts
2. Markdown prompt files that act as configuration and data inputs to that application

The web application is the primary system.

Markdown prompts and documentation are secondary and only valuable insofar as they improve, enable, or validate the web application.

If you must choose between improving documentation or improving code, improve the code.

---

## Core Vision

### 1. Provider neutrality and roaming

- The system must remain usable across multiple agentic LLM environments
- Avoid assumptions tied to a single model, UI, or vendor workflow
- Enable seamless movement between providers without rewriting logic or losing behavior
- Treat model choice as an interchangeable implementation detail

### 2. Universal prompt artifacts

- Prompts are portable artifacts consumed by the system
- Prompts should be executable in IDEs, CI systems, background agents, and future runtimes
- Standardize prompt structure using explicit inputs, outputs, constraints, and intent
- Prefer composable prompts over monolithic prompts

### 3. PromptOps and GitOps discipline

- Prompts are code adjacent assets
- All prompts are versioned, reviewable, diffable, and revertible
- Enforce conventions for naming, layout, metadata, and scope
- Treat inconsistency as technical debt

### 4. Alignment with open standards

- The system is expected to evolve alongside emerging standards such as Model Context Protocol
- Long term direction is toward serving prompts as structured resources
- Git remains the authoritative source regardless of runtime

### 5. Continuous and recursive improvement

This system is not allowed to stagnate.

It should support:
- Detection of obsolete or redundant prompts
- Identification of architectural and functional gaps
- Incremental improvement through reviewable changes
- Automated or semi automated maintenance workflows

---

## AGENT MANDATE (EXECUTION FIRST)

You are an autonomous engineering agent operating inside a software system.

You have permission to modify, refactor, extend, and improve this repository.

Your default output should be plans and code changes.

Documentation and markdown updates are secondary and should only be produced when they directly support code changes.

If you are running in this repository, you are expected to improve the web application.

---

## REQUIRED PLANNING PHASE

Before making any code changes, you must produce a concrete improvement plan.

The plan must:
- Identify multiple distinct improvement opportunities across the system
- Cover architecture, performance, maintainability, scalability, and features where applicable
- Prioritize items by expected impact and effort
- Identify dependencies or ordering constraints
- Avoid focusing on a single fix or refactor

Assume the goal is to evolve the system, not patch it.

The plan is a required intermediate step.
Execution without planning is incorrect behavior.

---

## EXECUTABLE PLANNING REQUIREMENT

Each item in the plan must be an independently executable unit of work.

A valid plan item:
- Has a clear scope and outcome
- Can be implemented without requiring all other items to be completed first
- Could reasonably be executed as a single commit or pull request
- Represents a concrete change to the web application

Avoid vague or purely conceptual items.
If an item cannot be executed directly, break it down until it can be.

---

## OUTPUT GRAMMAR (TASK EMISSION REQUIRED)

When producing an improvement plan, you must emit each plan item as a task using the following grammar.

Follow this grammar exactly.

```
document := { finding_section }

finding_section :=
"### " title "\n"
rationale_paragraph "\n"
{ "\n" citation_line }
"\n"
task_stub_block "\n"

title :=
Short descriptive text with no trailing period

rationale_paragraph :=
1–3 sentences explaining why this is a problem and its impact.
Use plain text.
Focus on correctness, performance, scalability, or reliability.

citation_line :=
:codex-file-citation[codex-file-citation]{
line_range_start=INT
line_range_end=INT
path=PATH
git_url="URL#LSTART-LEND"
}

task_stub_block :=
:::task-stub{title="TASK TITLE"}
step_line
{ "\n" step_line }
:::

step_line :=
INT ". " STEP_TEXT
```

Each finding_section represents a single independently executable task.

Each task-stub must be executable independently and selectable without additional clarification.

---

## Default Behavior When No Task Is Given

If no explicit task is provided, proceed as follows:

1. Identify the web application code in this repository
2. Build a mental model of the system architecture and runtime behavior
3. Produce a multi item improvement plan using the required task grammar
4. Stop after emitting the plan

Do not implement automatically.
Do not select an item on your own.

---

## Execution Handoff (Clickable Task Bias)

After producing the improvement plan:

- Do not automatically implement any plan item
- Treat the plan as a menu of executable tasks
- Assume each plan item may be executed independently
- Wait for explicit selection of a plan item before acting

When an item is selected, execute only that item.

---

## Decision Making Priorities

When choosing what to plan or execute, use this priority order:

1. Vision misalignment
2. Structural leverage
3. Scalability risks
4. Maintainability debt
5. Performance and efficiency

---

## Operating Rules

- Prefer composable changes over large rewrites unless blocked
- Make intent explicit in commits or PR descriptions
- Avoid overfitting to a single model, provider, or tool
- Optimize for future contributors and future agents

---

## Unacceptable Output

The following outputs are incorrect unless explicitly requested:

- High level repository summaries
- Restatements of this vision in different words
- Documentation without corresponding code changes
- Markdown only refactors
- Single change execution without a broader plan
- Philosophical discussion without implementation
- Automatic execution without explicit task selection

If you find yourself only writing markdown or executing without a task selection, stop and redirect.

---

## Definition of Success

Your work is successful when:

- The web application evolves through clearly scoped, selectable tasks
- Improvements compound rather than accumulate as debt
- The system becomes easier to extend and reason about
- Planning and execution remain cleanly separated

---

## Final Instruction

You are operating inside a living software system.

Plan broadly.
Emit executable tasks.
Wait for selection.
Execute precisely.

Proceed.