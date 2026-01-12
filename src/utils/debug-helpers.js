// ===== Debug Helper Functions =====
// These are exposed globally for easy testing in console

import { logRateLimit } from './github-rate-limit.js';

/**
 * Check current GitHub API rate limit status
 * Usage in console: checkRateLimit()
 */
window.checkRateLimit = async function() {
  await logRateLimit();
};

/**
 * Check if OAuth token is stored
 * Usage in console: checkToken()
 */
window.checkToken = function() {
  const tokenData = localStorage.getItem('github_access_token');
  
  if (!tokenData) {
    console.log('❌ No GitHub OAuth token stored');
    console.log('💡 Sign in with GitHub to get authenticated API access (5,000/hr)');
    return;
  }
  
  try {
    const data = JSON.parse(tokenData);
    const ageMs = Date.now() - data.timestamp;
    const ageMinutes = Math.floor(ageMs / 1000 / 60);
    const ageHours = Math.floor(ageMinutes / 60);
    const ageDays = Math.floor(ageHours / 24);
    
    console.log('✅ GitHub OAuth token is stored');
    console.log(`   Token preview: ${data.token.substring(0, 10)}...`);
    console.log(`   Stored: ${ageDays} days, ${ageHours % 24} hours, ${ageMinutes % 60} minutes ago`);
    console.log(`   This gives you 5,000 API requests/hour`);
    
    // Check if token is getting old
    const SIXTY_DAYS = 60 * 24 * 60 * 60 * 1000;
    if (ageMs > SIXTY_DAYS) {
      console.warn('⚠️ Token is over 60 days old - consider re-authenticating');
    }
  } catch (e) {
    console.error('❌ Error parsing token data:', e);
  }
};

/**
 * Clear stored OAuth token (for testing)
 * Usage in console: clearToken()
 */
window.clearToken = function() {
  localStorage.removeItem('github_access_token');
  console.log('🗑️ GitHub OAuth token cleared');
  console.log('💡 Sign in again to get a new token');
};

/**
 * Show all debug commands
 * Usage in console: debugHelp()
 */
window.debugHelp = function() {
  console.log('\n=== GitHub API Debug Commands ===');
  console.log('📊 checkRateLimit() - Check current API rate limit status');
  console.log('🔑 checkToken()     - Check if OAuth token is stored');
  console.log('🗑️  clearToken()     - Clear stored OAuth token');
  console.log('❓ debugHelp()      - Show this help message');
  console.log('=================================\n');
};

// Log available commands on page load
console.log('💡 GitHub API debug commands available! Type debugHelp() to see them.');
