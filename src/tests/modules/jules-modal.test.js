import { describe, it, expect, beforeEach, vi } from 'vitest';

// Setup global mocks
const mockAuth = {
  currentUser: null
};

let mockDb = {
  collection: vi.fn()
};

// Mock firebase-service BEFORE importing jules-modal
// Use function declarations so they evaluate at call-time, not definition-time
vi.mock('../../modules/firebase-service.js', () => ({
  getAuth: vi.fn(function() { return global.window?.auth !== undefined ? global.window.auth : mockAuth; }),
  getDb: vi.fn(function() { return global.window?.db !== undefined ? global.window.db : mockDb; }),
  getFunctions: vi.fn(() => null)
}));

// Mock dependencies
vi.mock('../../modules/jules-keys.js', () => ({
  encryptAndStoreKey: vi.fn()
}));

vi.mock('../../modules/repo-branch-selector.js', () => ({
  RepoSelector: vi.fn(),
  BranchSelector: vi.fn()
}));

vi.mock('../../modules/jules-queue.js', () => ({
  addToJulesQueue: vi.fn()
}));

vi.mock('../../utils/title.js', () => ({
  extractTitleFromPrompt: vi.fn()
}));

vi.mock('../../utils/constants.js', () => ({
  RETRY_CONFIG: { maxRetries: 3 },
  TIMEOUTS: { SHORT: 1000 },
  JULES_MESSAGES: {
    SIGN_IN_REQUIRED: 'Please sign in',
    QUEUED: 'Added to queue',
    QUEUE_FAILED: (msg) => `Failed: ${msg}`
  },
  JULES_API_KEY_CONFIG: {
    MIN_LENGTH: 5,
    MAX_LENGTH: 20,
    PATTERN: /^[A-Za-z0-9_\-]+$/,
    RATE_LIMIT_MS: 1000
  }
}));

vi.mock('../../modules/toast.js', () => ({
  showToast: vi.fn()
}));

// Setup global fetch and document
global.fetch = vi.fn();
global.window = {
  auth: mockAuth,
  db: mockDb
};
global.document = {
  body: {
    appendChild: vi.fn(),
    removeChild: vi.fn(),
    insertAdjacentHTML: vi.fn()
  },
  createElement: vi.fn(() => ({
    href: '',
    target: '',
    rel: '',
    style: {},
    dispatchEvent: vi.fn()
  })),
  getElementById: vi.fn()
};

global.window = {
  auth: null,
  open: vi.fn()
};

global.console = {
  error: vi.fn(),
  log: vi.fn()
};

global.MouseEvent = vi.fn((type, options) => ({ type, ...options }));
global.setTimeout = vi.fn((fn) => {
  fn();
  return 123;
});

const createMockElement = (id = '', options = {}) => {
  const element = {
    id,
    _value: options.value || '',
    textContent: options.textContent || '',
    disabled: options.disabled || false,
    checked: options.checked || false,
    onclick: null,
    classList: {
      add: vi.fn(),
      remove: vi.fn()
    },
    focus: vi.fn()
  };
  
  // Make value a getter that returns _value
  Object.defineProperty(element, 'value', {
    get() { return this._value; },
    set(val) { this._value = val; }
  });
  
  return element;
};

function mockReset() {
  vi.clearAllMocks();
  global.fetch.mockReset();
  global.document.getElementById.mockReturnValue(null);
  global.document.body.insertAdjacentHTML.mockClear();
  global.document.body.appendChild.mockClear();
  global.document.body.removeChild.mockClear();
  global.document.createElement.mockReturnValue({
    href: '',
    target: '',
    rel: '',
    style: {},
    dispatchEvent: vi.fn()
  });
  global.window.auth = null;
}

