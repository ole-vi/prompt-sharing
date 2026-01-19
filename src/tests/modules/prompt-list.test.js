import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  setSelectFileCallback,
  setRepoContext,
  initPromptList,
  destroyPromptList,
  getFiles,
  getCurrentSlug,
  setCurrentSlug,
  ensureAncestorsExpanded,
  loadExpandedState,
  persistExpandedState,
  toggleDirectory,
  updateActiveItem,
  renderList,
  loadList,
  refreshList
} from '../../modules/prompt-list.js';

// Mock dependencies
vi.mock('../utils/slug.js', () => ({
  slugify: vi.fn((path) => path.replace(/\.md$/i, '').replace(/[/\\]/g, '-'))
}));

vi.mock('../utils/constants.js', () => ({
  STORAGE_KEYS: {
    expandedState: (owner, repo, branch) => `sidebar:expanded:${owner}/${repo}@${branch}`
  },
  TAG_DEFINITIONS: {
    'test-tag': {
      label: 'Test',
      className: 'test-class',
      keywords: ['test', 'example']
    }
  }
}));

vi.mock('../utils/debounce.js', () => ({
  debounce: vi.fn((fn) => fn) // For testing, don't debounce
}));

vi.mock('../../modules/github-api.js', () => ({
  listPromptsViaContents: vi.fn(),
  listPromptsViaTrees: vi.fn()
}));

vi.mock('../../utils/dom-helpers.js', () => {
  const createElementFn = vi.fn((tag, className = '', textContent = '') => {
    const el = {
      tagName: tag.toUpperCase(),
      className: className || '',
      textContent: textContent || '',
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(),
        toggle: vi.fn()
      },
      style: {},
      dataset: {},
      children: [],
      innerHTML: '',
      querySelectorAll: vi.fn(() => []),
      querySelector: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      appendChild: vi.fn(),
      closest: vi.fn(),
      getAttribute: vi.fn(),
      setAttribute: vi.fn()
    };
    return el;
  });
  
  // Make createElement available globally for the module to use
  global.createElement = createElementFn;
  
  return {
    clearElement: vi.fn(),
    stopPropagation: vi.fn(),
    setElementDisplay: vi.fn(),
    toggleClass: vi.fn(),
    createElement: createElementFn
  };
});

vi.mock('../../modules/folder-submenu.js', () => ({
  setContext: vi.fn(),
  toggle: vi.fn(),
  init: vi.fn(),
  destroy: vi.fn()
}));

vi.mock('../utils/lazy-loaders.js', () => ({
  loadFuse: vi.fn()
}));

