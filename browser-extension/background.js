// ===== Background Service Worker =====
// Handles OAuth callback messages from the callback page

// Import scripts for service worker
importScripts('config.js', 'github-auth.js');

// Listen for messages from within the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'oauthCallback') {
    // Handle OAuth callback
    handleOAuthCallback(request.code, request.state)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true; // Keep channel open for async response
  }
});

// Listen for messages from external sources (like our oauth-callback.html page)
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  if (request.action === 'oauthCallback') {
    // Handle OAuth callback from external page
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
      // Notify any open popup windows
      chrome.runtime.sendMessage({ 
        action: 'authSuccess', 
        user: result.user 
      });
    }
    
    return result;
  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    return { success: false, error: error.message };
  }
}
