const GitHubSync = (function() {
  
  async function getSyncStatus() {
    const isAuth = await GitHubAuth.isAuthenticated();
    if (!isAuth) {
      return { connected: false };
    }

    const user = await GitHubAuth.getUserInfo();
    return {
      connected: true,
      username: user?.login || 'Unknown',
      repo: `${CONFIG.github.targetRepo.owner}/${CONFIG.github.targetRepo.repo}`,
      branch: CONFIG.github.targetRepo.branch,
      path: CONFIG.github.targetRepo.path
    };
  }

  async function syncWebClip(title, url, markdown, filename) {
    try {
      const token = await GitHubAuth.getAccessToken();
      if (!token) {
        throw new Error('Not authenticated. Please connect to GitHub first.');
      }

      const user = await GitHubAuth.getUserInfo();
      if (!user || !user.login) {
        throw new Error('Could not get user information');
      }

      const finalFilename = filename || generateFilename(title);
      const filePath = `${CONFIG.github.targetRepo.path}/${user.login}/${finalFilename}`;

      const result = await commitMarkdownFile(token, filePath, markdown);
      
      return {
        success: true,
        message: `Synced to ${filePath}`,
        url: result.url,
        path: filePath
      };
    } catch (error) {
      console.error('Error syncing to GitHub:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  function generateFilename(title) {
    const date = new Date().toISOString().split('T')[0];
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
    
    return `${date}-${slug}.md`;
  }

  async function commitMarkdownFile(token, path, content) {
    const repo = CONFIG.github.targetRepo;
    
    const base64Content = btoa(unescape(encodeURIComponent(content)));
    const apiUrl = `https://api.github.com/repos/${repo.owner}/${repo.repo}/contents/${path}`;

    // Check if file exists to get its SHA
    let sha = null;
    try {
      const getResponse = await fetch(apiUrl + `?ref=${repo.branch}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });
      
      if (getResponse.ok) {
        const fileData = await getResponse.json();
        sha = fileData.sha;
      }
      // 404 means file doesn't exist, which is fine - we'll create it
    } catch (error) {
      // Ignore errors - assume file doesn't exist
      console.log('File check error (will create new file):', error);
    }

    const requestBody = {
      message: sha ? `Update web clip: ${path.split('/').pop()}` : `Add web clip: ${path.split('/').pop()}`,
      content: base64Content,
      branch: repo.branch
    };

    // Only include sha when updating existing file
    if (sha) {
      requestBody.sha = sha;
    }

    const response = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      let error;
      try {
        error = JSON.parse(errorText);
      } catch (e) {
        error = { message: errorText };
      }
      
      if (response.status === 404) {
        throw new Error(`Repository not found or you don't have write access to ${repo.owner}/${repo.repo}`);
      }
      
      throw new Error(error.message || `GitHub API error: ${response.status}`);
    }

    const result = await response.json();
    return {
      url: result.content.html_url,
      sha: result.content.sha
    };
  }

  return {
    getSyncStatus,
    syncWebClip
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GitHubSync;
}
