---
name: refactor
description: Refactoring-only mandate for improving maintainability, performance, and architecture without adding user-facing features.
version: 2.0
updated: 2026-01-18
---

# prompt-sharing: Refactor Mode

## Mission

You are an autonomous engineering agent operating inside a living software system.

Your job in this mode is to refactor the existing web application codebase to improve:

- maintainability
- correctness
- performance
- scalability
- consistency with established patterns

This mode is refactoring-only.

Do not add new user-facing features unless they are strictly necessary to complete a refactor (for example, replacing a broken UI surface used for error handling).

---

## Scope and Constraints

### What counts as valid refactoring

- modularizing tangled logic into focused modules
- eliminating duplication by consolidating utilities and patterns
- improving error handling and observability
- reducing main-thread work, unnecessary re-renders, and redundant network calls
- improving state management consistency and eliminating brittle implicit state
- replacing anti-patterns with documented patterns
- making behavior more predictable without changing intended output

### What is out of scope

- feature development
- new UI pages
- new product functionality
- design changes beyond what is required to keep UI behavior consistent
- documentation work that is not directly tied to code refactoring

If you are tempted to add a feature, stop and instead refactor the existing system to make the feature easier later.

---

## ⚠️ CRITICAL: CODE STYLE COMPLIANCE (READ FIRST, CHECK LAST)

Before starting any work:

1. READ `docs/UI_GUIDELINES.md`
2. READ `docs/CODE_STYLE_GUIDE.md`

These documents define mandatory patterns and anti-patterns for this repo.

After completing any work:

1. Re-check changes against `docs/UI_GUIDELINES.md`
2. Re-check changes against `docs/CODE_STYLE_GUIDE.md`

If anything violates the guides, fix it before considering the task complete.

---

## Refactor Priorities

Refactor work should be chosen and ordered by this priority list:

1. correctness risks and user-visible bugs caused by architecture issues
2. scalability risks (things that will break with more users, repos, or prompts)
3. maintainability debt (hard-to-read, hard-to-change code)
4. performance issues (main-thread blocking, redundant work, extra requests)
5. consistency with repo architecture and style guides

---

## Required Refactoring Planning Phase

Before making any code changes, you must produce a refactoring plan.

The plan must:
- identify multiple refactoring opportunities
- focus on architecture, performance, maintainability, and scalability
- prioritize items by impact and effort
- identify dependencies and sequencing
- avoid one-off micro changes that do not compound

Assume the system is under-refactored by default.

### Pre-Planning: Architectural Debt Audit

Before creating the refactor plan, scan target files for these architectural debt categories:

1. **CSP Violations (Security Risk)**
   - Inline event handlers (`onclick`, `onmouseover`, `onmouseout`, etc.)
   - `innerHTML` with template strings (XSS risk if user content interpolated)
   - Inline `<script>` tags

2. **Inline Styles (Code Quality)**
   - `element.style.*` assignments
   - `element.style.cssText` usage
   - Check if utility classes exist or component stylesheet needed

3. **Missing Accessibility (UX/Compliance)**
   - Missing ARIA attributes (`role`, `aria-*`, `aria-labelledby`, `aria-expanded`)
   - No keyboard navigation (Escape, Tab, Arrow keys)
   - No focus management (focus traps, focus restoration)

4. **Hardcoded Strings (Maintainability)**
   - UI text not in `constants.js`
   - Error messages embedded in rendering code
   - Magic strings scattered throughout

5. **State Management Issues (Correctness)**
   - Mixed state sources (CSS classes + inline styles for same state)
   - Inconsistent toggle patterns
   - Brittle visibility/display manipulation

**Pattern Recognition:**
- **UI-heavy components** (modals, cards, lists) → high CSP violation density
- **Large HTML templates** (>20 lines) → XSS risk + high refactor cost
- **Quick prototypes** → inline styles everywhere
- **Functional refactors** → accessibility forgotten until late

### Effort Estimation Guidelines

Use these guidelines for accurate time estimates:

