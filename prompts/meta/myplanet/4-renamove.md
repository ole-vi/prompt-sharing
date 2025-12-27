Create 10 granular tasks focused on:

- Renaming files/classes for consistency (like AdapterX → XAdapter)
- Moving files to better organized packages
- Renaming packages/directories for clarity
- Ensure tasks can run in parallel without merge conflicts

1. Adapter naming consistency (prefix → suffix style)
2. Repository naming (singular → plural)
3. Package reorganization (moving files to better locations)
4. Directory renaming for clarity

AVOID: Creating new ViewModels or major architectural changes
FOCUS: Refactoring, renaming, reorganizing existing code"

Find 10 refactoring opportunities for:
- Inconsistent naming patterns (files, classes, packages)
- Misplaced files that should be in different packages
- Directory structure improvements

Focus on cosmetic/structural improvements only:
- Renames, moves, package restructuring
- NO new classes, NO new ViewModels, NO new features
- Just cleanup and consistency improvements

also we wanna mostly avoid merge conflicts during this PR review merge round

anyhow
keep it as granular as possible
do not work on coding
focus on this report of 10 tasks
whichs output you format the following way


```
document  := { finding_section } [ testing_section ]

finding_section :=
  "### " title "\n"
  rationale_paragraph "\n"
  { "\n" citation_line }
  "\n"
  task_stub_block "\n"

title := <short text, no trailing period>

rationale_paragraph := <1–3 sentences, plain text>

citation_line :=
  ":codex-file-citation[codex-file-citation]{"
  "line_range_start=" int " "
  "line_range_end=" int " "
  "path=" path " "
  "git_url=\"" url "#L" int "-L" int "\"}"
  
task_stub_block :=
  ":::task-stub{title=\"" task_title "\"}\n"
  step_line
  { "\n" step_line }
  "\n:::" 

step_line := int "." space step_text
```

ps there is no code output
we want an easy copyable plan
composed of at least 10 tasks
in above grammar
output into a temporary markdown file
and/or in an easy copyable way
