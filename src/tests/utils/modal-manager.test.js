import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createModal } from '../../utils/modal-manager.js';

// Minimal DOM environment simulation if not present
if (typeof document === 'undefined') {
    // This is just a fallback, usually vitest runs with jsdom
}

describe('ModalManager', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should create a modal structure', () => {
    const modal = createModal({ title: 'Test Modal', id: 'testModal' });
    expect(modal.element).toBeDefined();
    expect(modal.element.id).toBe('testModal');
    // We can't easily check textContent if innerHTML wasn't fully processed or if createElement mock is simple
    // But assuming standard DOM environment:
    const title = modal.element.querySelector('.modal-title');
    expect(title).not.toBeNull();
    expect(title.textContent).toBe('Test Modal');
  });

  it('should show and hide modal', async () => {
    const modal = createModal({});
    modal.show();

    expect(document.body.contains(modal.element)).toBe(true);

    // show() uses requestAnimationFrame, so class might not be there immediately without wait
    // But we check appendChild logic mainly.

    modal.hide();
    expect(modal.element.classList.contains('show')).toBe(false);
  });

  it('should destroy modal and remove from DOM', () => {
    const modal = createModal({});
    modal.show();
    expect(document.body.contains(modal.element)).toBe(true);

    modal.destroy();
    expect(document.body.contains(modal.element)).toBe(false);
  });

  it('should cleanup event listeners on destroy', () => {
    const modal = createModal({});
    const handler = vi.fn();
    const btn = document.createElement('button');
    document.body.appendChild(btn);

    modal.addListener(btn, 'click', handler);

    btn.click();
    expect(handler).toHaveBeenCalledTimes(1);

    modal.destroy();

    btn.click();
    expect(handler).toHaveBeenCalledTimes(1); // Should not increase
  });

  it('should call onClose callback', () => {
    const onClose = vi.fn();
    const modal = createModal({ onClose });

    modal.destroy();
    expect(onClose).toHaveBeenCalled();
  });

  it('should handle custom content string', () => {
      const modal = createModal({ content: '<p>Hello</p>' });
      expect(modal.body.innerHTML).toBe('<p>Hello</p>');
  });

  it('should handle custom content node', () => {
      const p = document.createElement('p');
      p.textContent = 'Node Content';
      const modal = createModal({ content: p });
      expect(modal.body.contains(p)).toBe(true);
  });
});
