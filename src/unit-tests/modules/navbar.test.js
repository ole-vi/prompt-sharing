import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadNavbar } from '../../modules/navbar.js';

describe('navbar', () => {
  let originalFetch;
  let mockHeader;

  beforeEach(() => {
    // Clear DOM
    document.body.innerHTML = '';
    
    // Create mock header element
    mockHeader = document.createElement('header');
    document.body.appendChild(mockHeader);
    
    // Mock fetch
    originalFetch = global.fetch;
    global.fetch = vi.fn();
    
    // Mock console.error
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('loadNavbar', () => {
    it('should fetch navbar.html and insert after header', async () => {
      const mockNavbarHtml = `
        <nav id="navbar">
          <a href="/" class="nav-item" data-page="home">Home</a>
          <a href="/queue" class="nav-item" data-page="queue">Queue</a>
        </nav>
      `;
      
      global.fetch.mockResolvedValue({
        text: vi.fn().mockResolvedValue(mockNavbarHtml)
      });

      await loadNavbar();

      expect(global.fetch).toHaveBeenCalledWith('./navbar.html');
      
      // Should insert navbar after header
      const navbar = document.querySelector('#navbar');
      expect(navbar).toBeTruthy();
      expect(navbar.previousElementSibling).toBe(mockHeader);
    });

    it('should set active class on specified page', async () => {
      const mockNavbarHtml = `
        <nav id="navbar">
          <a href="/" class="nav-item" data-page="home">Home</a>
          <a href="/queue" class="nav-item" data-page="queue">Queue</a>
          <a href="/jules" class="nav-item" data-page="jules">Jules</a>
        </nav>
      `;
      
      global.fetch.mockResolvedValue({
        text: vi.fn().mockResolvedValue(mockNavbarHtml)
      });

      await loadNavbar('queue');

      const homeItem = document.querySelector('[data-page="home"]');
      const queueItem = document.querySelector('[data-page="queue"]');
      const julesItem = document.querySelector('[data-page="jules"]');

      expect(homeItem.classList.contains('active')).toBe(false);
      expect(queueItem.classList.contains('active')).toBe(true);
      expect(julesItem.classList.contains('active')).toBe(false);
    });

    it('should handle multiple nav items with same data-page', async () => {
      const mockNavbarHtml = `
        <nav id="navbar">
          <a href="/home1" class="nav-item" data-page="home">Home 1</a>
          <a href="/home2" class="nav-item" data-page="home">Home 2</a>
          <a href="/queue" class="nav-item" data-page="queue">Queue</a>
        </nav>
      `;
      
      global.fetch.mockResolvedValue({
        text: vi.fn().mockResolvedValue(mockNavbarHtml)
      });

      await loadNavbar('home');

      // Should only set active on first matching element
      const homeItems = document.querySelectorAll('[data-page="home"]');
      expect(homeItems[0].classList.contains('active')).toBe(true);
      expect(homeItems[1].classList.contains('active')).toBe(false);
    });

    it('should work without activePage parameter', async () => {
      const mockNavbarHtml = `
        <nav id="navbar">
          <a href="/" class="nav-item" data-page="home">Home</a>
        </nav>
      `;
      
      global.fetch.mockResolvedValue({
        text: vi.fn().mockResolvedValue(mockNavbarHtml)
      });

      await loadNavbar();

      const homeItem = document.querySelector('[data-page="home"]');
      expect(homeItem.classList.contains('active')).toBe(false);
      expect(global.fetch).toHaveBeenCalledWith('./navbar.html');
    });

    it('should handle activePage that does not exist in navbar', async () => {
      const mockNavbarHtml = `
        <nav id="navbar">
          <a href="/" class="nav-item" data-page="home">Home</a>
        </nav>
      `;
      
      global.fetch.mockResolvedValue({
        text: vi.fn().mockResolvedValue(mockNavbarHtml)
      });

      await loadNavbar('nonexistent');

      const homeItem = document.querySelector('[data-page="home"]');
      expect(homeItem.classList.contains('active')).toBe(false);
      
      // Should not throw error
      expect(console.error).not.toHaveBeenCalled();
    });

    it('should handle case when header element is not found', async () => {
      // Remove header from DOM
      document.body.removeChild(mockHeader);
      
      const mockNavbarHtml = '<nav id="navbar">Content</nav>';
      global.fetch.mockResolvedValue({
        text: vi.fn().mockResolvedValue(mockNavbarHtml)
      });

      await loadNavbar('home');

      // Should not insert navbar if no header found
      const navbar = document.querySelector('#navbar');
      expect(navbar).toBeNull();
      
      // Should still fetch the HTML though
      expect(global.fetch).toHaveBeenCalledWith('./navbar.html');
    });

    it('should handle fetch errors gracefully', async () => {
      const fetchError = new Error('Network error');
      global.fetch.mockRejectedValue(fetchError);

      await loadNavbar('home');

      expect(console.error).toHaveBeenCalledWith('Failed to load navbar:', fetchError);
      
      // Should not insert any navbar content
      const navbar = document.querySelector('#navbar');
      expect(navbar).toBeNull();
    });

    it('should handle response.text() errors gracefully', async () => {
      const textError = new Error('Text parsing error');
      global.fetch.mockResolvedValue({
        text: vi.fn().mockRejectedValue(textError)
      });

      await loadNavbar('home');

      expect(console.error).toHaveBeenCalledWith('Failed to load navbar:', textError);
      
      // Should not insert any navbar content
      const navbar = document.querySelector('#navbar');
      expect(navbar).toBeNull();
    });

    it('should work with complex navbar HTML structure', async () => {
      const mockNavbarHtml = `
        <nav id="navbar" class="main-nav">
          <div class="nav-container">
            <a href="/" class="nav-item" data-page="home">
              <span class="nav-icon">🏠</span>
              <span class="nav-label">Home</span>
            </a>
            <button class="nav-item" data-page="settings">
              <span class="nav-icon">⚙️</span>
              <span class="nav-label">Settings</span>
            </button>
          </div>
        </nav>
      `;
      
      global.fetch.mockResolvedValue({
        text: vi.fn().mockResolvedValue(mockNavbarHtml)
      });

      await loadNavbar('settings');

      const navbar = document.querySelector('#navbar');
      expect(navbar).toBeTruthy();
      expect(navbar.classList.contains('main-nav')).toBe(true);
      
      const homeItem = document.querySelector('[data-page="home"]');
      const settingsItem = document.querySelector('[data-page="settings"]');
      
      expect(homeItem.classList.contains('active')).toBe(false);
      expect(settingsItem.classList.contains('active')).toBe(true);
      expect(settingsItem.tagName).toBe('BUTTON');
    });

    it('should handle empty navbar HTML', async () => {
      global.fetch.mockResolvedValue({
        text: vi.fn().mockResolvedValue('')
      });

      await loadNavbar('home');

      // Should not throw error with empty HTML
      expect(console.error).not.toHaveBeenCalled();
      
      // Header should still exist
      expect(document.querySelector('header')).toBe(mockHeader);
    });

    it('should handle malformed HTML gracefully', async () => {
      const malformedHtml = '<nav><div><span>Unclosed tags';
      global.fetch.mockResolvedValue({
        text: vi.fn().mockResolvedValue(malformedHtml)
      });

      await loadNavbar();

      // Browser should handle malformed HTML gracefully
      expect(console.error).not.toHaveBeenCalled();
      
      // Some content should be inserted
      const insertedContent = mockHeader.nextElementSibling;
      expect(insertedContent).toBeTruthy();
    });
  });
});