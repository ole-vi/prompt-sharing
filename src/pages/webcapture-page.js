/**
 * Web Capture Page Initialization
 * Handles extension download functionality
 */

import { createElement, clearElement } from '../utils/dom-helpers.js';

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
        const originalDownloadNodes = Array.from(downloadBtn.childNodes).map(n => n.cloneNode(true));

        clearElement(downloadBtn);
        downloadBtn.appendChild(createElement('span', { className: 'icon icon-inline', 'aria-hidden': 'true' }, 'hourglass_top'));
        downloadBtn.appendChild(document.createTextNode(' Preparing download...'));

        // Download pre-built zip file
        const a = document.createElement('a');
        a.href = '../../browser-extension/pr-webcapture.zip';
        a.download = 'promptroot-web-capture-extension.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        clearElement(downloadBtn);
        downloadBtn.appendChild(createElement('span', { className: 'icon icon-inline', 'aria-hidden': 'true' }, 'check_circle'));
        downloadBtn.appendChild(document.createTextNode(' Downloaded!'));

        setTimeout(() => {
          clearElement(downloadBtn);
          originalDownloadNodes.forEach(n => downloadBtn.appendChild(n.cloneNode(true)));
          downloadBtn.disabled = false;
        }, 2000);
      } catch (error) {
        console.error('Download failed:', error);
        clearElement(downloadBtn);
        downloadBtn.appendChild(createElement('span', { className: 'icon icon-inline', 'aria-hidden': 'true' }, 'error'));
        downloadBtn.appendChild(document.createTextNode(' Download failed'));

        setTimeout(() => {
          clearElement(downloadBtn);
          originalDownloadNodes.forEach(n => downloadBtn.appendChild(n.cloneNode(true)));
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
