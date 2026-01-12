// ===== GitHub API Rate Limit Utilities =====

/**
 * Check the current GitHub API rate limit status
 * @returns {Promise<Object>} Rate limit information
 */
export async function checkRateLimit() {
  try {
    const headers = {};
    
    // Try to get the access token
    const tokenDataStr = localStorage.getItem('github_access_token');
    if (tokenDataStr) {
      try {
        const tokenData = JSON.parse(tokenDataStr);
        headers['Authorization'] = `Bearer ${tokenData.token}`;
      } catch (e) {
        console.error('Failed to parse token:', e);
      }
    }
    
    const response = await fetch('https://api.github.com/rate_limit', {
      headers: {
        'Accept': 'application/vnd.github+json',
        ...headers
      }
    });
    
    if (!response.ok) {
      throw new Error(`Rate limit check failed: ${response.status}`);
    }
    
    const data = await response.json();
    const core = data.resources.core;
    
    return {
      limit: core.limit,
      remaining: core.remaining,
      reset: new Date(core.reset * 1000),
      authenticated: core.limit > 60,
      percentUsed: ((core.limit - core.remaining) / core.limit * 100).toFixed(1)
    };
  } catch (error) {
    console.error('Error checking rate limit:', error);
    return null;
  }
}

/**
 * Display rate limit information in the console
 */
export async function logRateLimit() {
  const info = await checkRateLimit();
  if (info) {
    console.log('\n=== GitHub API Rate Limit Status ===');
    console.log(`🔑 Authenticated: ${info.authenticated ? '✅ Yes (5000/hr)' : '⚠️ No (60/hr)'}`);
    console.log(`📊 Limit: ${info.limit} requests/hour`);
    console.log(`✨ Remaining: ${info.remaining} requests`);
    console.log(`📈 Used: ${info.percentUsed}%`);
    console.log(`⏰ Resets at: ${info.reset.toLocaleString()}`);
    
    // Check for stored token
    const tokenData = localStorage.getItem('github_access_token');
    if (tokenData) {
      const data = JSON.parse(tokenData);
      const ageMinutes = Math.floor((Date.now() - data.timestamp) / 1000 / 60);
      const ageDays = Math.floor(ageMinutes / 60 / 24);
      console.log(`💾 Token stored: ${ageDays} days ago`);
    } else {
      console.log('💾 Token stored: ❌ No token (sign in to get one)');
    }
    console.log('=====================================\n');
  }
}

/**
 * Show a warning if rate limit is low
 * @param {number} threshold - Percentage threshold (default 80)
 */
export async function warnIfLowRateLimit(threshold = 80) {
  const info = await checkRateLimit();
  if (info && parseFloat(info.percentUsed) > threshold) {
    console.warn(
      `⚠️ GitHub API rate limit ${info.percentUsed}% used (${info.remaining}/${info.limit} remaining). ` +
      `Resets at ${info.reset.toLocaleTimeString()}`
    );
    return true;
  }
  return false;
}