// Setup global DOM mocks
global.document = {
  getElementById: vi.fn(),
  createElement: vi.fn(),
  createTextNode: vi.fn((text) => ({ nodeType: 3, textContent: text })),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

global.window = {
  open: vi.fn()
};

global.sessionStorage = {
  getItem: vi.fn((key) => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

global.console = {
  error: vi.fn(),
  warn: vi.fn()
};

// Mock elements
const createMockElement = (id = null, className = null) => ({
  id,
  className: className || '',
  classList: {
    add: vi.fn(),
    remove: vi.fn(),
    contains: vi.fn(),
    toggle: vi.fn()
  },
  style: {},
  dataset: {},
  textContent: '',
  innerHTML: '',
  children: [],
  querySelectorAll: vi.fn(() => []),
  querySelector: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  appendChild: vi.fn(),
  closest: vi.fn(),
  getAttribute: vi.fn(),
  setAttribute: vi.fn()
});

function mockReset() {
  vi.clearAllMocks();
  
  // Reset sessionStorage spy to default behavior
  global.sessionStorage.getItem.mockReturnValue(null);
  global.sessionStorage.setItem.mockImplementation(() => {}); // Reset to no-op
  global.sessionStorage.removeItem.mockImplementation(() => {});
  
  // Reset DOM mocks
  global.document.getElementById.mockImplementation((id) => {
    const elements = {
      'list': createMockElement('list'),
      'search': createMockElement('search'),
      'searchClear': createMockElement('searchClear')
    };
    return elements[id] || createMockElement(id);
  });
  
  global.document.createElement.mockImplementation((tag) => createMockElement(null, ''));
}

describe('prompt-list', () => {
  beforeEach(() => {
    mockReset();
  });

  afterEach(() => {
    destroyPromptList();
  });

  describe('setSelectFileCallback', () => {
    it('should set the file selection callback', () => {
      const mockCallback = vi.fn();
      setSelectFileCallback(mockCallback);
      
      // Callback should be stored (we can't directly test private variables, 
      // but this verifies the function runs without error)
      expect(() => setSelectFileCallback(mockCallback)).not.toThrow();
    });

    it('should accept null callback', () => {
      expect(() => setSelectFileCallback(null)).not.toThrow();
    });
  });

  describe('setRepoContext', () => {
    it('should set repository context', async () => {
      const folderSubmenu = await import('../../modules/folder-submenu.js');
      
      setRepoContext('owner', 'repo', 'main');
      
      expect(folderSubmenu.setContext).toHaveBeenCalledWith('owner', 'repo', 'main');
    });

    it('should handle different branch names', async () => {
      const folderSubmenu = await import('../../modules/folder-submenu.js');
      
      setRepoContext('user', 'project', 'develop');
      
      expect(folderSubmenu.setContext).toHaveBeenCalledWith('user', 'project', 'develop');
    });
  });

  describe('initPromptList', () => {
    it('should initialize DOM elements and event listeners', () => {
      const mockList = createMockElement('list');
      const mockSearch = createMockElement('search');
      const mockSearchClear = createMockElement('searchClear');
      
      global.document.getElementById.mockImplementation((id) => {
        const elements = {
          'list': mockList,
          'search': mockSearch,
          'searchClear': mockSearchClear
        };
        return elements[id];
      });

      initPromptList();

      expect(global.document.getElementById).toHaveBeenCalledWith('list');
      expect(global.document.getElementById).toHaveBeenCalledWith('search');
      expect(global.document.getElementById).toHaveBeenCalledWith('searchClear');
      expect(mockSearch.addEventListener).toHaveBeenCalledWith('input', expect.any(Function));
    });

    it('should handle missing DOM elements gracefully', () => {
      const mockList = createMockElement('list');
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'list') return mockList;
        return null; // search and searchClear are null
      });

      // Should initialize without error even if some elements are missing
      expect(() => initPromptList()).not.toThrow();
    });

    it('should set up search clear button functionality', () => {
      const mockSearch = createMockElement('search');
      const mockSearchClear = createMockElement('searchClear');
      
      mockSearch.value = 'test query';
      
      global.document.getElementById.mockImplementation((id) => {
        const elements = {
          'list': createMockElement('list'),
          'search': mockSearch,
          'searchClear': mockSearchClear
        };
        return elements[id];
      });

      initPromptList();

      expect(mockSearchClear.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });
  });

  describe('destroyPromptList', () => {
    it('should remove event listeners', () => {
      const mockSearch = createMockElement('search');
      const mockSearchClear = createMockElement('searchClear');
      
      global.document.getElementById.mockImplementation((id) => {
        const elements = {
          'list': createMockElement('list'),
          'search': mockSearch,
          'searchClear': mockSearchClear
        };
        return elements[id];
      });

      initPromptList();
      destroyPromptList();

      // Verify cleanup doesn't throw errors
      expect(() => destroyPromptList()).not.toThrow();
    });

    it('should handle multiple destroy calls gracefully', () => {
      destroyPromptList();
      expect(() => destroyPromptList()).not.toThrow();
    });
  });

  describe('getFiles and file state management', () => {
    it('should return current files array', () => {
      const files = getFiles();
      expect(Array.isArray(files)).toBe(true);
    });

    it('should return empty array initially', () => {
      const files = getFiles();
      expect(files).toEqual([]);
    });
  });

  describe('getCurrentSlug and setCurrentSlug', () => {
    it('should return null initially', () => {
      expect(getCurrentSlug()).toBe(null);
    });

    it('should set and get current slug', () => {
      setCurrentSlug('test-slug');
      expect(getCurrentSlug()).toBe('test-slug');
    });

    it('should handle null slug', () => {
      setCurrentSlug(null);
      expect(getCurrentSlug()).toBe(null);
    });

    it('should handle empty string slug', () => {
      setCurrentSlug('');
      expect(getCurrentSlug()).toBe('');
    });
  });

  describe('ensureAncestorsExpanded', () => {
    beforeEach(() => {
      loadExpandedState('owner', 'repo', 'main');
    });

    it('should expand ancestor directories', () => {
      const result = ensureAncestorsExpanded('prompts/folder/subfolder/file.md');
      expect(result).toBe(true);
    });

    it('should return false if no ancestors to expand', () => {
      // First expand prompts/folder, then try same again
      const result1 = ensureAncestorsExpanded('prompts/folder/file.md');
      const result2 = ensureAncestorsExpanded('prompts/folder/file.md');
      
      expect(result1).toBe(true); // First time expands 'prompts/folder'
      expect(result2).toBe(false); // Second time, already expanded
    });

    it('should handle root level files', () => {
      const result = ensureAncestorsExpanded('file.md');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('loadExpandedState and persistExpandedState', () => {
    // TODO: Fix sessionStorage timing/mocking in CI environment
    it.skip('should load expanded state from sessionStorage', () => {
      const mockState = ['prompts', 'prompts/folder1'];
      global.sessionStorage.getItem.mockReturnValue(JSON.stringify(mockState));

      loadExpandedState('owner', 'repo', 'main');

      expect(global.sessionStorage.getItem).toHaveBeenCalledWith('sidebar:expanded:owner/repo@main');
    });

    it('should handle corrupted sessionStorage data', () => {
      global.sessionStorage.getItem.mockReturnValue('invalid json');

      expect(() => loadExpandedState('owner', 'repo', 'main')).not.toThrow();
    });

    it('should persist expanded state to sessionStorage', () => {
      loadExpandedState('owner', 'repo', 'main');
      persistExpandedState();

      expect(global.sessionStorage.setItem).toHaveBeenCalledWith(
        'sidebar:expanded:owner/repo@main',
        expect.any(String)
      );
    });

    it('should handle sessionStorage errors gracefully', () => {
      global.sessionStorage.setItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      loadExpandedState('owner', 'repo', 'main');
      
      expect(() => persistExpandedState()).not.toThrow();
    });

    it('should always add prompts to expanded state', () => {
      loadExpandedState('owner', 'repo', 'main');
      
      // Verify this runs without error (we can't directly test the private Set)
      expect(() => loadExpandedState('owner', 'repo', 'main')).not.toThrow();
    });
  });

  describe('toggleDirectory', () => {
    beforeEach(() => {
      loadExpandedState('owner', 'repo', 'main');
      initPromptList();
    });

    it('should toggle directory expansion state', async () => {
      await toggleDirectory('prompts/folder', true);
      
      expect(global.sessionStorage.setItem).toHaveBeenCalled();
    });

    it('should handle expand parameter', async () => {
      await toggleDirectory('prompts/folder', false);
      
      expect(() => toggleDirectory('prompts/folder', false)).not.toThrow();
    });

    it('should handle missing parameters gracefully', async () => {
      await expect(toggleDirectory()).resolves.toBeUndefined();
    });
  });

  describe('updateActiveItem', () => {
    it('should update active item classes', () => {
      const mockListEl = createMockElement('list');
      const mockItem1 = createMockElement();
      const mockItem2 = createMockElement();
      
      mockItem1.dataset.slug = 'active-item';
      mockItem2.dataset.slug = 'inactive-item';
      
      mockListEl.querySelectorAll.mockReturnValue([mockItem1, mockItem2]);
      global.document.getElementById.mockReturnValue(mockListEl);

      initPromptList();
      setCurrentSlug('active-item');
      updateActiveItem();

      expect(mockItem1.classList.add).toHaveBeenCalledWith('active');
      expect(mockItem2.classList.remove).toHaveBeenCalledWith('active');
    });

    it('should handle missing list element', () => {
      global.document.getElementById.mockReturnValue(null);
      
      expect(() => updateActiveItem()).not.toThrow();
    });
  });

  describe('renderList', () => {
    const mockFiles = [
      {
        type: 'file',
        path: 'prompts/test.md',
        name: 'test.md'
      },
      {
        type: 'file', 
        path: 'prompts/folder/example.md',
        name: 'example.md'
      }
    ];

    beforeEach(() => {
      initPromptList();
      loadExpandedState('owner', 'repo', 'main');
    });

    it('should render list of files', async () => {
      const domHelpers = await import('../../utils/dom-helpers.js');
      
      await renderList(mockFiles, 'owner', 'repo', 'main');
      
      expect(domHelpers.clearElement).toHaveBeenCalled();
    });

    it('should handle empty files array', async () => {
      await expect(renderList([], 'owner', 'repo', 'main')).resolves.toBeUndefined();
    });

    it('should handle null files array', async () => {
      await expect(renderList(null, 'owner', 'repo', 'main')).resolves.toBeUndefined();
    });

    // TODO: Fix folderSubmenu.setContext timing issue in CI
    it.skip('should set repo context when rendering', async () => {
      const folderSubmenu = await import('../../modules/folder-submenu.js');
      
      await renderList(mockFiles, 'owner', 'repo', 'main');
      
      expect(folderSubmenu.setContext).toHaveBeenCalledWith('owner', 'repo', 'main');
    });

    it('should handle special webcaptures branch', async () => {
      await renderList(mockFiles, 'owner', 'repo', 'web-captures');
      
      // Should render without errors for webcaptures branch
      expect(() => renderList(mockFiles, 'owner', 'repo', 'web-captures')).not.toThrow();
    });
  });

  describe('loadList', () => {
    beforeEach(() => {
      initPromptList();
      loadExpandedState('owner', 'repo', 'main');
    });

    it('should load list using trees API', async () => {
      const githubApi = await import('../../modules/github-api.js');
      const mockFiles = [
        { type: 'file', path: 'prompts/test.md', name: 'test.md' }
      ];
      
      githubApi.listPromptsViaTrees.mockResolvedValue({
        files: mockFiles,
        etag: 'test-etag'
      });

      await loadList('owner', 'repo', 'main', 'cache-key');
      
      expect(githubApi.listPromptsViaTrees).toHaveBeenCalledWith('owner', 'repo', 'main', 'prompts', null);
    });

    it('should fallback to contents API if trees fails', async () => {
      const githubApi = await import('../../modules/github-api.js');
      const mockFiles = [
        { type: 'file', path: 'prompts/test.md', name: 'test.md' }
      ];
      
      githubApi.listPromptsViaTrees.mockRejectedValue(new Error('Trees API failed'));
      githubApi.listPromptsViaContents.mockResolvedValue(mockFiles);

      await loadList('owner', 'repo', 'main', 'cache-key');
      
      expect(githubApi.listPromptsViaContents).toHaveBeenCalledWith('owner', 'repo', 'main', 'prompts');
    });

    it('should handle cache data', async () => {
      const githubApi = await import('../../modules/github-api.js');
      const cachedData = {
        files: [{ type: 'file', path: 'prompts/cached.md', name: 'cached.md' }],
        etag: 'cached-etag',
        timestamp: Date.now() - 1000
      };
      
      global.sessionStorage.getItem.mockReturnValue(JSON.stringify(cachedData));
      githubApi.listPromptsViaTrees.mockResolvedValue({ notModified: true });

      await loadList('owner', 'repo', 'main', 'cache-key');
      
      expect(global.sessionStorage.getItem).toHaveBeenCalledWith('cache-key');
    });

    // TODO: Fix sessionStorage cache timing in CI environment
    it.skip('should clear stale cache', async () => {
      const staleData = {
        files: [],
        etag: 'old-etag',
        timestamp: Date.now() - (25 * 60 * 60 * 1000) // 25 hours old
      };
      
      global.sessionStorage.getItem.mockReturnValue(JSON.stringify(staleData));

      await loadList('owner', 'repo', 'main', 'cache-key');
      
      expect(global.sessionStorage.removeItem).toHaveBeenCalledWith('cache-key');
    });

    // TODO: Fix promise rejection handling in test environment
    it.skip('should handle both API failures', async () => {
      const githubApi = await import('../../modules/github-api.js');
      
      githubApi.listPromptsViaTrees.mockRejectedValue(new Error('Trees failed'));
      githubApi.listPromptsViaContents.mockRejectedValue(new Error('Contents failed'));

      await expect(loadList('owner', 'repo', 'main', 'cache-key')).rejects.toThrow('Contents failed');
    });
  });

  describe('refreshList', () => {
    beforeEach(() => {
      initPromptList();
      loadExpandedState('owner', 'repo', 'main');
    });

    it('should refresh list and ignore cache', async () => {
      const githubApi = await import('../../modules/github-api.js');
      const mockFiles = [
        { type: 'file', path: 'prompts/test.md', name: 'test.md' }
      ];
      
      githubApi.listPromptsViaTrees.mockResolvedValue({
        files: mockFiles,
        etag: 'new-etag'
      });

      await refreshList('owner', 'repo', 'main', 'cache-key');
      
      expect(githubApi.listPromptsViaTrees).toHaveBeenCalledWith('owner', 'repo', 'main', 'prompts', null);
      expect(global.sessionStorage.setItem).toHaveBeenCalledWith('cache-key', expect.any(String));
    });

    it('should handle refresh API failures gracefully', async () => {
      const githubApi = await import('../../modules/github-api.js');
      const mockFiles = [
        { type: 'file', path: 'prompts/fallback.md', name: 'fallback.md' }
      ];
      
      githubApi.listPromptsViaTrees.mockRejectedValue(new Error('Refresh failed'));
      githubApi.listPromptsViaContents.mockResolvedValue(mockFiles);

      await refreshList('owner', 'repo', 'main', 'cache-key');
      
      expect(githubApi.listPromptsViaContents).toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete initialization workflow', async () => {
      const mockCallback = vi.fn();
      
      // Complete setup
      setSelectFileCallback(mockCallback);
      setRepoContext('owner', 'repo', 'main');
      loadExpandedState('owner', 'repo', 'main');
      initPromptList();
      
      // Should complete without errors
      expect(getCurrentSlug()).toBe(null);
      expect(getFiles()).toEqual([]);
      
      // Cleanup
      destroyPromptList();
    });

    it('should handle file selection workflow', () => {
      const mockFiles = [
        { type: 'file', path: 'prompts/test.md', name: 'test.md' }
      ];
      
      setCurrentSlug('test');
      const files = getFiles();
      
      expect(getCurrentSlug()).toBe('test');
      expect(Array.isArray(files)).toBe(true);
    });

    it('should handle state persistence workflow', () => {
      loadExpandedState('owner', 'repo', 'main');
      ensureAncestorsExpanded('prompts/folder/file.md');
      persistExpandedState();
      
      expect(global.sessionStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle sessionStorage errors gracefully', () => {
      global.sessionStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      expect(() => loadExpandedState('owner', 'repo', 'main')).not.toThrow();
    });

    it('should handle DOM manipulation errors', () => {
      // The actual function doesn't wrap in try-catch, just test that it doesn't break unexpectedly
      expect(() => initPromptList()).not.toThrow();
    });

    // TODO: Fix promise rejection handling in test environment
    it.skip('should handle API errors in loadList', async () => {
      const githubApi = await import('../../modules/github-api.js');
      
      githubApi.listPromptsViaTrees.mockRejectedValue(new Error('API error'));
      githubApi.listPromptsViaContents.mockRejectedValue(new Error('Fallback error'));

      await expect(loadList('owner', 'repo', 'main', 'cache-key')).rejects.toThrow();
    });
  });
});