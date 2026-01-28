import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Referrer Policy', () => {
  let hookCallback;
  let sanitizeHtml;

  beforeEach(async () => {
    hookCallback = null;
    vi.resetModules();

    // Mock window and DOMPurify
    vi.stubGlobal('window', {
      DOMPurify: {
        addHook: vi.fn((hookName, callback) => {
          if (hookName === 'afterSanitizeAttributes') {
            hookCallback = callback;
          }
        }),
        sanitize: vi.fn((html) => html),
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    // Mock dependencies to avoid side effects and deep dependency tree issues
    vi.mock('../modules/github-api.js', () => ({}));
    vi.mock('../modules/prompt-list.js', () => ({}));
    vi.mock('../modules/toast.js', () => ({}));
    vi.mock('../modules/copen.js', () => ({}));
    vi.mock('../modules/status-bar.js', () => ({ statusBar: {} }));
    vi.mock('../modules/split-button.js', () => ({ initSplitButton: vi.fn(), destroySplitButton: vi.fn() }));

    // Dynamic import to ensure clean state for domPurifyHooksInitialized
    const module = await import('../modules/prompt-renderer.js');
    sanitizeHtml = module.sanitizeHtml;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('should register afterSanitizeAttributes hook', () => {
    sanitizeHtml('<p>test</p>');
    expect(window.DOMPurify.addHook).toHaveBeenCalledWith('afterSanitizeAttributes', expect.any(Function));
    expect(hookCallback).toBeTypeOf('function');
  });

  it('should add referrerpolicy="no-referrer" to img tags', () => {
    sanitizeHtml('<p>init</p>');

    const mockImgNode = {
      tagName: 'IMG',
      setAttribute: vi.fn(),
      getAttribute: vi.fn(),
    };

    hookCallback(mockImgNode);

    expect(mockImgNode.setAttribute).toHaveBeenCalledWith('referrerpolicy', 'no-referrer');
  });

  it('should not add referrerpolicy to non-img tags', () => {
    sanitizeHtml('<p>init</p>');

    const mockDivNode = {
      tagName: 'DIV',
      setAttribute: vi.fn(),
      getAttribute: vi.fn(),
    };

    hookCallback(mockDivNode);

    expect(mockDivNode.setAttribute).not.toHaveBeenCalledWith('referrerpolicy', expect.any(String));
  });

  it('should maintain existing hook logic for anchor tags', () => {
    sanitizeHtml('<p>init</p>');

    // Test target="_blank" logic
    const mockAnchorNode = {
      tagName: 'A',
      setAttribute: vi.fn(),
      getAttribute: vi.fn().mockReturnValue(null),
    };

    hookCallback(mockAnchorNode);
    expect(mockAnchorNode.setAttribute).toHaveBeenCalledWith('target', '_blank');

    // Test rel="noopener noreferrer" logic
    const mockAnchorBlank = {
      tagName: 'A',
      setAttribute: vi.fn(),
      getAttribute: vi.fn((attr) => attr === 'target' ? '_blank' : null),
    };

    hookCallback(mockAnchorBlank);
    expect(mockAnchorBlank.setAttribute).toHaveBeenCalledWith('rel', 'noopener noreferrer');
  });
});
