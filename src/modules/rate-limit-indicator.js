// ===== GitHub Rate Limit Status UI Component =====
import { checkRateLimit } from '../utils/github-rate-limit.js';

/**
 * Add a rate limit indicator to the status bar or header
 * Shows: "API: 4,985/5,000" with color coding
 */
export class RateLimitIndicator {
  constructor() {
    this.element = null;
    this.updateInterval = null;
  }

  /**
   * Create and inject the rate limit indicator
   * @param {string} containerId - ID of container element
   */
  async init(containerId = 'statusBar') {
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn('Rate limit indicator container not found');
      return;
    }

    // Create indicator element
    this.element = document.createElement('div');
    this.element.className = 'rate-limit-indicator';
    this.element.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      font-size: 12px;
      border-radius: 4px;
      cursor: help;
      transition: all 0.2s;
    `;

    container.appendChild(this.element);

    // Initial update
    await this.update();

    // Update every 5 minutes
    this.updateInterval = setInterval(() => this.update(), 5 * 60 * 1000);
  }

  /**
   * Update the rate limit display
   */
  async update() {
    if (!this.element) return;

    const info = await checkRateLimit();
    if (!info) {
      this.element.style.display = 'none';
      return;
    }

    // Determine color based on usage
    let color, bgColor, icon;
    const percentUsed = parseFloat(info.percentUsed);

    if (percentUsed < 50) {
      color = '#51cf66';
      bgColor = 'rgba(81, 207, 102, 0.1)';
      icon = '✓';
    } else if (percentUsed < 80) {
      color = '#ffd43b';
      bgColor = 'rgba(255, 212, 59, 0.1)';
      icon = '⚠';
    } else {
      color = '#ff6b6b';
      bgColor = 'rgba(255, 107, 107, 0.1)';
      icon = '!';
    }

    this.element.style.color = color;
    this.element.style.backgroundColor = bgColor;
    this.element.style.display = 'inline-flex';

    const timeUntilReset = Math.round((info.reset - new Date()) / 1000 / 60);
    
    this.element.innerHTML = `
      <span style="font-weight: 600;">${icon}</span>
      <span>API: ${info.remaining.toLocaleString()}/${info.limit.toLocaleString()}</span>
    `;
    
    this.element.title = [
      `GitHub API Rate Limit`,
      `Remaining: ${info.remaining.toLocaleString()} requests`,
      `Limit: ${info.limit.toLocaleString()} requests/hour`,
      `Used: ${info.percentUsed}%`,
      `Resets in: ${timeUntilReset} minutes`,
      info.authenticated ? '✓ Authenticated (5000/hr)' : '⚠ Unauthenticated (60/hr)'
    ].join('\n');
  }

  /**
   * Clean up
   */
  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
  }
}

/**
 * Simple function to add rate limit indicator to page
 * Usage: await addRateLimitIndicator('statusBar');
 */
export async function addRateLimitIndicator(containerId = 'statusBar') {
  const indicator = new RateLimitIndicator();
  await indicator.init(containerId);
  return indicator;
}