describe('jules-modal', () => {
  let julesModal;

  beforeEach(async () => {
    mockReset();
    vi.resetModules();
    julesModal = await import('../../modules/jules-modal.js');
  });

  describe('loadSubtaskErrorModal', () => {
    it('should fetch and insert modal HTML', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('<div>Modal HTML</div>')
      });
      
      await julesModal.loadSubtaskErrorModal();
      
      expect(global.fetch).toHaveBeenCalledWith('/partials/subtask-error-modal.html');
      expect(global.document.body.insertAdjacentHTML).toHaveBeenCalledWith('beforeend', '<div>Modal HTML</div>');
    });

    it('should handle fetch errors gracefully', async () => {
      global.fetch.mockResolvedValue({
        ok: false
      });
      
      await julesModal.loadSubtaskErrorModal();
      
      expect(global.document.body.insertAdjacentHTML).not.toHaveBeenCalled();
    });

    it('should handle network errors', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));
      
      await julesModal.loadSubtaskErrorModal();
      
      expect(global.console.error).toHaveBeenCalledWith('Error loading subtask error modal:', expect.any(Error));
    });
  });

  describe('openUrlInBackground', () => {
    it('should call window.open with correct parameters', () => {
      julesModal.openUrlInBackground('https://example.com');
      
      expect(global.window.open).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');
    });

    it('should handle different URLs', () => {
      julesModal.openUrlInBackground('https://test.com/path');
      
      expect(global.window.open).toHaveBeenCalledWith('https://test.com/path', '_blank', 'noopener,noreferrer');
    });
  });

  describe('showJulesKeyModal', () => {
    it('should show modal and focus input', () => {
      const mockModal = createMockElement('julesKeyModal');
      const mockInput = createMockElement('julesKeyInput');
      const mockSaveBtn = createMockElement('julesSaveBtn');
      const mockCancelBtn = createMockElement('julesCancelBtn');
      
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'julesKeyModal') return mockModal;
        if (id === 'julesKeyInput') return mockInput;
        if (id === 'julesSaveBtn') return mockSaveBtn;
        if (id === 'julesCancelBtn') return mockCancelBtn;
        return null;
      });
      
      julesModal.showJulesKeyModal();
      
      expect(mockModal.classList.add).toHaveBeenCalledWith('show');
      expect(mockInput.value).toBe('');
      expect(mockInput.focus).toHaveBeenCalled();
    });

    it('should setup save and cancel button handlers', () => {
      const mockModal = createMockElement('julesKeyModal');
      const mockInput = createMockElement('julesKeyInput');
      const mockSaveBtn = createMockElement('julesSaveBtn');
      const mockCancelBtn = createMockElement('julesCancelBtn');
      
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'julesKeyModal') return mockModal;
        if (id === 'julesKeyInput') return mockInput;
        if (id === 'julesSaveBtn') return mockSaveBtn;
        if (id === 'julesCancelBtn') return mockCancelBtn;
        return null;
      });
      
      julesModal.showJulesKeyModal();
      
      expect(mockSaveBtn.onclick).toBeDefined();
      expect(mockCancelBtn.onclick).toBeDefined();
    });

    it('should show warning if API key is empty', async () => {
      const { showToast } = await import('../../modules/toast.js');
      const mockModal = createMockElement('julesKeyModal');
      const mockInput = createMockElement('julesKeyInput', { value: '  ' });
      const mockSaveBtn = createMockElement('julesSaveBtn');
      const mockCancelBtn = createMockElement('julesCancelBtn');
      
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'julesKeyModal') return mockModal;
        if (id === 'julesKeyInput') return mockInput;
        if (id === 'julesSaveBtn') return mockSaveBtn;
        if (id === 'julesCancelBtn') return mockCancelBtn;
        return null;
      });
      
      julesModal.showJulesKeyModal();
      
      await mockSaveBtn.onclick();
      
      expect(showToast).toHaveBeenCalledWith('Please enter your Jules API key.', 'warn');
    });

    it('should reject invalid API key format (too short)', async () => {
      const { showToast } = await import('../../modules/toast.js');
      const mockModal = createMockElement('julesKeyModal');
      const mockInput = createMockElement('julesKeyInput');
      const mockSaveBtn = createMockElement('julesSaveBtn');
      const mockCancelBtn = createMockElement('julesCancelBtn');

      global.document.getElementById.mockImplementation((id) => {
        if (id === 'julesKeyModal') return mockModal;
        if (id === 'julesKeyInput') return mockInput;
        if (id === 'julesSaveBtn') return mockSaveBtn;
        if (id === 'julesCancelBtn') return mockCancelBtn;
        return null;
      });

      julesModal.showJulesKeyModal();
      mockInput.value = '1234'; // Set value AFTER show (which clears it)

      await mockSaveBtn.onclick();

      expect(showToast).toHaveBeenCalledWith('Key too short (min 5 chars).', 'warn');
    });

    it('should reject invalid API key format (invalid characters)', async () => {
      const { showToast } = await import('../../modules/toast.js');
      const mockModal = createMockElement('julesKeyModal');
      const mockInput = createMockElement('julesKeyInput');
      const mockSaveBtn = createMockElement('julesSaveBtn');
      const mockCancelBtn = createMockElement('julesCancelBtn');

      global.document.getElementById.mockImplementation((id) => {
        if (id === 'julesKeyModal') return mockModal;
        if (id === 'julesKeyInput') return mockInput;
        if (id === 'julesSaveBtn') return mockSaveBtn;
        if (id === 'julesCancelBtn') return mockCancelBtn;
        return null;
      });

      julesModal.showJulesKeyModal();
      mockInput.value = 'abcde$'; // Set value AFTER show

      await mockSaveBtn.onclick();

      expect(showToast).toHaveBeenCalledWith('Invalid key format (alphanumeric, underscores, hyphens only).', 'warn');
    });

    it('should enforce rate limiting on key submission', async () => {
      const { encryptAndStoreKey } = await import('../../modules/jules-keys.js');
      const { showToast } = await import('../../modules/toast.js');
      encryptAndStoreKey.mockResolvedValue();

      global.window.auth = { currentUser: { uid: 'user123' } };

      const mockModal = createMockElement('julesKeyModal');
      const mockInput = createMockElement('julesKeyInput');
      const mockSaveBtn = createMockElement('julesSaveBtn');
      const mockCancelBtn = createMockElement('julesCancelBtn');

      global.document.getElementById.mockImplementation((id) => {
        if (id === 'julesKeyModal') return mockModal;
        if (id === 'julesKeyInput') return mockInput;
        if (id === 'julesSaveBtn') return mockSaveBtn;
        if (id === 'julesCancelBtn') return mockCancelBtn;
        return null;
      });

      julesModal.showJulesKeyModal();

      // First submission
      mockInput.value = 'valid-key-1';
      await mockSaveBtn.onclick();
      expect(encryptAndStoreKey).toHaveBeenCalledTimes(1);

      // Second submission immediately (within 1000ms)
      mockInput.value = 'valid-key-2';
      await mockSaveBtn.onclick();

      expect(encryptAndStoreKey).toHaveBeenCalledTimes(1); // Should not increase
      expect(showToast).toHaveBeenCalledWith('Please wait before submitting again.', 'warn');
    });

    it('should show error if user not logged in', async () => {
      const { showToast } = await import('../../modules/toast.js');
      global.window.auth = { currentUser: null };
      
      const mockModal = createMockElement('julesKeyModal');
      const mockInput = createMockElement('julesKeyInput');
      const mockSaveBtn = createMockElement('julesSaveBtn');
      const mockCancelBtn = createMockElement('julesCancelBtn');
      
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'julesKeyModal') return mockModal;
        if (id === 'julesKeyInput') return mockInput;
        if (id === 'julesSaveBtn') return mockSaveBtn;
        if (id === 'julesCancelBtn') return mockCancelBtn;
        return null;
      });
      
      julesModal.showJulesKeyModal();
      mockInput.value = 'test-key-123';  // Set value after showJulesKeyModal
      
      await mockSaveBtn.onclick();
      
      expect(showToast).toHaveBeenCalledWith('Not logged in.', 'error');
      expect(mockSaveBtn.textContent).toBe('Save & Continue');
      expect(mockSaveBtn.disabled).toBe(false);
    });

    it('should save API key successfully', async () => {
      const { encryptAndStoreKey } = await import('../../modules/jules-keys.js');
      const { showToast } = await import('../../modules/toast.js');
      encryptAndStoreKey.mockResolvedValue();
      
      global.window.auth = { currentUser: { uid: 'user123' } };
      
      const mockModal = createMockElement('julesKeyModal');
      const mockInput = createMockElement('julesKeyInput');
      const mockSaveBtn = createMockElement('julesSaveBtn', { textContent: 'Save & Continue' });
      const mockCancelBtn = createMockElement('julesCancelBtn');
      
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'julesKeyModal') return mockModal;
        if (id === 'julesKeyInput') return mockInput;
        if (id === 'julesSaveBtn') return mockSaveBtn;
        if (id === 'julesCancelBtn') return mockCancelBtn;
        return null;
      });
      
      julesModal.showJulesKeyModal();
      mockInput.value = 'my-api-key';  // Set value after showJulesKeyModal
      
      await mockSaveBtn.onclick();
      
      expect(encryptAndStoreKey).toHaveBeenCalledWith('my-api-key', 'user123');
      expect(showToast).toHaveBeenCalledWith('Jules API key saved successfully', 'success');
      expect(mockModal.classList.remove).toHaveBeenCalledWith('show');
      expect(mockSaveBtn.textContent).toBe('Save & Continue');
      expect(mockSaveBtn.disabled).toBe(false);
    });

    it('should call onSave callback after successful save', async () => {
      const { encryptAndStoreKey } = await import('../../modules/jules-keys.js');
      encryptAndStoreKey.mockResolvedValue();
      
      global.window.auth = { currentUser: { uid: 'user456' } };
      
      const mockModal = createMockElement('julesKeyModal');
      const mockInput = createMockElement('julesKeyInput');
      const mockSaveBtn = createMockElement('julesSaveBtn', { textContent: 'Save & Continue' });
      const mockCancelBtn = createMockElement('julesCancelBtn');
      
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'julesKeyModal') return mockModal;
        if (id === 'julesKeyInput') return mockInput;
        if (id === 'julesSaveBtn') return mockSaveBtn;
        if (id === 'julesCancelBtn') return mockCancelBtn;
        return null;
      });
      
      const onSaveCallback = vi.fn();
      julesModal.showJulesKeyModal(onSaveCallback);
      mockInput.value = 'key-valid-1';  // Set value after showJulesKeyModal
      
      await mockSaveBtn.onclick();
      
      expect(onSaveCallback).toHaveBeenCalled();
      expect(mockSaveBtn.textContent).toBe('Save & Continue');
      expect(mockSaveBtn.disabled).toBe(false);
    });

    it('should handle save errors', async () => {
      const { encryptAndStoreKey } = await import('../../modules/jules-keys.js');
      const { showToast } = await import('../../modules/toast.js');
      encryptAndStoreKey.mockRejectedValue(new Error('Storage failed'));
      
      global.window.auth = { currentUser: { uid: 'user789' } };
      
      const mockModal = createMockElement('julesKeyModal');
      const mockInput = createMockElement('julesKeyInput');
      const mockSaveBtn = createMockElement('julesSaveBtn', { textContent: 'Save & Continue' });
      const mockCancelBtn = createMockElement('julesCancelBtn');
      
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'julesKeyModal') return mockModal;
        if (id === 'julesKeyInput') return mockInput;
        if (id === 'julesSaveBtn') return mockSaveBtn;
        if (id === 'julesCancelBtn') return mockCancelBtn;
        return null;
      });
      
      julesModal.showJulesKeyModal();
      mockInput.value = 'key-valid-2';  // Set value after showJulesKeyModal
      
      await mockSaveBtn.onclick();
      
      expect(showToast).toHaveBeenCalledWith('Failed to save API key: Storage failed', 'error');
      expect(mockSaveBtn.textContent).toBe('Save & Continue');
      expect(mockSaveBtn.disabled).toBe(false);
    });

    it('should hide modal on cancel', () => {
      const mockModal = createMockElement('julesKeyModal');
      const mockInput = createMockElement('julesKeyInput');
      const mockSaveBtn = createMockElement('julesSaveBtn');
      const mockCancelBtn = createMockElement('julesCancelBtn');
      
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'julesKeyModal') return mockModal;
        if (id === 'julesKeyInput') return mockInput;
        if (id === 'julesSaveBtn') return mockSaveBtn;
        if (id === 'julesCancelBtn') return mockCancelBtn;
        return null;
      });
      
      julesModal.showJulesKeyModal();
      
      mockCancelBtn.onclick();
      
      expect(mockModal.classList.remove).toHaveBeenCalledWith('show');
    });
  });

  describe('hideJulesKeyModal', () => {
    it('should remove show class from modal', () => {
      const mockModal = createMockElement('julesKeyModal');
      global.document.getElementById.mockReturnValue(mockModal);
      
      julesModal.hideJulesKeyModal();
      
      expect(mockModal.classList.remove).toHaveBeenCalledWith('show');
    });
  });

  describe('hideJulesEnvModal', () => {
    it('should remove show class from modal', () => {
      const mockModal = createMockElement('julesEnvModal');
      global.document.getElementById.mockReturnValue(mockModal);
      
      julesModal.hideJulesEnvModal();
      
      expect(mockModal.classList.remove).toHaveBeenCalledWith('show');
    });
  });

  describe('hideSubtaskErrorModal', () => {
    it('should remove show class from modal', () => {
      const mockModal = createMockElement('subtaskErrorModal');
      global.document.getElementById.mockReturnValue(mockModal);
      
      julesModal.hideSubtaskErrorModal();
      
      expect(mockModal.classList.remove).toHaveBeenCalledWith('show');
    });
  });
});