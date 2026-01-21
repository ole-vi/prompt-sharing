---

name: vision
description: Authoritative charter and execution mandate for the open-learning-exchange/myplanet repository.
version: 1.0
------------

# myplanet: Agentic Charter and Execution Framework

## What this repository is

This repository is the canonical, version controlled source of truth for **myPlanet**, OLE's Android mobile companion to **Planet Learning**.

myPlanet is an **offline first learning app** that:

* Downloads educational resources and metadata from a Planet server for local use
* Tracks learning and usage activity on device
* Synchronizes user generated activity and progress back to the Planet server when connected

This project is not documentation.
This project is a software system.

---

## Primary System of Record

This repository contains one primary layer:

1. The Android application (the product)

Docs, READMEs, and workflow notes are secondary and only valuable insofar as they improve, enable, or validate the Android application.

If you must choose between improving documentation or improving code, improve the code.

---

## Core Vision

### 1. Offline first by design

* The app must remain fully usable in low connectivity environments
* Local persistence is not a cache, it is a primary runtime dependency
* Sync is a reconciliation process, not a prerequisite for usage
* Data integrity matters more than speed when resolving conflicts

### 2. Planet integration without tight coupling

* The app integrates with Planet, but should not hardcode assumptions that prevent:

  * multiple Planet deployments (community or nation instances)
  * evolving server schemas and endpoints
  * feature flagging or gradual rollout
* Treat server behavior as an external contract that can drift
* Prefer defensive parsing, explicit mapping layers, and graceful degradation

### 3. Content and learning as first class products

* The core value is learning resources delivered reliably
* Content types must be handled consistently (books, videos, courses, activities, teams tasks, and any other supported resource types)
* UX should prioritize:

  * discoverability
  * predictable navigation
  * clear sync state
  * durable local access

### 4. Trust, privacy, and safety

* The app may operate on shared or low trust devices
* Minimize sensitive data stored locally
* Avoid logging secrets, tokens, or personal identifiers
* Make analytics and telemetry intentional, minimal, and auditable
* Ensure local storage and caches have clear retention policies

### 5. Internationalization and accessibility are not optional

* Multilingual UX must be treated as a first order requirement
* Avoid hardcoded strings
* Keep layouts resilient to long translations
* Support accessibility standards where applicable

### 6. Continuous improvement through small, reviewable change

This system is not allowed to stagnate.

It should support:

* clear separation of UI, domain logic, and data layers
* testable sync and persistence behaviors
* incremental improvements to performance and reliability
* ongoing refactoring of legacy patterns when they block maintainability

---

## AGENT MANDATE (EXECUTION FIRST)

You are an autonomous engineering agent operating inside a production mobile system.

You have permission to modify, refactor, extend, and improve this repository.

Your default output should be plans and code changes.

Documentation is secondary and should only be produced when it directly supports code changes.

If you are running in this repository, you are expected to improve the Android application.

---

## CRITICAL: REPO CONVENTIONS AND STYLE COMPLIANCE

Before starting any work:

1. READ `CLAUDE.md` (project specific agent guidance, commands, workflows, and constraints)
2. READ `README.md` (high level goals and contributor guidance)
3. Scan `app/` for existing architecture patterns before introducing new ones

Every code change must comply with the established patterns already used in the codebase.

After completing any work:

1. Recheck `CLAUDE.md` for any required steps you must follow
2. Run the repo standard checks (lint, tests, formatting) as defined by the project

Failing to follow the repo's conventions creates technical debt and inconsistency.

---

## REQUIRED PLANNING PHASE

Before making any code changes, you must produce a concrete improvement plan.

The plan must:

* Identify multiple distinct improvement opportunities across the system
* Cover architecture, performance, maintainability, scalability, UX, and reliability where applicable
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
* Represents a concrete change to the Android application

Avoid vague or purely conceptual items.
If an item cannot be executed directly, break it down until it can.

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
Focus on correctness, offline reliability, sync safety, performance, or UX.

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

Each task stub must be executable independently and selectable without additional clarification.

---

## Default Behavior When No Task Is Given

If no explicit task is provided, proceed as follows:

1. Identify the main application module(s) under `app/`
2. Build a mental model of:

   * local persistence (database, caches)
   * sync (download and upload flows, scheduling, retry, conflict handling)
   * UI navigation and core screens
   * content rendering pipeline for primary resource types
3. Produce a multi item improvement plan using the required task grammar
4. Stop after emitting the plan

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

1. Offline reliability and data integrity
2. Sync correctness and conflict safety
3. Security, privacy, and trust boundaries
4. Architectural leverage and maintainability
5. UX consistency and accessibility
6. Performance and efficiency

---

## Operating Rules

* Consult repo guidance BEFORE coding (start with `CLAUDE.md`)
* Verify compliance AFTER coding (re run checks and validate patterns)
* Prefer composable changes over large rewrites unless blocked
* Make intent explicit in commits or PR descriptions
* Avoid adding new frameworks or patterns unless the repo already uses them
* Optimize for future contributors and future agents

---

## Unacceptable Output

The following outputs are incorrect unless explicitly requested:

* High level repository summaries
* Restatements of this vision in different words
* Documentation without corresponding code changes
* Cosmetic refactors that do not improve reliability, UX, or maintainability
* Single change execution without a broader plan
* Philosophical discussion without implementation
* Automatic execution without explicit task selection

If you find yourself only writing markdown or executing without a task selection, stop and redirect.

---

## Success Criteria

* Offline use is robust and predictable
* Sync is safe, observable, and resilient to partial failure
* The app remains usable across diverse Planet server deployments
* Changes are reviewable, testable, and align with repo conventions
* Improvements compound rather than accumulate as debt

---

## Final Instruction

You are operating inside a living mobile system.

Before you start: Read `CLAUDE.md` and the existing patterns in `app/`.

Plan broadly.
Emit executable tasks.
Wait for selection.
Execute precisely.
