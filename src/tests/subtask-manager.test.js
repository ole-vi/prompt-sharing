import { test } from 'node:test';
import assert from 'node:assert';
import { analyzePromptStructure, extractTaskStubs, extractNumberedTasks, breakIntoParagraphs } from '../modules/subtask-manager.js';

test('analyzePromptStructure - detects task stubs', () => {
  const input = `
Some intro text.
:::task-stub{title="Task 1"}
Do this first.
:::
:::task-stub{title="Task 2"}
Do this second.
:::
`;
  const result = analyzePromptStructure(input);
  assert.strictEqual(result.strategy, 'task-stubs');
  assert.strictEqual(result.subtasks.length, 2);
  assert.strictEqual(result.subtasks[0].title, 'Task 1');
  assert.strictEqual(result.subtasks[0].content, 'Do this first.');
});

test('analyzePromptStructure - detects numbered tasks', () => {
  const input = `
Task 1: First thing
Content for task 1.

Task 2: Second thing
Content for task 2.
`;
  const result = analyzePromptStructure(input);
  assert.strictEqual(result.strategy, 'numbered-tasks');
  assert.strictEqual(result.subtasks.length, 2);
  assert.strictEqual(result.subtasks[0].title, 'First thing');
});

test('analyzePromptStructure - falls back to paragraphs for long text', () => {
  const input = `
Para 1 content.

Para 2 content.

Para 3 content.

Para 4 content.
`;
  const result = analyzePromptStructure(input);
  assert.strictEqual(result.strategy, 'paragraph-based');
  assert.strictEqual(result.subtasks.length, 4);
});

test('extractTaskStubs - parses correctly', () => {
    const input = ':::task-stub{title="Test Title"}\nTest Content\n:::';
    const stubs = extractTaskStubs(input);
    assert.strictEqual(stubs.length, 1);
    assert.strictEqual(stubs[0].title, 'Test Title');
    assert.strictEqual(stubs[0].content, 'Test Content');
});

test('analyzePromptStructure - no strategy for short text', () => {
    const input = 'Just a simple short prompt.';
    const result = analyzePromptStructure(input);
    assert.strictEqual(result.strategy, 'none');
    assert.strictEqual(result.subtasks.length, 0);
});
