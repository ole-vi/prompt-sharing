/**
 * Web Capture Page Initialization
 * Handles extension download functionality
 */

import { TIMEOUTS } from '../utils/constants.js';
import { initPage } from '../modules/page-init.js';

function initApp() {
  // Download extension button
  const downloadBtn = document.getElementById('downloadExtensionBtn');
  if (downloadBtn && !downloadBtn.dataset.bound) {
    downloadBtn.dataset.bound = 'true';
    downloadBtn.addEventListener('click', async () => {
      try {
        downloadBtn.disabled = true;
        const originalDownloadLabel = downloadBtn.innerHTML;
        downloadBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">hourglass_top</span> Preparing download...';

        // Download pre-built zip file
        const a = document.createElement('a');
        a.href = '../../browser-extension/pr-webcapture.zip';
        a.download = 'promptroot-web-capture-extension.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        downloadBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">check_circle</span> Downloaded!';
        setTimeout(() => {
          downloadBtn.innerHTML = originalDownloadLabel;
          downloadBtn.disabled = false;
        }, TIMEOUTS.actionFeedback);
      } catch (error) {
        console.error('Download failed:', error);
        downloadBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">error</span> Download failed';
        setTimeout(() => {
          downloadBtn.innerHTML = originalDownloadLabel;
          downloadBtn.disabled = false;
        }, TIMEOUTS.actionFeedback);
      }
    });
  }
}

initPage(initApp);
