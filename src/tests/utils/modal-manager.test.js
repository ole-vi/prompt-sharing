import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createModal } from '../../utils/modal-manager.js';

describe('ModalManager', () => {
  let addEventSpy;
  let removeEventSpy;

  beforeEach(() => {
    document.body.innerHTML = '';
    // Spy on prototype to catch calls on any element
    addEventSpy = vi.spyOn(HTMLElement.prototype, 'addEventListener');
    removeEventSpy = vi.spyOn(HTMLElement.prototype, 'removeEventListener');

    // Mock requestAnimationFrame for show()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => cb());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a modal and appends to DOM', () => {
    const modal = createModal({ id: 'test-modal', content: '<div>test</div>' });
    expect(document.getElementById('test-modal')).toBeTruthy();
    expect(modal.element.id).toBe('test-modal');
  });

  it('shows and hides modal', () => {
    const modal = createModal({ id: 'test-modal' });
    const el = document.getElementById('test-modal');

    modal.show();
    expect(el.classList.contains('show')).toBe(true);

    modal.hide();
    expect(el.classList.contains('show')).toBe(false);
  });

  it('destroys modal and removes from DOM', () => {
    const modal = createModal({ id: 'test-modal' });
    expect(document.getElementById('test-modal')).toBeTruthy();

    modal.destroy();
    expect(document.getElementById('test-modal')).toBeNull();
  });

  it('tracks and cleans up event listeners', () => {
    const modal = createModal({ id: 'test-modal' });
    const btn = document.createElement('button');
    document.body.appendChild(btn);

    const handler = () => {};
    modal.addListener(btn, 'click', handler);

    // Check if added
    expect(addEventSpy).toHaveBeenCalled();
    // We can't easily match exact arguments on the spy because addEventListener might be called by internal setup too
    // But we can check if removeEventListener is called with our handler

    modal.destroy();

    // Check if removed
    expect(removeEventSpy).toHaveBeenCalledWith('click', handler, undefined);
  });

  it('destroys automatically on hide if configured', () => {
    vi.useFakeTimers();
    const modal = createModal({ id: 'test-modal', destroyOnHide: true });

    modal.hide();

    // Advance timers (setTimeout is 300ms)
    vi.advanceTimersByTime(300);

    expect(document.getElementById('test-modal')).toBeNull();
    vi.useRealTimers();
  });

  it('calls onDestroy callback', () => {
    const onDestroy = vi.fn();
    const modal = createModal({ onDestroy });

    modal.destroy();
    expect(onDestroy).toHaveBeenCalled();
  });
});
