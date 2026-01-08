/**
 * Web Capture Page Initialization
 * Handles extension download functionality
 */

function waitForComponents() {
  if (document.querySelector('header')) {
    initApp();
  } else {
    setTimeout(waitForComponents, 50);
  }
}

function initApp() {
  // Download extension button
  const downloadBtn = document.getElementById('downloadExtensionBtn');
  if (downloadBtn && !downloadBtn.dataset.bound) {
    downloadBtn.dataset.bound = 'true';
    downloadBtn.addEventListener('click', async () => {
      try {
        downloadBtn.disabled = true;
        downloadBtn.textContent = '⏳ Preparing download...';

        // Import JSZip dynamically (ESM via CDN)
        const JSZip = (await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm')).default;
        const zip = new JSZip();

        // Extension files to include
        const files = [
          '../../browser-extension/manifest.json',
          '../../browser-extension/background.js',
          '../../browser-extension/config.js',
          '../../browser-extension/content.js',
          '../../browser-extension/github-auth.js',
          '../../browser-extension/github-sync.js',
          '../../browser-extension/popup.html',
          '../../browser-extension/popup.css',
          '../../browser-extension/popup.js',
          '../../browser-extension/README.md'
        ];

        // Fetch and add each file to zip
        for (const filePath of files) {
          try {
            const response = await fetch(filePath);
            if (response.ok) {
              const content = await response.text();
              const fileName = filePath.replace('/browser-extension/', '');
              zip.file(fileName, content);
            }
          } catch (error) {
            console.error(`Failed to fetch ${filePath}:`, error);
          }
        }

        // Generate zip file
        const blob = await zip.generateAsync({ type: 'blob' });

        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'promptroot-web-capture-extension.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        downloadBtn.textContent = '✅ Downloaded!';
        setTimeout(() => {
          downloadBtn.textContent = '⬇️ Download Extension';
          downloadBtn.disabled = false;
        }, 2000);
      } catch (error) {
        console.error('Download failed:', error);
        downloadBtn.textContent = '❌ Download failed';
        setTimeout(() => {
          downloadBtn.textContent = '⬇️ Download Extension';
          downloadBtn.disabled = false;
        }, 2000);
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForComponents);
} else {
  waitForComponents();
}
