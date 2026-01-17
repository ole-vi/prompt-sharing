import { describe, it, expect } from 'vitest';
import { validateOwner, validateRepo, validateBranch } from '../../utils/validation.js';

describe('validation.js', () => {
  describe('validateOwner', () => {
    it('should validate correct owner', () => {
      expect(validateOwner('promptroot')).toBe(true);
      expect(validateOwner('my-org')).toBe(true);
      expect(validateOwner('User123')).toBe(true);
    });

    it('should invalidate incorrect owner', () => {
      expect(validateOwner('')).toBe(false);
      expect(validateOwner('-start')).toBe(false);
      expect(validateOwner('end-')).toBe(false);
      expect(validateOwner('double--hyphen')).toBe(false);
      expect(validateOwner('invalid char')).toBe(false);
      expect(validateOwner('a'.repeat(40))).toBe(false);
    });
  });

  describe('validateRepo', () => {
    it('should validate correct repo', () => {
      expect(validateRepo('my-repo')).toBe(true);
      expect(validateRepo('repo.name')).toBe(true);
      expect(validateRepo('repo_name')).toBe(true);
    });

    it('should invalidate incorrect repo', () => {
      expect(validateRepo('')).toBe(false);
      expect(validateRepo('.')).toBe(false);
      expect(validateRepo('..')).toBe(false);
      expect(validateRepo('invalid/char')).toBe(false);
      expect(validateRepo('a'.repeat(101))).toBe(false);
    });
  });

  describe('validateBranch', () => {
      it('should validate correct branch', () => {
          expect(validateBranch('main')).toBe(true);
          expect(validateBranch('feature/branch')).toBe(true);
      });

      it('should invalidate incorrect branch', () => {
          expect(validateBranch('/start')).toBe(false);
          expect(validateBranch('end/')).toBe(false);
          expect(validateBranch('double//slash')).toBe(false);
          expect(validateBranch('dot..dot')).toBe(false);
          expect(validateBranch('@{')).toBe(false);
          expect(validateBranch('back\\slash')).toBe(false);
      });
  });
});
