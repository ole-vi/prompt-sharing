import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  handleQueueAction,
  addToJulesQueue,
  updateJulesQueueItem,
  deleteFromJulesQueue,
  listJulesQueue,
  showJulesQueueModal,
  hideJulesQueueModal,
  renderQueueListDirectly,
  attachQueueHandlers
} from '../../modules/jules-queue.js';

// Mock dependencies
vi.mock('../../utils/title.js', () => ({
  extractTitleFromPrompt: vi.fn()
}));

vi.mock('../../modules/status-bar.js', () => ({
  default: {
    show: vi.fn(),
    hide: vi.fn(),
    update: vi.fn()
  }
}));

vi.mock('../../utils/session-cache.js', () => ({
  getCache: vi.fn(),
  setCache: vi.fn(),
  clearCache: vi.fn(),
  CACHE_KEYS: {
    QUEUE_ITEMS: 'queue-items'
  }
}));

vi.mock('../../modules/repo-branch-selector.js', () => ({
  RepoSelector: vi.fn(),
  BranchSelector: vi.fn()
}));

vi.mock('../../modules/toast.js', () => ({
  showToast: vi.fn()
}));

vi.mock('../../modules/confirm-modal.js', () => ({
  showConfirm: vi.fn()
}));

vi.mock('../../utils/constants.js', () => ({
  JULES_MESSAGES: {
    SIGN_IN_REQUIRED: 'Please sign in to use Jules features',
    QUEUED: 'Added to Jules queue',
    QUEUE_FAILED: (msg) => `Failed to add to queue: ${msg}`
  },
  TIMEOUTS: {
    SHORT: 1000,
    MEDIUM: 3000,
    LONG: 5000
  }
}));

vi.mock('../../modules/jules-api.js', () => ({
  callRunJulesFunction: vi.fn()
}));

vi.mock('../../modules/jules-modal.js', () => ({
  openUrlInBackground: vi.fn(),
  showSubtaskErrorModal: vi.fn()
}));

// Setup global mocks
global.window = {
  auth: {
    currentUser: null
  },
  db: null,
  firebase: null
};

global.firebase = {
  firestore: {
    FieldValue: {
      serverTimestamp: vi.fn(() => 'TIMESTAMP')
    }
  }
};

global.document = {
  getElementById: vi.fn(),
  createElement: vi.fn(),
  querySelectorAll: vi.fn(() => [])
};

global.console = {
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn()
};

const createMockElement = (id = '') => ({
  id,
  setAttribute: vi.fn(),
  getAttribute: vi.fn(),
  style: {
    display: ''
  },
  onclick: null,
  classList: {
    add: vi.fn(),
    remove: vi.fn(),
    contains: vi.fn()
  },
  dataset: {}
});

function mockReset() {
  vi.clearAllMocks();
  
  // Reset window
  global.window.auth = {
    currentUser: null
  };
  global.window.db = null;
  
  // Reset document.getElementById
  global.document.getElementById.mockReturnValue(null);
}

