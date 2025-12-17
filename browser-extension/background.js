importScripts('config.js', 'github-auth.js');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'oauthCallback') {
    handleOAuthCallback(request.code, request.state)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true; // Keep channel open for async response
  }
});

chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  if (request.action === 'oauthCallback') {
    handleOAuthCallback(request.code, request.state)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true; // Keep channel open for async response
  }
});

async function handleOAuthCallback(code, state) {
  try {
    const result = await GitHubAuth.handleOAuthCallback(code, state);
    
    if (result.success) {
      // Try to notify popup if it's open, but don't fail if it's closed
      chrome.runtime.sendMessage({ 
        action: 'authSuccess', 
        user: result.user 
      }).catch(() => {
        // Popup may be closed, ignore error
      });
    }
    
    return result;
  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    return { success: false, error: error.message };
  }
}
