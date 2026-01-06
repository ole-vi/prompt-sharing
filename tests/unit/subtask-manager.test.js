import { describe, it, expect } from 'vitest';
import { analyzePromptStructure, buildSubtaskSequence } from '../../src/modules/subtask-manager';

describe('subtask-manager', () => {
  describe('analyzePromptStructure', () => {
    it('should detect task-stubs', () => {
      const text = `
:::task-stub{title="Do the first thing"}
This is the first task.
:::
:::task-stub{title="Do the second thing"}
This is the second task.
:::
      `;
      const result = analyzePromptStructure(text);
      expect(result.strategy).toBe('task-stubs');
      expect(result.subtasks).toHaveLength(2);
      expect(result.subtasks[0].title).toBe('Do the first thing');
    });

    it('should detect numbered tasks', () => {
      const text = `
Task 1: Do the first thing
This is the first task.
Task 2: Do the second thing
This is the second task.
      `;
      const result = analyzePromptStructure(text);
      expect(result.strategy).toBe('numbered-tasks');
      expect(result.subtasks).toHaveLength(2);
      expect(result.subtasks[0].title).toBe('Do the first thing');
    });

    it('should return "none" for short or unstructured text', () => {
        const text = 'This is a short prompt.';
        const result = analyzePromptStructure(text);
        expect(result.strategy).toBe('none');
    });
  });

  describe('buildSubtaskSequence', () => {
    it('should add sequence headers and context', () => {
        const fullPrompt = 'A full prompt';
        const subtasks = [
            { id: 1, title: 'Step 1', content: 'Content 1' },
            { id: 2, title: 'Step 2', content: 'Content 2' },
        ];
        const result = buildSubtaskSequence(fullPrompt, subtasks);
        expect(result).toHaveLength(2);
        expect(result[0].fullContent).toContain('Step 1');
        expect(result[0].sequenceInfo.current).toBe(1);
        expect(result[0].sequenceInfo.total).toBe(2);
    });
  });
});
