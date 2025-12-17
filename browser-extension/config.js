const CONFIG = {
  github: {
    clientId: 'Ov23li7TLYK9S9yuNWMP',
    redirectUri: 'https://prompt-sharing-f8eeb.firebaseapp.com/oauth-callback.html',
    scopes: ['repo'],
    targetRepo: {
      owner: 'ole-vi',
      repo: 'prompt-sharing',
      branch: 'main',
      path: 'webclips'
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
