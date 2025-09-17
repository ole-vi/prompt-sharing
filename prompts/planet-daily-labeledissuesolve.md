# planet: daily - try solve label issues

Create task stubs for new feature requests in the Planet repo:

1. Retrieve open issues from `open-learning-exchange/planet` labeled `feature` or `enhancement`.
   - Use `gh` or the GitHub REST/GraphQL API.
   - Cache responses and handle rate limits.
   - Exclude closed or out-of-scope items.

2. For each issue:
   - Verify it has no open PR already linked.
   - Read the body and comments; follow any linked discussions.
   - Score **impact** (1–100) and **feasibility** (1–100).
   - Output: `Issue #<number>: <title> – impact <score>, feasibility <score>`.
   - Provide a one-line summary of the feature and expected user benefit.
   - Include implementation instructions ending with:
     a. Commit and push code changes.  
     b. Open PR titled `"<title> (fixes #<number>)"` with `"fixes #<number>"` followed by the summary.  
     c. Do not run automated tests until reviewers request them.

3. Sort the generated stubs by **highest impact × feasibility** product (descending).
