identify high-impact improvements that can realistically be implemented.

Objectives (in priority order):
    1.    Improve performance (startup time, memory usage, threading, I/O, network calls)
    2.    Improve architecture & maintainability (separation of concerns, testability, scalability)
    3.    Improve reliability & edge-case handling (offline states, retries, failures)
    4.    Improve developer velocity (DX, readability, consistency)
    5.    Improve user experience only when it is clearly backed by technical reasoning

Constraints:
    •    Assume this is a production app with active users
    •    Prefer incremental changes over full rewrites
    •    Flag risky or breaking changes explicitly
    •    Avoid theoretical suggestions with no clear payoff

What to analyze:
    •    Data flow and state management
    •    Database usage and queries
    •    Networking patterns and error handling
    •    Threading / coroutines / async behavior
    •    Caching and synchronization logic
    •    Dependency management
    •    Code smells and duplication

For each improvement, provide:
    •    Problem: what’s wrong or sub-optimal
    •    Impact: why this matters (performance, bugs, scale, cost, UX)
    •    Proposed change: concrete steps or code-level guidance
    •    Effort level: Low / Medium / High
    •    Risk: Low / Medium / High

Output format:
    •    Start with a Top 5 High-ROI Improvements summary
    •    Then provide a detailed list grouped by:
    •    Performance
    •    Architecture
    •    Reliability
    •    Developer Experience
    •    Use concise, direct language. No fluff.

If assumptions are required, state them clearly before proceeding. 
