import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initDropdown } from '../../modules/dropdown.js';

describe('dropdown', () => {
  let mockBtn, mockMenu, mockContainer;
  let dropdown;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    
    // Create mock dropdown structure
    mockContainer = document.createElement('div');
    mockContainer.className = 'dropdown-container';
    
    mockBtn = document.createElement('button');
    mockBtn.className = 'dropdown-btn';
    mockBtn.setAttribute('aria-expanded', 'false');
    mockContainer.appendChild(mockBtn);
    
    mockMenu = document.createElement('div');
    mockMenu.className = 'dropdown-menu';
    mockContainer.appendChild(mockMenu);
    
    document.body.appendChild(mockContainer);
    
    // Reset any global state - clear any existing dropdowns
    // We need to trigger a closeAllDropdowns by simulating document click
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initDropdown', () => {
    it('should initialize dropdown with button and menu', () => {
      dropdown = initDropdown(mockBtn, mockMenu);
      
      expect(dropdown).toHaveProperty('open');
      expect(dropdown).toHaveProperty('close');
      expect(dropdown).toHaveProperty('toggle');
      expect(typeof dropdown.open).toBe('function');
      expect(typeof dropdown.close).toBe('function');
      expect(typeof dropdown.toggle).toBe('function');
    });

    it('should use provided container when given', () => {
      const customContainer = document.createElement('div');
      customContainer.className = 'custom-container';
      document.body.appendChild(customContainer);
      
      dropdown = initDropdown(mockBtn, mockMenu, customContainer);
      
      expect(dropdown).not.toBeNull();
    });

    it('should use menu parent node as container when no container provided', () => {
      dropdown = initDropdown(mockBtn, mockMenu);
      
      expect(dropdown).not.toBeNull();
    });

    it('should return null when button is missing', () => {
      dropdown = initDropdown(null, mockMenu);
      
      expect(dropdown).toBeNull();
    });

    it('should return null when menu is missing', () => {
      dropdown = initDropdown(mockBtn, null);
      
      expect(dropdown).toBeNull();
    });

    it('should add click event listener to button', () => {
      dropdown = initDropdown(mockBtn, mockMenu);
      
      // Mock stopPropagation to verify it's called
      const mockEvent = new MouseEvent('click', { bubbles: true });
      const stopPropagationSpy = vi.spyOn(mockEvent, 'stopPropagation');
      
      mockBtn.dispatchEvent(mockEvent);
      
      expect(stopPropagationSpy).toHaveBeenCalled();
      expect(mockMenu.classList.contains('open')).toBe(true);
      expect(mockBtn.getAttribute('aria-expanded')).toBe('true');
    });
  });

  describe('dropdown operations', () => {
    beforeEach(() => {
      dropdown = initDropdown(mockBtn, mockMenu, mockContainer);
    });

    describe('open', () => {
      it('should open dropdown menu', () => {
        dropdown.open();
        
        expect(mockMenu.classList.contains('open')).toBe(true);
        expect(mockBtn.getAttribute('aria-expanded')).toBe('true');
        expect(mockMenu.style.display).toBe('');
      });

      it('should close other open dropdowns when opening', () => {
        // Create second dropdown
        const mockBtn2 = document.createElement('button');
        const mockMenu2 = document.createElement('div');
        const mockContainer2 = document.createElement('div');
        mockContainer2.appendChild(mockBtn2);
        mockContainer2.appendChild(mockMenu2);
        document.body.appendChild(mockContainer2);
        
        const dropdown2 = initDropdown(mockBtn2, mockMenu2, mockContainer2);
        
        // Open first dropdown
        dropdown.open();
        expect(mockMenu.classList.contains('open')).toBe(true);
        
        // Open second dropdown
        dropdown2.open();
        expect(mockMenu2.classList.contains('open')).toBe(true);
        expect(mockMenu.classList.contains('open')).toBe(false); // First should be closed
        expect(mockBtn.getAttribute('aria-expanded')).toBe('false');
      });
    });

    describe('close', () => {
      it('should close dropdown menu', () => {
        // Open first
        dropdown.open();
        expect(mockMenu.classList.contains('open')).toBe(true);
        
        dropdown.close();
        
        expect(mockMenu.classList.contains('open')).toBe(false);
        expect(mockBtn.getAttribute('aria-expanded')).toBe('false');
      });

      it('should do nothing if dropdown is already closed', () => {
        expect(mockMenu.classList.contains('open')).toBe(false);
        
        dropdown.close();
        
        expect(mockMenu.classList.contains('open')).toBe(false);
        expect(mockBtn.getAttribute('aria-expanded')).toBe('false');
      });
    });

    describe('toggle', () => {
      it('should open closed dropdown', () => {
        expect(mockMenu.classList.contains('open')).toBe(false);
        
        dropdown.toggle();
        
        expect(mockMenu.classList.contains('open')).toBe(true);
        expect(mockBtn.getAttribute('aria-expanded')).toBe('true');
      });

      it('should close open dropdown', () => {
        dropdown.open();
        expect(mockMenu.classList.contains('open')).toBe(true);
        
        dropdown.toggle();
        
        expect(mockMenu.classList.contains('open')).toBe(false);
        expect(mockBtn.getAttribute('aria-expanded')).toBe('false');
      });
    });
  });

  describe('button click handling', () => {
    beforeEach(() => {
      dropdown = initDropdown(mockBtn, mockMenu, mockContainer);
    });

    it('should toggle dropdown when button is clicked', () => {
      expect(mockMenu.classList.contains('open')).toBe(false);
      
      mockBtn.click();
      
      expect(mockMenu.classList.contains('open')).toBe(true);
      expect(mockBtn.getAttribute('aria-expanded')).toBe('true');
    });

    it('should close dropdown when button is clicked again', () => {
      mockBtn.click(); // Open
      expect(mockMenu.classList.contains('open')).toBe(true);
      
      mockBtn.click(); // Close
      
      expect(mockMenu.classList.contains('open')).toBe(false);
      expect(mockBtn.getAttribute('aria-expanded')).toBe('false');
    });

    it('should prevent event propagation on button click', () => {
      const clickEvent = new MouseEvent('click', { bubbles: true });
      const stopPropagationSpy = vi.spyOn(clickEvent, 'stopPropagation');
      
      mockBtn.dispatchEvent(clickEvent);
      
      expect(stopPropagationSpy).toHaveBeenCalled();
    });
  });

  describe('document click handling', () => {
    beforeEach(() => {
      dropdown = initDropdown(mockBtn, mockMenu, mockContainer);
    });

    it('should close dropdown when clicking outside container', () => {
      dropdown.open();
      expect(mockMenu.classList.contains('open')).toBe(true);
      
      // Create element outside dropdown
      const outsideElement = document.createElement('div');
      document.body.appendChild(outsideElement);
      
      // Simulate click outside
      outsideElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      
      expect(mockMenu.classList.contains('open')).toBe(false);
      expect(mockBtn.getAttribute('aria-expanded')).toBe('false');
    });

    it('should not close dropdown when clicking inside container', () => {
      dropdown.open();
      expect(mockMenu.classList.contains('open')).toBe(true);
      
      // Click inside menu
      mockMenu.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      
      expect(mockMenu.classList.contains('open')).toBe(true);
      expect(mockBtn.getAttribute('aria-expanded')).toBe('true');
    });

    it('should not close dropdown when clicking the button', () => {
      dropdown.open();
      expect(mockMenu.classList.contains('open')).toBe(true);
      
      // Manually dispatch click event (not using .click() which would trigger our handler)
      const clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: mockBtn });
      document.dispatchEvent(clickEvent);
      
      expect(mockMenu.classList.contains('open')).toBe(true);
    });

    it('should handle clicks on child elements of button', () => {
      // Add icon to button
      const icon = document.createElement('i');
      icon.className = 'icon';
      mockBtn.appendChild(icon);
      
      dropdown.open();
      expect(mockMenu.classList.contains('open')).toBe(true);
      
      // Click on icon (child of button)
      const clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: icon });
      document.dispatchEvent(clickEvent);
      
      expect(mockMenu.classList.contains('open')).toBe(true);
    });

    it('should close multiple open dropdowns when clicking outside', () => {
      // Create second dropdown
      const mockBtn2 = document.createElement('button');
      const mockMenu2 = document.createElement('div');
      const mockContainer2 = document.createElement('div');
      mockContainer2.appendChild(mockBtn2);
      mockContainer2.appendChild(mockMenu2);
      document.body.appendChild(mockContainer2);
      
      const dropdown2 = initDropdown(mockBtn2, mockMenu2, mockContainer2);
      
      // Open both dropdowns properly (second one will close first due to closeAllDropdowns)
      dropdown.open();
      dropdown2.open(); // This should close the first one
      expect(mockMenu.classList.contains('open')).toBe(false); // First closed
      expect(mockMenu2.classList.contains('open')).toBe(true); // Second open
      
      // Click outside should close the remaining open dropdown
      const outsideElement = document.createElement('div');
      document.body.appendChild(outsideElement);
      outsideElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      
      expect(mockMenu.classList.contains('open')).toBe(false);
      expect(mockMenu2.classList.contains('open')).toBe(false);
    });
  });

  describe('keyboard handling', () => {
    beforeEach(() => {
      dropdown = initDropdown(mockBtn, mockMenu, mockContainer);
    });

    it('should close dropdown when Escape key is pressed', () => {
      dropdown.open();
      expect(mockMenu.classList.contains('open')).toBe(true);
      
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      
      expect(mockMenu.classList.contains('open')).toBe(false);
      expect(mockBtn.getAttribute('aria-expanded')).toBe('false');
    });

    it('should not affect dropdown when other keys are pressed', () => {
      dropdown.open();
      expect(mockMenu.classList.contains('open')).toBe(true);
      
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      
      expect(mockMenu.classList.contains('open')).toBe(true);
      expect(mockBtn.getAttribute('aria-expanded')).toBe('true');
    });

    it('should close multiple dropdowns with Escape key', () => {
      // Create second dropdown
      const mockBtn2 = document.createElement('button');
      const mockMenu2 = document.createElement('div');
      initDropdown(mockBtn2, mockMenu2);
      
      // Open first dropdown
      dropdown.open();
      expect(mockMenu.classList.contains('open')).toBe(true);
      
      // Escape should close all dropdowns
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      
      expect(mockMenu.classList.contains('open')).toBe(false);
      expect(mockMenu2.classList.contains('open')).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete user interaction flow', () => {
      dropdown = initDropdown(mockBtn, mockMenu, mockContainer);
      
      // Initial state
      expect(mockMenu.classList.contains('open')).toBe(false);
      expect(mockBtn.getAttribute('aria-expanded')).toBe('false');
      
      // User clicks button to open
      mockBtn.click();
      expect(mockMenu.classList.contains('open')).toBe(true);
      expect(mockBtn.getAttribute('aria-expanded')).toBe('true');
      
      // User presses Escape to close
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(mockMenu.classList.contains('open')).toBe(false);
      expect(mockBtn.getAttribute('aria-expanded')).toBe('false');
      
      // User opens again
      dropdown.open();
      expect(mockMenu.classList.contains('open')).toBe(true);
      
      // User clicks outside to close
      const outsideElement = document.createElement('div');
      document.body.appendChild(outsideElement);
      outsideElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(mockMenu.classList.contains('open')).toBe(false);
    });

    it('should maintain accessibility attributes correctly', () => {
      dropdown = initDropdown(mockBtn, mockMenu, mockContainer);
      
      // Initially closed
      expect(mockBtn.getAttribute('aria-expanded')).toBe('false');
      
      // After opening
      dropdown.open();
      expect(mockBtn.getAttribute('aria-expanded')).toBe('true');
      
      // After closing
      dropdown.close();
      expect(mockBtn.getAttribute('aria-expanded')).toBe('false');
      
      // After toggling open
      dropdown.toggle();
      expect(mockBtn.getAttribute('aria-expanded')).toBe('true');
      
      // After toggling closed
      dropdown.toggle();
      expect(mockBtn.getAttribute('aria-expanded')).toBe('false');
    });
  });
});