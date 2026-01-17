/**
 * OAuth Callback Page Handler
 * Processes GitHub OAuth callbacks for both web app and browser extension
 */

import { createElement, clearElement } from '../utils/dom-helpers.js';

(async function() {
  const statusDiv = document.getElementById('status');
  
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');
    const errorDescription = params.get('error_description');

    if (error) {
      showError(`GitHub OAuth Error: ${errorDescription || error}`);
      return;
    }

    if (!code || !state) {
      showError('Missing authorization code or state parameter');
      return;
    }

    if (state.startsWith('extension-')) {
      const parts = state.split('-');
      const extensionId = parts[parts.length - 1];
      try {
        chrome.runtime.sendMessage(
          extensionId,
          {
            action: 'oauthCallback',
            code: code,
            state: state
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('Chrome runtime error:', chrome.runtime.lastError);
              showError('Failed to communicate with extension');
              return;
            }

            if (response && response.success) {
              showSuccess('Successfully connected to GitHub!');
              setTimeout(() => window.close(), 2000);
            } else {
              showError(response?.error || 'Failed to complete authentication');
            }
          }
        );
      } catch (err) {
        console.error('Extension message error:', err);
        showError(`Error communicating with extension: ${err.message}`);
      }
    } else {
      console.log('Web app OAuth callback, Firebase Auth will handle this');
    }

  } catch (error) {
    console.error('OAuth callback error:', error);
    showError(`Error: ${error.message}`);
  }

  function showError(message) {
    const messageEl = document.querySelector('.message');
    const spinner = document.querySelector('.spinner');
    spinner.style.display = 'none';
    messageEl.style.display = 'none';
    clearElement(statusDiv);
    statusDiv.appendChild(createElement('div', { className: 'error' }, message));
  }

  function showSuccess(message) {
    const messageEl = document.querySelector('.message');
    const spinner = document.querySelector('.spinner');
    spinner.style.display = 'none';
    messageEl.style.display = 'none';
    clearElement(statusDiv);
    statusDiv.appendChild(createElement('div', { className: 'success' }, message));
  }
})();
