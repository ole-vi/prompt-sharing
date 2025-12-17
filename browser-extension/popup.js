// ===== Popup Script - UI Logic =====

let currentPageData = null;

// DOM elements
const pageTitleInput = document.getElementById('pageTitle');
const filenameInput = document.getElementById('filename');
const previewDiv = document.getElementById('preview');
const downloadBtn = document.getElementById('downloadBtn');
const syncBtn = document.getElementById('syncBtn');
const statusDiv = document.getElementById('status');

// GitHub elements
const connectGitHubBtn = document.getElementById('connectGitHubBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const githubDisconnected = document.getElementById('githubDisconnected');
const githubConnected = document.getElementById('githubConnected');
const githubUsername = document.getElementById('githubUsername');
const githubAvatar = document.getElementById('githubAvatar');
const repoPath = document.getElementById('repoPath');

/**
 * Initialize popup
 */
async function init() {
  // Update GitHub connection status
  await updateGitHubStatus();
  
  // Extract page content
  extractContent();
  
  // Listen for auth success messages
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'authSuccess') {
      updateGitHubStatus();
      showStatus('✅ Connected to GitHub!', 'success');
    }
  });
}

/**
 * Extract content from current tab
 */
async function extractContent() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.tabs.sendMessage(tab.id, { action: 'extractContent' }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus('Error: Could not connect to page. Try refreshing.', 'error');
        return;
      }
      
      if (response && response.success) {
        currentPageData = response;
        displayPageData(response);
      } else {
        showStatus('Error extracting content: ' + (response?.error || 'Unknown error'), 'error');
      }
    });
  } catch (error) {
    showStatus('Error: ' + error.message, 'error');
  }
}

/**
 * Display extracted page data
 */
function displayPageData(data) {
  pageTitleInput.value = data.title;
  pageTitleInput.disabled = false;
  
  // Generate filename
  const filename = generateFilename(data.title, data.domain);
  filenameInput.value = filename;
  
  // Show preview (first 500 chars)
  const previewText = data.markdown.substring(0, 500) + '...';
  previewDiv.textContent = previewText;
  
  downloadBtn.disabled = false;
  
  // Enable sync button only if connected to GitHub
  GitHubAuth.isAuthenticated().then(isAuth => {
    syncBtn.disabled = !isAuth;
  });
}

/**
 * Generate safe filename
 */
function generateFilename(title, domain) {
  const timestamp = new Date().toISOString().slice(0, 10);
  const safeName = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  
  const domainShort = domain.replace(/^www\./, '').split('.')[0];
  
  return `${timestamp}-${domainShort}-${safeName || 'page'}.md`;
}

/**
 * Download markdown file locally
 */
function downloadMarkdown() {
  if (!currentPageData) {
    showStatus('No content to save', 'error');
    return;
  }
  
  const filename = filenameInput.value.trim();
  if (!filename) {
    showStatus('Please enter a filename', 'error');
    return;
  }
  
  // Ensure .md extension
  const finalFilename = filename.endsWith('.md') ? filename : filename + '.md';
  
  downloadBtn.disabled = true;
  downloadBtn.textContent = '⏳ Downloading...';
  showStatus('Preparing download...', 'info');
  
  try {
    // Create blob with markdown content
    const blob = new Blob([currentPageData.markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const a = document.createElement('a');
    a.href = url;
    a.download = finalFilename;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showStatus('✅ Downloaded successfully!', 'success');
    setTimeout(() => {
      downloadBtn.disabled = false;
      downloadBtn.textContent = '💾 Download';
    }, 1500);
  } catch (error) {
    showStatus('Error: ' + error.message, 'error');
    downloadBtn.disabled = false;
    downloadBtn.textContent = '💾 Download';
  }
}

/**
 * Sync markdown to GitHub
 */
async function syncToGitHub() {
  if (!currentPageData) {
    showStatus('No content to sync', 'error');
    return;
  }
  
  const filename = filenameInput.value.trim();
  if (!filename) {
    showStatus('Please enter a filename', 'error');
    return;
  }
  
  const finalFilename = filename.endsWith('.md') ? filename : filename + '.md';
  
  syncBtn.disabled = true;
  syncBtn.textContent = '⏳ Sending...';
  showStatus('Sending to GitHub...', 'info');
  
  try {
    const result = await GitHubSync.syncWebClip(
      currentPageData.title,
      currentPageData.url,
      currentPageData.markdown,
      finalFilename
    );
    
    if (result.success) {
      showStatus(`✅ ${result.message}`, 'success');
      
      // Show link to view file on GitHub
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = result.url;
        link.textContent = 'View on GitHub';
        link.className = 'link';
        link.target = '_blank';
        link.style.display = 'block';
        link.style.marginTop = '8px';
        statusDiv.appendChild(link);
      }, 100);
    } else {
      showStatus('❌ ' + result.error, 'error');
    }
    
    syncBtn.disabled = false;
    syncBtn.textContent = '☁️ Send to GitHub';
  } catch (error) {
    showStatus('Error: ' + error.message, 'error');
    syncBtn.disabled = false;
    syncBtn.textContent = '☁️ Send to GitHub';
  }
}

/**
 * Update GitHub connection status UI
 */
async function updateGitHubStatus() {
  const status = await GitHubSync.getSyncStatus();
  
  if (status.connected && status.username) {
    githubDisconnected.style.display = 'none';
    githubConnected.style.display = 'block';
    githubUsername.textContent = `@${status.username}`;
    repoPath.textContent = status.repo;
    
    // Enable sync button (will be functional once content loads)
    syncBtn.disabled = false;
  } else {
    githubDisconnected.style.display = 'block';
    githubConnected.style.display = 'none';
    syncBtn.disabled = true;
  }
}

/**
 * Connect to GitHub
 */
async function connectToGitHub() {
  try {
    await GitHubAuth.startOAuthFlow();
    showStatus('Opening GitHub authentication...', 'info');
  } catch (error) {
    showStatus('Error: ' + error.message, 'error');
  }
}

/**
 * Disconnect from GitHub
 */
async function disconnectFromGitHub() {
  const confirmed = confirm('Are you sure you want to disconnect from GitHub?');
  if (!confirmed) return;
  
  const success = await GitHubAuth.logout();
  if (success) {
    await updateGitHubStatus();
    showStatus('Disconnected from GitHub', 'info');
  } else {
    showStatus('Error disconnecting', 'error');
  }
}

/**
 * Show status message
 */
function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';
}

// Event listeners
downloadBtn.addEventListener('click', downloadMarkdown);
syncBtn.addEventListener('click', syncToGitHub);
connectGitHubBtn.addEventListener('click', connectToGitHub);
disconnectBtn.addEventListener('click', disconnectFromGitHub);

// Initialize
init();
