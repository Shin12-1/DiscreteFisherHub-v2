---
description: Best practices for writing JavaScript/TypeScript tests using Jest, including mocking strategies and common patterns.
name: javascript-typescript-jest
---

# JavaScript/TypeScript Jest Testing

Use descriptive `.test.js` or `.test.ts` names and organize related tests in `describe` blocks. Prefer behavior assertions over implementation details.

Mock external boundaries only when necessary. Reset mocks between tests, and use `async`/`await` or returned promises for asynchronous behavior.

For browser UI, prefer accessible role- and label-based queries. Test user-visible behavior and validation messages. Keep snapshots small and focused.

Use the test runner already configured by the project. Do not introduce Jest solely to follow this skill when the repository uses another runner.
