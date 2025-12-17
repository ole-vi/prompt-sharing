const GitHubAuth = (function() {
  const STORAGE_KEY = 'github_access_token';
  const USER_STORAGE_KEY = 'github_user';

  function generateState() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return 'extension-' + Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Check if user is authenticated
   */
  async function isAuthenticated() {
    const token = await getAccessToken();
    return !!token;
  }

  async function getAccessToken() {
    try {
      const result = await chrome.storage.sync.get([STORAGE_KEY]);
      return result[STORAGE_KEY] || null;
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  }

  async function getUserInfo() {
    try {
      const result = await chrome.storage.sync.get([USER_STORAGE_KEY]);
      return result[USER_STORAGE_KEY] || null;
    } catch (error) {
      console.error('Error getting user info:', error);
      return null;
    }
  }

  async function storeToken(token) {
    try {
      await chrome.storage.sync.set({ [STORAGE_KEY]: token });
      return true;
    } catch (error) {
      console.error('Error storing token:', error);
      return false;
    }
  }

  async function storeUserInfo(userInfo) {
    try {
      await chrome.storage.sync.set({ [USER_STORAGE_KEY]: userInfo });
      return true;
    } catch (error) {
      console.error('Error storing user info:', error);
      return false;
    }
  }

  async function startOAuthFlow() {
    const extensionId = chrome.runtime.id;
    const state = generateState() + '-' + extensionId;
    
    await chrome.storage.local.set({ oauth_state: state });

    const authUrl = new URL('https://github.com/login/oauth/authorize');
    authUrl.searchParams.set('client_id', CONFIG.github.clientId);
    authUrl.searchParams.set('redirect_uri', CONFIG.github.redirectUri);
    authUrl.searchParams.set('scope', CONFIG.github.scopes.join(' '));
    authUrl.searchParams.set('state', state);

    chrome.tabs.create({ url: authUrl.toString() });
  }

  async function exchangeCodeForToken(code, state) {
    try {
      const storedState = await chrome.storage.local.get(['oauth_state']);
      if (!storedState.oauth_state || storedState.oauth_state !== state) {
        throw new Error('State mismatch - possible CSRF attack');
      }

      const url = CONFIG.firebase.functionsUrl + CONFIG.firebase.endpoints.oauthExchange;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let error;
        try {
          error = JSON.parse(errorText);
        } catch (e) {
          error = { error: errorText || 'Failed to exchange code for token' };
        }
        throw new Error(error.error || 'Failed to exchange code for token');
      }

      const data = await response.json();

      if (!data.access_token) {
        throw new Error('No access token received');
      }

      await storeToken(data.access_token);

      const userInfo = await fetchUserInfo(data.access_token);
      if (userInfo) {
        await storeUserInfo(userInfo);
      }

      await chrome.storage.local.remove(['oauth_state']);

      return { success: true, user: userInfo };
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      return { success: false, error: error.message };
    }
  }

  async function fetchUserInfo(token) {
    try {
      const response = await fetch(
        CONFIG.firebase.functionsUrl + CONFIG.firebase.endpoints.getGitHubUser,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch user info');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching user info:', error);
      return null;
    }
  }

  async function logout() {
    try {
      await chrome.storage.sync.remove([STORAGE_KEY, USER_STORAGE_KEY]);
      await chrome.storage.local.remove(['oauth_state']);
      return true;
    } catch (error) {
      console.error('Error logging out:', error);
      return false;
    }
  }

  async function handleOAuthCallback(code, state) {
    return await exchangeCodeForToken(code, state);
  }

  return {
    isAuthenticated,
    getAccessToken,
    getUserInfo,
    startOAuthFlow,
    handleOAuthCallback,
    logout
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GitHubAuth;
}