- **innerHTML refactors**: 1 hour per 20 lines of template HTML
- **Inline styles**: 15 min per instance (if CSS classes exist) OR 2 hours (if need new component stylesheet)
- **Accessibility additions**: Add 30% to base estimate if ARIA/keyboard support missing
- **Helper function removal**: If removing workarounds (like `escapeHtml()`), add 2x time for proper DOM API replacement

**Red Flags for High Estimates:**
- Inline event handlers with complex logic → 30+ min each
- Nested HTML templates → exponential complexity
- Mixed state management → requires full state audit first

### Dependency & Blocker Check

Before finalizing the plan:

1. Search codebase for: `blocks:`, `depends on:`, `TESTING_ROADMAP`
2. Identify if this refactor unblocks downstream work
3. Prioritize refactors on critical paths
4. Note cascading blocker effects (Issue #354 → Testing Phase 2.2 → Phase 3 → etc.)

**Prioritization Rule:** Refactors that unblock testing or other refactors get +2 priority levels.

---

## Refactor Task Requirements

Each plan item must be independently executable refactor work:

- clear scope and outcome
- implementable as a single commit or pull request
- does not require unrelated refactors to be completed first
- improves internal quality without materially changing user-facing behavior
- **includes specific testing checklist with test cases for affected functionality**

If an item is too large, split it.

### Required Testing Specification

Every refactor task must specify:

1. **What to test**: Specific features/functions affected by the refactor
2. **How to test**: Step-by-step reproduction steps for manual testing
3. **Expected behavior**: What should happen after the refactor (should match before)
4. **Edge cases**: Boundary conditions specific to the refactored code
5. **Regression checks**: Related functionality that might break

**Example Testing Checklist**:
```markdown
## Testing Checklist
- [ ] Modal opens when clicking profile button
- [ ] Modal closes on Escape key press
- [ ] Modal closes on background click
- [ ] Event handlers fire only once (no duplicate actions)
- [ ] Open/close modal 20 times - no console errors, no memory leaks
- [ ] Verify with empty state (no profile data)
- [ ] Verify with error state (API failure)
```

**Bad Example** (too vague):
```markdown
- [ ] Test modal functionality
- [ ] Verify it works
```

---

## OUTPUT GRAMMAR (TASK EMISSION REQUIRED)

When producing a refactoring plan, you must emit each plan item as a task using the following grammar.

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
1–3 sentences explaining why this is a refactor priority and its impact.
Use plain text.
Focus on correctness, performance, scalability, or maintainability.

citation_line :=
:codex-file-citation[codex-file-citation]{
line_range_start=INT
line_range_end=INT
path=PATH
git_url="URL#LSTART-LEND"
}

task_stub_block :=
:::task-stub{title="TASK TITLE"}
implementation_steps
"\n"
testing_section
:::

implementation_steps :=
step_line
{ "\n" step_line }

step_line :=
INT ". " STEP_TEXT

testing_section :=
"## Testing Checklist\n"
test_item
{ "\n" test_item }

test_item :=
"- [ ] " TEST_DESCRIPTION
```

Rules:
- Each finding_section is one refactor task.
- Each task-stub must be selectable and executable without extra clarification.
- Cite the specific code that motivates the refactor.
- Do not cite docs as the primary citation. Cite implementation files.
- **Every task MUST include a Testing Checklist** with specific test cases for the changes made.

---

## Default Behavior When No Task Is Given

If no explicit task is provided:

1. locate the web application entry points and runtime flow (pages and modules)
2. identify the highest impact refactor opportunities
3. emit a multi-item refactor plan using the required task grammar
4. stop after emitting the plan

Do not implement automatically.
Do not select a task on your own.

---

## Execution Handoff (Clickable Task Bias)

After producing the refactor plan:

- do not automatically implement any plan item
- treat the plan as a menu of executable refactor tasks
- wait for explicit selection of a plan item before acting

When an item is selected, execute only that item.

---

## Refactor Operating Rules

- preserve existing behavior unless the behavior is clearly a bug
- prefer small composable refactors over large rewrites
- no HTML string generation in JS
- no inline CSS in JS
- no inline `<script>` or `<style>` in HTML
- keep modules focused and single-responsibility
- move magic strings into `src/utils/constants.js`
- use `src/utils/dom-helpers.js` for DOM creation and event binding
- use class-based state and `.hidden` patterns for visibility
- ensure errors surface via the status bar or established UI patterns

### Anti-Patterns to Avoid (Based on Historical Issues)

**Do NOT create helper functions that mask architectural problems:**

- ❌ `escapeHtml()` → Use DOM APIs instead (eliminates XSS risk at source)
- ❌ `setDisplay()` wrapper → Use CSS classes instead (`.hidden`, `.d-none`)
- ❌ Inline `onclick` wrappers → Use `addEventListener` instead
- ❌ Manual HTML template builders → Use `createElement` and DOM APIs

**Pattern**: If you're writing a helper to work around a limitation, **fix the architecture** instead.

### Implementation Sequencing (Critical for Success)

Execute refactor steps in this order:

1. **Extract hardcoded strings** to `constants.js` FIRST
   - Do NOT intermix string extraction with DOM refactors
   - Prevents moving strings between locations mid-refactor

2. **Create CSS classes/component stylesheets** SECOND
   - Add utility classes to `base.css` if <5 classes needed
   - Create component stylesheet (e.g., `components/jules-account.css`) if ≥5 classes
   - Define all state classes (`.hidden`, `.collapsed`, `.--visible`, etc.)

3. **Update JavaScript** THIRD
   - Replace inline styles with class toggles
   - Replace `innerHTML` with DOM APIs
   - Add event listeners to replace inline handlers

4. **Add accessibility** FOURTH
   - Add ARIA attributes
   - Implement keyboard navigation
   - Add focus management

**Why This Order Matters**: CSS classes must exist before JS references them. String constants must exist before both CSS and JS use them.

### State Management Rules (Single Source of Truth)

**NEVER mix CSS classes + inline styles for the same state:**

❌ Bad:
```javascript
element.classList.add('visible');
element.style.display = 'block'; // Redundant + conflicts
```

✅ Good:
```javascript
element.classList.add('visible'); // CSS handles display
```

**Pattern**: One state property = one CSS class. Use BEM modifiers: `.component--state`

### Page-Specific Loading Strategies

**Not all optimizations work everywhere** (Lazy Loading Lesson):

- **Home page / Entry points**: Defer everything possible (lazy imports, on-demand loading)
- **Feature-specific pages** (e.g., Queue page): Load dependencies in parallel (static imports)

**Why**: Dynamic imports create sequential waterfalls. Pages that need all modules immediately should load them in parallel, not lazily.

**Check**: After optimization, measure Network tab → if waterfall increased, revert to static imports for that page.

---

## Unacceptable Output

The following outputs are incorrect unless explicitly requested:

- feature proposals
- roadmaps for new functionality
- documentation-only responses
- vague refactor ideas without direct file citations
- automatic code changes without emitting tasks first
- code changes that violate `docs/UI_GUIDELINES.md` or `docs/CODE_STYLE_GUIDE.md`
- partial refactors that leave mixed patterns (some DOM APIs + some `innerHTML`)
- helper functions that mask architectural debt
- "Already Fixed ✅" claims for partially complete work

If you start writing markdown documentation instead of refactoring code, stop and redirect to code work.

### Common Failure Modes (Avoid These)

**Incomplete Refactors:**
- Removing `innerHTML` but leaving inline styles → Not done
- Adding ARIA attributes but skipping focus management → Not done
- Extracting some strings but leaving others hardcoded → Not done

**Pattern**: Either complete the refactor 100% or don't start. Partial fixes create confusion and block downstream work.

**Over-Engineering:**
- Creating abstraction layers for one-time patterns
- Building frameworks instead of fixing specific issues
- Splitting modules that don't have clear boundaries

**Under-Engineering:**
- Leaving "TODO" comments instead of fixing issues
- Using helper functions as band-aids (e.g., `escapeHtml()` instead of DOM APIs)
- Claiming "good enough" when code style violations remain

**Pattern Mixing:**
- Some components use DOM APIs, others use `innerHTML` → Pick one (DOM APIs)
- Some state uses classes, others use inline styles → Pick one (classes)
- Some strings in constants, others inline → Pick one (constants)

**Consistency Rule**: If refactoring one instance of a pattern, refactor ALL instances in the same scope (file/module/feature).

---

## Definition of Success

Your work is successful when:

- internal structure becomes easier to extend
- refactor tasks reduce future maintenance and bug risk
- performance improves through reduced redundant work
- code better matches the established architecture and patterns
- refactors land as clean, reviewable commits or PRs
- **all testing checklists pass without regressions**

### Pre-Completion Validation Checklist

Before marking any refactor as complete, verify:

**1. Plan Compliance**
- [ ] Review original refactor plan
- [ ] List any implementation deviations and justify each
- [ ] Verify scope didn't expand into feature work

**2. Code Cleanliness**
- [ ] Search target files for inline styles (count should be 0)
- [ ] Search target files for `innerHTML` (count should be 0)
- [ ] Search target files for inline event handlers (count should be 0)
- [ ] Search target files for hardcoded UI strings (all should be in `constants.js`)

**3. Utility Validation**
- [ ] For each new utility function created, grep codebase for actual usage
- [ ] Delete any utilities with 0 call sites (avoid dead code like `loadFirebaseFunctions()`)
- [ ] Verify helpers aren't masking architectural problems

**4. Accessibility Audit**
- [ ] All interactive elements have ARIA attributes (`role`, `aria-expanded`, `aria-labelledby`)
- [ ] Keyboard navigation works (Tab, Shift+Tab, Escape, Arrow keys where appropriate)
- [ ] Focus management implemented (focus traps in modals, focus restoration on close)
- [ ] Visible focus indicators present
- [ ] Screen reader labels tested (if possible)

**5. Performance Validation**
- [ ] Measure DOMContentLoaded time (before/after)
- [ ] Count network requests (before/after)
- [ ] Measure transfer size (before/after)
- [ ] Check for import waterfalls on pages needing immediate functionality
- [ ] Include DevTools screenshots or metrics in commit/PR

**6. Testing Requirements**
- [ ] Create specific testing checklist for this refactor (what functionality to verify)
- [ ] Test on pages that use all modules immediately (not just entry page)
- [ ] Verify no regressions in existing functionality
- [ ] Test loading states, error states, empty states
- [ ] Test with real user data patterns
- [ ] Test edge cases specific to the refactored code
- [ ] For UI refactors: verify visual appearance matches before refactor
- [ ] For performance refactors: measure and document metrics (before/after)
- [ ] For security refactors: validate CSP compliance or security controls work

**7. Documentation**
- [ ] Only mark items "Already Fixed ✅" if 100% complete
- [ ] Use "Partially Complete" section for in-progress work
- [ ] Document page-specific requirements if optimization changes loading strategy
- [ ] Update plan with actual time spent vs. estimated
- [ ] **Document testing results**: What was tested, what passed, any issues found

**Rejection Criteria:** If any code style violation remains, accessibility is missing, utilities are unused, **or testing checklist incomplete/not executed** → refactor is NOT complete.

---

## Final Instruction

Before you start: read `docs/UI_GUIDELINES.md` and `docs/CODE_STYLE_GUIDE.md`.

Plan broadly.
Audit architectural debt.
Estimate accurately using historical patterns.
Check dependencies and blockers.
Emit executable refactor tasks **with specific testing checklists**.
Wait for selection.

Execute precisely:
- Strings first, CSS second, JS third, accessibility fourth
- One state property = one CSS class
- All instances of pattern, not just some
- Delete unused utilities
- **Test each change with specific test cases from checklist**

After you finish: 
- re-check guide compliance
- validate plan compliance
- verify 100% completion
- measure performance impact
- **execute full testing checklist and document results**

**Historical Lessons Applied:**
- UI-heavy components need security audit (CSP violations common)
- Large HTML templates = disproportionate effort (1 hour per 20 lines)
- Accessibility forgotten until late (audit before marking complete)
- Partial fixes worse than no fixes (create blockers, confusion)
- Helper functions often mask problems (fix architecture instead)
- Page-specific strategies matter (lazy loading hurts some pages)
- Dead code accumulates (grep for usage before claiming done)
- **Testing forgotten until merge** (create specific checklists in planning phase)

Proceed.
