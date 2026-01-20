import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleError, ErrorCategory, ErrorType } from '../../utils/error-handler.js';
import * as toastModule from '../../modules/toast.js';
import statusBar from '../../modules/status-bar.js';

// Mock dependencies
vi.mock('../../modules/toast.js', () => ({
  showToast: vi.fn()
}));

vi.mock('../../modules/status-bar.js', () => ({
  default: {
    showMessage: vi.fn()
  }
}));

describe('error-handler', () => {
  let consoleSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('categorizes network errors correctly', () => {
    const error = new Error('Failed to fetch data');
    const result = handleError(error, 'TestContext');

    expect(result.category).toBe(ErrorCategory.NETWORK);
    expect(result.type).toBe(ErrorType.NETWORK);
    expect(result.suggestion).toContain('check your internet connection');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('categorizes auth errors correctly', () => {
    const error = new Error('User not logged in or token expired');
    const result = handleError(error, 'TestContext');

    expect(result.category).toBe(ErrorCategory.AUTH);
    expect(result.type).toBe(ErrorType.AUTH);
  });

  it('uses options to override category and display behavior', () => {
    const error = new Error('Something happened');
    const result = handleError(error, 'TestContext', {
      category: ErrorCategory.VALIDATION,
      showToast: true
    });

    expect(result.category).toBe(ErrorCategory.VALIDATION);
    expect(toastModule.showToast).toHaveBeenCalledWith(error.message, 'warn');
  });

  it('uses status bar for ASYNC_PROCESS', () => {
    const error = new Error('Background task failed');
    handleError(error, 'TestContext', { category: ErrorCategory.ASYNC_PROCESS });

    expect(statusBar.showMessage).toHaveBeenCalled();
    expect(toastModule.showToast).not.toHaveBeenCalled();
  });

  it('defaults to toast for UNEXPECTED', () => {
    const error = new Error('Random crash');
    handleError(error, 'TestContext');

    expect(toastModule.showToast).toHaveBeenCalledWith('Random crash', 'error');
    expect(statusBar.showMessage).not.toHaveBeenCalled();
  });

  it('suppresses toast if showToast is false', () => {
    const error = new Error('Silent error');
    handleError(error, 'TestContext', { showToast: false });

    expect(toastModule.showToast).not.toHaveBeenCalled();
  });
});
