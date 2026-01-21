import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { showConfirm } from '../../modules/confirm-modal.js';
import * as ModalManager from '../../utils/modal-manager.js';

// Mock modal manager
vi.mock('../../utils/modal-manager.js', () => ({
  createModal: vi.fn()
}));

// Mock dom helpers - simple implementation
vi.mock('../../utils/dom-helpers.js', () => ({
  createElement: (tag, className, text) => {
      const el = document.createElement(tag);
      if (className) el.className = className;
      if (text) el.textContent = text;
      return el;
  }
}));

// Mock constants
vi.mock('../../utils/constants.js', () => ({
  TIMEOUTS: { modalFocus: 10 }
}));

describe('confirm-modal real implementation', () => {
    let mockModalInstance;
    let createModalSpy;

    beforeEach(() => {
        vi.clearAllMocks();

        mockModalInstance = {
            element: document.createElement('div'),
            addListener: vi.fn(),
            show: vi.fn(),
            hide: vi.fn(),
            destroy: vi.fn(),
            options: {}
        };

        createModalSpy = vi.mocked(ModalManager.createModal).mockImplementation((options) => {
            mockModalInstance.options = options;
            return mockModalInstance;
        });

        // Setup DOM
        document.body.innerHTML = '';
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('creates a modal with correct options', () => {
        showConfirm('Test message');

        expect(createModalSpy).toHaveBeenCalled();
        const options = createModalSpy.mock.calls[0][0];
        expect(options.className).toBe('modal');
        expect(options.destroyOnHide).toBe(true);
        expect(options.content).toBeDefined();
        expect(options.content.textContent).toContain('Test message');

        expect(mockModalInstance.show).toHaveBeenCalled();
    });

    it('resolves true when confirm button clicked', async () => {
        const promise = showConfirm('Test');

        const calls = mockModalInstance.addListener.mock.calls;
        const confirmCall = calls.find(call =>
            call[0].tagName === 'BUTTON' && call[0].textContent === 'Confirm' && call[1] === 'click'
        );
        expect(confirmCall).toBeDefined();

        const handler = confirmCall[2];
        handler(); // trigger click

        const result = await promise;
        expect(result).toBe(true);
        expect(mockModalInstance.hide).toHaveBeenCalled();
    });

    it('resolves false when cancel button clicked', async () => {
        const promise = showConfirm('Test');
        const calls = mockModalInstance.addListener.mock.calls;
        const cancelCall = calls.find(call =>
            call[0].tagName === 'BUTTON' && call[0].textContent === 'Cancel' && call[1] === 'click'
        );
        expect(cancelCall).toBeDefined();

        const handler = cancelCall[2];
        handler();

        const result = await promise;
        expect(result).toBe(false);
        expect(mockModalInstance.hide).toHaveBeenCalled();
    });

    it('resolves false when hidden externally (via onHide)', async () => {
        const promise = showConfirm('Test');

        // Trigger onHide
        if (mockModalInstance.options.onHide) {
            mockModalInstance.options.onHide();
        }

        const result = await promise;
        expect(result).toBe(false);
    });
});
