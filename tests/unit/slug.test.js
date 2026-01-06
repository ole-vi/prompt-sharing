import { describe, it, expect } from 'vitest';
import { slugify, unslugify } from '../../src/utils/slug.js';

describe('slug', () => {
  describe('slugify', () => {
    it('should correctly slugify a simple path', () => {
      expect(slugify('prompts/hello.md')).toBe('prompts%2Fhello');
    });

    it('should handle spaces', () => {
      expect(slugify('prompts/hello world.md')).toBe('prompts%2Fhello-world');
    });

    it('should handle special characters', () => {
        expect(slugify('prompts/file-with-!@#$%^&*()-+=.md')).toBe('prompts%2Ffile-with-!%40%23%24%25%5E%26*()-%2B%3D');
    });

    it('should be case-insensitive to the .md extension', () => {
        expect(slugify('prompts/TEST.MD')).toBe('prompts%2Ftest');
    });
  });

  describe('unslugify', () => {
    it('should correctly unslugify a simple slug', () => {
      expect(unslugify('prompts%2Fhello')).toBe('prompts/hello');
    });
  });
});
