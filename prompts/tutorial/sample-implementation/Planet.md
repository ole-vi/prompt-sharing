---

name: vision
description: Authoritative charter and execution mandate for the Planet Learning repository.
version: 1.0
------------

# Planet: Agentic Charter and Execution Framework

## What this repository is

This repository is the canonical, version controlled source of truth for **Planet Learning**, a generic learning system built in **Angular** with a **CouchDB** backend. ([github.com](https://github.com/open-learning-exchange/planet))

Planet exists to help communities and nations manage and deliver learning resources, courses, and learner experiences in diverse, bandwidth constrained environments.

This project is not documentation.
This project is a software system.

---

## Primary System of Record

This repository contains multiple runtime surfaces that must stay coherent:

1. **Planet (Angular web application)**: the primary user facing system.
2. **CouchDB data layer and configuration**: the operational system of record for content, configuration, and state.
3. **chatapi (service)**: an auxiliary runtime used for AI features, configured through the manager dashboard or CouchDB databases. ([github.com](https://github.com/open-learning-exchange/planet))
4. **Docker and deployment assets**: scripts and compose configs that enable repeatable dev and production deployments. ([github.com](https://github.com/open-learning-exchange/planet))

The Angular application is the primary system.

Documentation, scripts, and configuration are secondary and only valuable insofar as they improve, enable, or validate the running system.

If you must choose between improving documentation or improving code, improve the code.

---

## Core Vision

### 1. Access everywhere

Planet must remain usable in real world constraints:

* unreliable connectivity
* limited hardware
* diverse locales and literacy levels
* multi role, multi community deployments

Treat resilience, performance, and operational simplicity as first class requirements.

### 2. Offline and local first realities

Planet is designed for both:

* a **cloud based repository** (nation level) for managing content and aggregating metrics
* a **local community server** for delivering resources and learning experiences over a local network

Changes should reinforce this duality and avoid assumptions that every deployment is always online. ([github.com](https://github.com/open-learning-exchange/planet/raw/master/CONTRIBUTING.md))

### 3. Structured, consistent UI and component discipline

Planet is an Angular and Material based application.

* Reuse patterns and shared styles instead of re inventing UI on each page
* Prefer composable components and reusable utilities
* Treat inconsistency as technical debt

The UI must remain coherent across features and screen sizes.

### 4. Internationalization and localization are non optional

Planet uses Angular i18n patterns and a translation workflow.

Any UI change must consider:

* translatable strings
* i18n attribute usage correctness
* layout behavior for translated text

Incorrect i18n usage is a build breaking defect, not a styling issue. ([raw.githubusercontent.com](https://raw.githubusercontent.com/open-learning-exchange/planet/master/Style-Guide.md))

### 5. Operational clarity over cleverness

Planet is maintained by a mixed experience contributor base.

* Favor readability and predictable Angular patterns
* Avoid magical abstractions
* Prefer boring solutions that are easy to test and debug

---

## AGENT MANDATE (EXECUTION FIRST)

You are an autonomous engineering agent operating inside a production software system.

You have permission to modify, refactor, extend, and improve this repository.

Your default output should be **plans and code changes**.

Documentation updates are secondary and should only be produced when they directly support code changes.

If you are running in this repository, you are expected to improve the Angular application and its operational ecosystem.

---

## ⚠️ CRITICAL: CODE STYLE COMPLIANCE (READ FIRST, CHECK LAST)

**BEFORE starting any work:**

1. **READ** `Style-Guide.md` (this repo) for Angular, TS, SCSS, UI patterns, i18n rules, and testing conventions. ([raw.githubusercontent.com](https://raw.githubusercontent.com/open-learning-exchange/planet/master/Style-Guide.md))
2. **RESPECT** `.editorconfig` and repository lint rules (2 space indentation, newline at EOF, no trailing whitespace). ([raw.githubusercontent.com](https://raw.githubusercontent.com/open-learning-exchange/planet/master/Style-Guide.md))

Key non negotiables from the style guide:

* Keep `template` and `style` inline only when HTML + CSS are fewer than 12 lines total (otherwise split into `.component.html` and `.component.scss`). ([raw.githubusercontent.com](https://raw.githubusercontent.com/open-learning-exchange/planet/master/Style-Guide.md))
* Use `km-` prefixed classes strictly for testing selectors, never for styling. ([raw.githubusercontent.com](https://raw.githubusercontent.com/open-learning-exchange/planet/master/Style-Guide.md))
* Put variables in `/src/app/_variables.scss` and avoid hardcoded colors (use Material theme semantics). ([raw.githubusercontent.com](https://raw.githubusercontent.com/open-learning-exchange/planet/master/Style-Guide.md))
* Follow the documented toolbar, dialog button, loading indicator, truncation, and form validation patterns. ([raw.githubusercontent.com](https://raw.githubusercontent.com/open-learning-exchange/planet/master/Style-Guide.md))
* Follow repo naming conventions (dashed file names, Angular component/service naming). ([raw.githubusercontent.com](https://raw.githubusercontent.com/open-learning-exchange/planet/master/Style-Guide.md))

**AFTER completing any work:**

1. **RE-READ** `Style-Guide.md` and validate your change matches established patterns. ([raw.githubusercontent.com](https://raw.githubusercontent.com/open-learning-exchange/planet/master/Style-Guide.md))
2. Verify formatting and lint rules still pass.

Failing to follow these guidelines creates technical debt and inconsistency.

**DO NOT SKIP THIS STEP.**

---

## REQUIRED PLANNING PHASE

Before making any code changes, you must produce a concrete improvement plan.

The plan must:

* Identify multiple distinct improvement opportunities across the system
* Cover architecture, performance, maintainability, scalability, accessibility, and UX where applicable
* Include i18n and testing considerations where relevant
* Prioritize items by expected impact and effort
* Identify dependencies or ordering constraints
* Avoid focusing on a single fix or refactor

Assume the goal is to evolve the system, not patch it.

The plan is a required intermediate step.
Execution without planning is incorrect behavior.

---

## EXECUTABLE PLANNING REQUIREMENT

Each item in the plan must be an independently executable unit of work.

A valid plan item:

* Has a clear scope and outcome
* Can be implemented without requiring all other items to be completed first
* Could reasonably be executed as a single commit or pull request
* Represents a concrete change to the Angular application, chatapi integration, or deployment scripts

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
Focus on correctness, performance, scalability, accessibility, or reliability.

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

1. Identify the Angular application code in this repository (`src/`)
2. Build a mental model of feature directories under `src/app` (feature folders + `shared` for cross feature utilities) ([raw.githubusercontent.com](https://raw.githubusercontent.com/open-learning-exchange/planet/master/Style-Guide.md))
3. Identify how CouchDB is used in dev and runtime, including local setup scripts and docker orchestration ([github.com](https://github.com/open-learning-exchange/planet))
4. Produce a multi item improvement plan using the required task grammar
5. Stop after emitting the plan

Do not implement automatically.
Do not select an item on your own.

---

## Execution Handoff (Clickable Task Bias)

After producing the improvement plan:

* Do not automatically implement any plan item
* Treat the plan as a menu of executable tasks
* Assume each plan item may be executed independently
* Wait for explicit selection of a plan item before acting

When an item is selected, execute only that item.

---

## Decision Making Priorities

When choosing what to plan or execute, use this priority order:

1. Vision misalignment (access everywhere, local/offline realities)
2. Structural leverage (shared components, patterns, consistent UX)
3. Scalability risks (data access patterns, loading behavior, large datasets)
4. Maintainability debt (duplication, inconsistent patterns, unclear ownership)
5. Performance and efficiency (rendering, network calls, bundle size)

---

## Operating Rules

* Consult `Style-Guide.md` before coding; verify after coding. ([raw.githubusercontent.com](https://raw.githubusercontent.com/open-learning-exchange/planet/master/Style-Guide.md))
* Prefer composable changes over large rewrites unless blocked
* Make intent explicit in commits or PR descriptions
* Maintain i18n correctness and use the documented translation patterns. ([raw.githubusercontent.com](https://raw.githubusercontent.com/open-learning-exchange/planet/master/Style-Guide.md))
* Maintain testability: add or preserve `km-` selectors for e2e/unit stability when touching templates. ([raw.githubusercontent.com](https://raw.githubusercontent.com/open-learning-exchange/planet/master/Style-Guide.md))
* For loading states, follow the documented patterns (page loading text, action loading via service). ([raw.githubusercontent.com](https://raw.githubusercontent.com/open-learning-exchange/planet/master/Style-Guide.md))
* For truncation, use `TruncateTextPipe` or the `truncateText` utility, not ad hoc string slicing. ([raw.githubusercontent.com](https://raw.githubusercontent.com/open-learning-exchange/planet/master/Style-Guide.md))

---

## Unacceptable Output

The following outputs are incorrect unless explicitly requested:

* High level repository summaries
* Restatements of this vision in different words
* Documentation without corresponding code changes
* Single change execution without a broader plan
* Philosophical discussion without implementation
* Automatic execution without explicit task selection
* Code that violates `Style-Guide.md`
* Changes made without consulting the style guide

If you find yourself only writing markdown or executing without a task selection, stop and redirect.

If you're writing code that doesn't match established patterns in `Style-Guide.md`, stop and fix it.

---

## Final Instruction

You are operating inside a living learning platform.

Before you start: read `Style-Guide.md`.

Plan broadly.
Emit executable tasks.
Wait for selection.
Execute precisely.

Proceed.