describe('jules-queue', () => {
  beforeEach(() => {
    mockReset();
  });

  describe('handleQueueAction', () => {
    it('should show warning if user not signed in', async () => {
      const { showToast } = await import('../../modules/toast.js');
      global.window.auth.currentUser = null;
      
      const result = await handleQueueAction({ prompt: 'test' });
      
      expect(result).toBe(false);
      expect(showToast).toHaveBeenCalledWith('Please sign in to use Jules features', 'warn');
    });

    it('should add item to queue if user signed in', async () => {
      const { showToast } = await import('../../modules/toast.js');
      global.window.auth.currentUser = { uid: 'user123' };
      global.window.db = {
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            collection: vi.fn(() => ({
              add: vi.fn().mockResolvedValue({ id: 'doc123' })
            }))
          }))
        }))
      };
      
      const result = await handleQueueAction({ prompt: 'test prompt' });
      
      expect(result).toBe(true);
      expect(showToast).toHaveBeenCalledWith('Added to Jules queue', 'success');
    });

    it('should show error toast on failure', async () => {
      const { showToast } = await import('../../modules/toast.js');
      global.window.auth.currentUser = { uid: 'user123' };
      global.window.db = {
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            collection: vi.fn(() => ({
              add: vi.fn().mockRejectedValue(new Error('Network error'))
            }))
          }))
        }))
      };
      
      const result = await handleQueueAction({ prompt: 'test' });
      
      expect(result).toBe(false);
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining('Failed to add to queue'),
        'error'
      );
    });

    it('should handle missing auth object', async () => {
      const { showToast } = await import('../../modules/toast.js');
      global.window.auth = null;
      
      const result = await handleQueueAction({ prompt: 'test' });
      
      expect(result).toBe(false);
      expect(showToast).toHaveBeenCalledWith('Please sign in to use Jules features', 'warn');
    });
  });

  describe('addToJulesQueue', () => {
    it('should throw error if Firestore not initialized', async () => {
      global.window.db = null;
      
      await expect(addToJulesQueue('user123', {})).rejects.toThrow('Firestore not initialized');
    });

    it('should add item to queue collection', async () => {
      const mockAdd = vi.fn().mockResolvedValue({ id: 'newDoc123' });
      global.window.db = {
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            collection: vi.fn(() => ({
              add: mockAdd
            }))
          }))
        }))
      };
      
      const docId = await addToJulesQueue('user123', { prompt: 'test', sourceId: 'repo1' });
      
      expect(docId).toBe('newDoc123');
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'test',
          sourceId: 'repo1',
          autoOpen: true,
          status: 'pending'
        })
      );
    });

    it('should set autoOpen to false if explicitly specified', async () => {
      const mockAdd = vi.fn().mockResolvedValue({ id: 'doc456' });
      global.window.db = {
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            collection: vi.fn(() => ({
              add: mockAdd
            }))
          }))
        }))
      };
      
      await addToJulesQueue('user123', { prompt: 'test', autoOpen: false });
      
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          autoOpen: false
        })
      );
    });

    it('should add server timestamp', async () => {
      const mockAdd = vi.fn().mockResolvedValue({ id: 'doc789' });
      global.window.db = {
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            collection: vi.fn(() => ({
              add: mockAdd
            }))
          }))
        }))
      };
      
      await addToJulesQueue('user123', { prompt: 'test' });
      
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          createdAt: 'TIMESTAMP'
        })
      );
    });

    it('should clear cache after adding', async () => {
      const { clearCache, CACHE_KEYS } = await import('../../utils/session-cache.js');
      global.window.db = {
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            collection: vi.fn(() => ({
              add: vi.fn().mockResolvedValue({ id: 'doc999' })
            }))
          }))
        }))
      };
      
      await addToJulesQueue('user456', { prompt: 'test' });
      
      expect(clearCache).toHaveBeenCalledWith(CACHE_KEYS.QUEUE_ITEMS, 'user456');
    });

    it('should handle Firestore errors', async () => {
      global.window.db = {
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            collection: vi.fn(() => ({
              add: vi.fn().mockRejectedValue(new Error('Permission denied'))
            }))
          }))
        }))
      };
      
      await expect(addToJulesQueue('user123', { prompt: 'test' })).rejects.toThrow();
      expect(global.console.error).toHaveBeenCalled();
    });
  });

  describe('updateJulesQueueItem', () => {
    it('should throw error if Firestore not initialized', async () => {
      global.window.db = null;
      
      await expect(updateJulesQueueItem('user123', 'doc1', {})).rejects.toThrow('Firestore not initialized');
    });

    it('should update queue item', async () => {
      const mockUpdate = vi.fn().mockResolvedValue();
      global.window.db = {
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            collection: vi.fn(() => ({
              doc: vi.fn(() => ({
                update: mockUpdate
              }))
            }))
          }))
        }))
      };
      
      const result = await updateJulesQueueItem('user123', 'doc456', { status: 'completed' });
      
      expect(result).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith({ status: 'completed' });
    });

    it('should clear cache after updating', async () => {
      const { clearCache, CACHE_KEYS } = await import('../../utils/session-cache.js');
      global.window.db = {
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            collection: vi.fn(() => ({
              doc: vi.fn(() => ({
                update: vi.fn().mockResolvedValue()
              }))
            }))
          }))
        }))
      };
      
      await updateJulesQueueItem('user789', 'doc123', { status: 'running' });
      
      expect(clearCache).toHaveBeenCalledWith(CACHE_KEYS.QUEUE_ITEMS, 'user789');
    });

    it('should handle update errors', async () => {
      global.window.db = {
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            collection: vi.fn(() => ({
              doc: vi.fn(() => ({
                update: vi.fn().mockRejectedValue(new Error('Update failed'))
              }))
            }))
          }))
        }))
      };
      
      await expect(updateJulesQueueItem('user123', 'doc1', {})).rejects.toThrow();
      expect(global.console.error).toHaveBeenCalled();
    });
  });

  describe('deleteFromJulesQueue', () => {
    it('should throw error if Firestore not initialized', async () => {
      global.window.db = null;
      
      await expect(deleteFromJulesQueue('user123', 'doc1')).rejects.toThrow('Firestore not initialized');
    });

    it('should delete queue item', async () => {
      const mockDelete = vi.fn().mockResolvedValue();
      global.window.db = {
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            collection: vi.fn(() => ({
              doc: vi.fn(() => ({
                delete: mockDelete
              }))
            }))
          }))
        }))
      };
      
      const result = await deleteFromJulesQueue('user123', 'doc789');
      
      expect(result).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should clear cache after deleting', async () => {
      const { clearCache, CACHE_KEYS } = await import('../../utils/session-cache.js');
      global.window.db = {
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            collection: vi.fn(() => ({
              doc: vi.fn(() => ({
                delete: vi.fn().mockResolvedValue()
              }))
            }))
          }))
        }))
      };
      
      await deleteFromJulesQueue('user999', 'doc555');
      
      expect(clearCache).toHaveBeenCalledWith(CACHE_KEYS.QUEUE_ITEMS, 'user999');
    });

    it('should handle deletion errors', async () => {
      global.window.db = {
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            collection: vi.fn(() => ({
              doc: vi.fn(() => ({
                delete: vi.fn().mockRejectedValue(new Error('Delete failed'))
              }))
            }))
          }))
        }))
      };
      
      await expect(deleteFromJulesQueue('user123', 'doc1')).rejects.toThrow();
      expect(global.console.error).toHaveBeenCalled();
    });
  });

  describe('listJulesQueue', () => {
    it('should throw error if Firestore not initialized', async () => {
      global.window.db = null;
      
      await expect(listJulesQueue('user123')).rejects.toThrow('Firestore not initialized');
    });

    it('should list queue items ordered by createdAt', async () => {
      const mockDocs = [
        { id: 'doc1', data: () => ({ prompt: 'First', createdAt: { seconds: 1000 } }) },
        { id: 'doc2', data: () => ({ prompt: 'Second', createdAt: { seconds: 2000 } }) }
      ];
      
      global.window.db = {
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            collection: vi.fn(() => ({
              orderBy: vi.fn(() => ({
                get: vi.fn().mockResolvedValue({ docs: mockDocs })
              }))
            }))
          }))
        }))
      };
      
      const items = await listJulesQueue('user123');
      
      expect(items).toHaveLength(2);
      expect(items[0]).toEqual({ id: 'doc1', prompt: 'First', createdAt: { seconds: 1000 } });
      expect(items[1]).toEqual({ id: 'doc2', prompt: 'Second', createdAt: { seconds: 2000 } });
    });

    it('should return empty array if no items', async () => {
      global.window.db = {
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            collection: vi.fn(() => ({
              orderBy: vi.fn(() => ({
                get: vi.fn().mockResolvedValue({ docs: [] })
              }))
            }))
          }))
        }))
      };
      
      const items = await listJulesQueue('user123');
      
      expect(items).toEqual([]);
    });

    it('should handle list errors', async () => {
      global.window.db = {
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            collection: vi.fn(() => ({
              orderBy: vi.fn(() => ({
                get: vi.fn().mockRejectedValue(new Error('Permission denied'))
              }))
            }))
          }))
        }))
      };
      
      await expect(listJulesQueue('user123')).rejects.toThrow();
      expect(global.console.error).toHaveBeenCalled();
    });
  });

  describe('showJulesQueueModal', () => {
    it('should log error if modal element not found', () => {
      global.document.getElementById.mockReturnValue(null);
      
      showJulesQueueModal();
      
      expect(global.console.error).toHaveBeenCalledWith('julesQueueModal element not found!');
    });

    it('should display modal with correct styles', () => {
      const mockModal = createMockElement('julesQueueModal');
      global.document.getElementById.mockReturnValue(mockModal);
      
      showJulesQueueModal();
      
      expect(mockModal.setAttribute).toHaveBeenCalledWith(
        'style',
        expect.stringContaining('display: flex')
      );
      expect(mockModal.setAttribute).toHaveBeenCalledWith(
        'style',
        expect.stringContaining('position:fixed')
      );
    });

    it('should setup click handler to close modal', () => {
      const mockModal = createMockElement('julesQueueModal');
      global.document.getElementById.mockReturnValue(mockModal);
      
      showJulesQueueModal();
      
      expect(mockModal.onclick).toBeDefined();
    });

    it('should close modal when clicking outside', () => {
      const mockModal = createMockElement('julesQueueModal');
      global.document.getElementById.mockReturnValue(mockModal);
      
      showJulesQueueModal();
      
      // Simulate click on modal itself (outside content)
      mockModal.onclick({ target: mockModal });
      
      expect(mockModal.setAttribute).toHaveBeenCalledWith(
        'style',
        'display:none !important;'
      );
    });

    it('should not close modal when clicking inside content', () => {
      const mockModal = createMockElement('julesQueueModal');
      const mockContent = createMockElement('content');
      global.document.getElementById.mockReturnValue(mockModal);
      
      showJulesQueueModal();
      
      const setAttributeCalls = mockModal.setAttribute.mock.calls.length;
      
      // Simulate click on content element
      mockModal.onclick({ target: mockContent });
      
      // Should not add new setAttribute call
      expect(mockModal.setAttribute).toHaveBeenCalledTimes(setAttributeCalls);
    });
  });

  describe('hideJulesQueueModal', () => {
    it('should hide modal if found', () => {
      const mockModal = createMockElement('julesQueueModal');
      global.document.getElementById.mockReturnValue(mockModal);
      
      hideJulesQueueModal();
      
      expect(mockModal.setAttribute).toHaveBeenCalledWith('style', 'display:none !important;');
    });

    it('should do nothing if modal not found', () => {
      global.document.getElementById.mockReturnValue(null);
      
      expect(() => hideJulesQueueModal()).not.toThrow();
    });
  });

  describe('renderQueueListDirectly', () => {
    it('should accept items array', () => {
      const items = [
        { id: '1', prompt: 'Test 1' },
        { id: '2', prompt: 'Test 2' }
      ];
      
      expect(() => renderQueueListDirectly(items)).not.toThrow();
    });

    it('should handle empty array', () => {
      expect(() => renderQueueListDirectly([])).not.toThrow();
    });
  });

  describe('attachQueueHandlers', () => {
    it('should execute without errors', () => {
      expect(() => attachQueueHandlers()).not.toThrow();
    });
  });
});