// ===== Popup Script - UI Logic =====

let currentPageData = null;

// DOM elements
const pageTitleInput = document.getElementById('pageTitle');
const filenameInput = document.getElementById('filename');
const previewDiv = document.getElementById('preview');
const saveBtn = document.getElementById('saveBtn');
const statusDiv = document.getElementById('status');

/**
 * Initialize popup
 */
async function init() {
  // Extract page content
  extractContent();
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
  
  saveBtn.disabled = false;
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
  
  saveBtn.disabled = true;
  saveBtn.textContent = '⏳ Downloading...';
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
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Download Markdown';
    }, 1500);
  } catch (error) {
    showStatus('Error: ' + error.message, 'error');
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 Download Markdown';
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
saveBtn.addEventListener('click', downloadMarkdown);

// Initialize
init();
