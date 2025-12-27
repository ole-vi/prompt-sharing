// functions/controllers/authController.js
const functions = require("firebase-functions");
const fetch = require("node-fetch");
const { GITHUB_OAUTH_TOKEN_URL, GITHUB_USER_API_URL } = require("../constants");

exports.githubOAuthExchange = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(400).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  try {
    const { code, state } = req.body;

    if (!code) {
      res.status(400).json({ error: 'Missing authorization code' });
      return;
    }

    if (!state || !state.startsWith('extension-')) {
      res.status(400).json({ error: 'Invalid state parameter' });
      return;
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('GitHub OAuth credentials not configured');
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }

    const tokenResponse = await fetch(GITHUB_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code
      })
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('GitHub OAuth error:', tokenData.error_description);
      res.status(400).json({
        error: tokenData.error_description || 'Failed to exchange code for token'
      });
      return;
    }

    if (!tokenData.access_token) {
      res.status(500).json({ error: 'No access token received from GitHub' });
      return;
    }

    res.json({
      access_token: tokenData.access_token,
      scope: tokenData.scope,
      token_type: tokenData.token_type
    });

  } catch (error) {
    console.error('Error in githubOAuthExchange:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

exports.getGitHubUser = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'GET') {
    res.status(400).json({ error: 'Method not allowed. Use GET.' });
    return;
  }

  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    const token = authHeader.substring('Bearer '.length);

    const userResponse = await fetch(GITHUB_USER_API_URL, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'PromptSync-WebClipper'
      }
    });

    if (!userResponse.ok) {
      res.status(userResponse.status).json({ error: 'Failed to fetch user info from GitHub' });
      return;
    }

    const userData = await userResponse.json();

    res.json({
      login: userData.login,
      name: userData.name,
      avatar_url: userData.avatar_url,
      email: userData.email
    });

  } catch (error) {
    console.error('Error in getGitHubUser:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
