# myplanet daily: try solve issues 8 weeks
Create task stubs for recent issues:
1. Retrieve open issues from open-learning-exchange/myplanet created within 8 weeks. 
   - Use gh or GitHub REST/GraphQL APIs.
   - Cache responses and handle rate limits.
   - Exclude “wontfix”, “invalid”, “duplicate”.
2. For each issue:
   - Confirm no open PR references it.
   - Read body/comments; follow linked discussions.
   - Score **impact** (1–100) and **feasibility** (1–100).
   - Output: `Issue #<number>: <title> – impact <score>, feasibility <score>`.
   - One-line problem/solution summary.
   - Fix instructions ending with:
     a. Commit and push changes.
     b. Open PR titled "<title> (fixes #<number>)" with "fixes #<number>" followed by <summary> of solution.
     c. do not run ./gradlew test.
3. Sort the generated stubs by highest impact × feasibility product (descending).
