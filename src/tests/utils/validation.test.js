import { describe, it, expect } from 'vitest';
import { validateOwner, validateRepo, validateBranch, isUrlSafe } from '../../utils/validation.js';

describe('validation.js', () => {
  describe('isUrlSafe', () => {
    it('should allow https URLs', () => {
      expect(isUrlSafe('https://google.com')).toBe(true);
      expect(isUrlSafe('https://example.com/path?query=1')).toBe(true);
    });

    it('should allow http URLs for trusted domains', () => {
      expect(isUrlSafe('http://localhost:3000')).toBe(true);
      expect(isUrlSafe('http://127.0.0.1:8080')).toBe(true);
    });

    it('should block http URLs for untrusted domains', () => {
      expect(isUrlSafe('http://example.com')).toBe(false);
      expect(isUrlSafe('http://google.com')).toBe(false);
      expect(isUrlSafe('http://192.168.1.1')).toBe(false);
    });

    it('should block unsafe schemes', () => {
      expect(isUrlSafe('javascript:alert(1)')).toBe(false);
      expect(isUrlSafe('data:text/plain;base64,SGVsbG8=')).toBe(false);
      expect(isUrlSafe('file:///etc/passwd')).toBe(false);
      expect(isUrlSafe('content://com.android.providers.media.documents')).toBe(false);
      expect(isUrlSafe('ftp://example.com')).toBe(false);
      expect(isUrlSafe('mailto:user@example.com')).toBe(false);
    });

    it('should handle invalid URLs', () => {
      expect(isUrlSafe('not-a-url')).toBe(false);
      expect(isUrlSafe(null)).toBe(false);
      expect(isUrlSafe(undefined)).toBe(false);
      expect(isUrlSafe(123)).toBe(false);
    });
  });

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
