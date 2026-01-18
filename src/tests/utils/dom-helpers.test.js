import { describe, it, expect, beforeEach } from 'vitest';
import { createElement, clearElement } from '../../utils/dom-helpers.js';

describe('DOM Helpers', () => {
  describe('createElement', () => {
    it('should create element with tag', () => {
      const el = createElement('div');
      expect(el.tagName).toBe('DIV');
    });

    it('should apply single class', () => {
      const el = createElement('div', 'test-class');
      expect(el.classList.contains('test-class')).toBe(true);
    });

    it('should apply multiple classes', () => {
      const el = createElement('button', 'btn primary large');
      expect(el.classList.contains('btn')).toBe(true);
      expect(el.classList.contains('primary')).toBe(true);
      expect(el.classList.contains('large')).toBe(true);
    });

    it('should set text content', () => {
      const el = createElement('span', '', 'Hello World');
      expect(el.textContent).toBe('Hello World');
    });

    it('should create with class and text', () => {
      const el = createElement('h1', 'title', 'My Title');
      expect(el.tagName).toBe('H1');
      expect(el.classList.contains('title')).toBe(true);
      expect(el.textContent).toBe('My Title');
    });

    it('should handle empty class string', () => {
      const el = createElement('div', '', 'Text only');
      expect(el.className).toBe('');
      expect(el.textContent).toBe('Text only');
    });
  });

  describe('clearElement', () => {
    beforeEach(() => {
      document.body.innerHTML = '<div id="parent"><span>Child 1</span><span>Child 2</span></div>';
    });

    it('should remove all children', () => {
      const parent = document.getElementById('parent');
      expect(parent.children.length).toBe(2);

      clearElement(parent);

      expect(parent.children.length).toBe(0);
      expect(parent.innerHTML).toBe('');
    });

    it('should handle empty parent', () => {
      const parent = document.createElement('div');

      clearElement(parent);

      expect(parent.children.length).toBe(0);
    });
  });
});
