// ===== Extension Configuration =====

const CONFIG = {
  // GitHub OAuth settings
  github: {
    clientId: 'Ov23li7TLYK9S9yuNWMP',
    redirectUri: 'https://prompt-sharing-f8eeb.firebaseapp.com/oauth-callback.html',
    scopes: ['repo'], // Required for committing files
    
    // Target repository for syncing web clips
    targetRepo: {
      owner: 'ole-vi',
      repo: 'prompt-sharing',
      branch: 'main',
      path: 'webclips' // Files will be stored in webclips/{username}/
    }
  },
  
  // Firebase Functions endpoints
  firebase: {
    projectId: 'prompt-sharing-f8eeb',
    functionsUrl: 'https://us-central1-prompt-sharing-f8eeb.cloudfunctions.net',
    
    endpoints: {
      oauthExchange: '/githubOAuthExchange',
      getGitHubUser: '/getGitHubUser'
    }
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
