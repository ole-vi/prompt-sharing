/**
 * Web Capture Page Initialization
 * Handles extension download functionality
 */

import { createIcon } from '../utils/dom-helpers.js';

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
      const originalChildren = Array.from(downloadBtn.childNodes).map(n => n.cloneNode(true));

      try {
        downloadBtn.disabled = true;
        downloadBtn.replaceChildren(
            createIcon('hourglass_top', 'icon icon-inline'),
            document.createTextNode(' Preparing download...')
        );

        // Download pre-built zip file
        const a = document.createElement('a');
        a.href = '../../browser-extension/pr-webcapture.zip';
        a.download = 'promptroot-web-capture-extension.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        downloadBtn.replaceChildren(
            createIcon('check_circle', 'icon icon-inline'),
            document.createTextNode(' Downloaded!')
        );

        setTimeout(() => {
          downloadBtn.replaceChildren(...originalChildren);
          downloadBtn.disabled = false;
        }, 2000);
      } catch (error) {
        console.error('Download failed:', error);
        downloadBtn.replaceChildren(
            createIcon('error', 'icon icon-inline'),
            document.createTextNode(' Download failed')
        );
        setTimeout(() => {
          downloadBtn.replaceChildren(...originalChildren);
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
