import { describe, it, expect } from 'vitest';
import { validateOwner, validateRepo, validateBranch, validatePath } from '../../utils/validation.js';

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
          expect(validateBranch('my-branch')).toBe(true);
          expect(validateBranch('my_branch')).toBe(true);
          expect(validateBranch('v1.0')).toBe(true);
      });

      it('should invalidate incorrect branch', () => {
          expect(validateBranch('/start')).toBe(false);
          expect(validateBranch('end/')).toBe(false);
          expect(validateBranch('double//slash')).toBe(false);
          expect(validateBranch('dot..dot')).toBe(false);
          expect(validateBranch('@{')).toBe(false);
          expect(validateBranch('back\\slash')).toBe(false);
          expect(validateBranch('special$char')).toBe(false);
          expect(validateBranch('space ')).toBe(false);
      });
  });

  describe('validatePath', () => {
      it('should validate correct path', () => {
          expect(validatePath('readme.md')).toBe(true);
          expect(validatePath('src/utils/validation.js')).toBe(true);
          expect(validatePath('images/logo.png')).toBe(true);
      });

      it('should invalidate path traversal', () => {
          expect(validatePath('../secret.txt')).toBe(false);
          expect(validatePath('folder/../file')).toBe(false);
          expect(validatePath('..')).toBe(false);
      });

      it('should invalidate absolute paths', () => {
          expect(validatePath('/etc/passwd')).toBe(false);
          expect(validatePath('/usr/bin')).toBe(false);
      });

      it('should invalidate empty path', () => {
          expect(validatePath('')).toBe(false);
      });

      it('should invalidate non-string', () => {
          expect(validatePath(null)).toBe(false);
          expect(validatePath(undefined)).toBe(false);
          expect(validatePath(123)).toBe(false);
      });
  });
});
