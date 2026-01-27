const CONFIG = {
  github: {
    clientId: 'Ov23liz8g6qMlD1izTFe',
    redirectUri: 'https://promptroot-b02a2.firebaseapp.com/oauth-callback.html',
    scopes: ['repo'],
    targetRepo: {
      owner: 'promptroot',
      repo: 'promptroot',
      branch: 'web-captures',
      path: 'webcaptures'
    }
  },
  
  firebase: {
    projectId: 'promptroot-b02a2',
    functionsUrl: 'https://us-central1-promptroot-b02a2.cloudfunctions.net',
    
    endpoints: {
      oauthExchange: '/githubOAuthExchange',
      getGitHubUser: '/getGitHubUser'
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
