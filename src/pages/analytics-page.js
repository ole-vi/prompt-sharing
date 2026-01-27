// ===== Analytics Page =====
// Displays Jules session analytics with charts and metrics

import { waitForFirebase } from '../shared-init.js';
import { getAuth } from '../modules/firebase-service.js';
import { calculateAnalytics } from '../modules/analytics.js';
import { syncActiveSessions, importJulesHistory } from '../modules/session-tracking.js';
import { handleError } from '../utils/error-handler.js';
import { TIMEOUTS } from '../utils/constants.js';
import { createElement, createIcon, toggleVisibility } from '../utils/dom-helpers.js';
import { showToast } from '../modules/toast.js';
import { showConfirm } from '../modules/confirm-modal.js';

let currentAnalytics = null;
let statusChartInstance = null;
let timelineChartInstance = null;

function waitForComponents() {
  if (document.querySelector('header')) {
    initApp();
  } else {
    setTimeout(waitForComponents, TIMEOUTS.componentCheck);
  }
}

async function initApp() {
  try {
    await waitForFirebase();

    const auth = getAuth();
    
    auth.onAuthStateChanged(user => {
      if (user) {
        loadAnalytics();
      } else {
        showNotSignedIn();
      }
    });

    // Date range selector
    const dateRangeSelect = document.getElementById('dateRangeSelect');
    if (dateRangeSelect) {
      dateRangeSelect.addEventListener('change', () => {
        loadAnalytics();
      });
    }

    // Refresh button
    const refreshBtn = document.getElementById('refreshAnalyticsBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        refreshBtn.querySelector('.icon').textContent = 'hourglass_empty';
        
        try {
          // Sync active sessions first
          await syncActiveSessions();
          await loadAnalytics();
        } catch (error) {
          handleError(error, { source: 'refreshAnalytics' });
        } finally {
          refreshBtn.disabled = false;
          refreshBtn.querySelector('.icon').textContent = 'refresh';
        }
      });
    }

    // Import history button
    const importBtn = document.getElementById('importHistoryBtn');
    if (importBtn) {
      importBtn.addEventListener('click', async () => {
        const confirmed = await showConfirm(
          'This will import all your Jules sessions from history. This may take a few minutes. Continue?',
          {
            title: 'Import Jules History',
            confirmText: 'Import',
            confirmStyle: 'primary',
            cancelText: 'Cancel'
          }
        );
        
        if (!confirmed) {
          return;
        }

        importBtn.disabled = true;
        importBtn.querySelector('.icon').textContent = 'hourglass_empty';
        const originalText = importBtn.childNodes[2].textContent;
        importBtn.childNodes[2].textContent = ' Importing...';
        
        try {
          const stats = await importJulesHistory();
          showToast(`Import complete: ${stats.imported} imported, ${stats.skipped} skipped, ${stats.errors} errors`, 'success');
          await loadAnalytics();
        } catch (error) {
          handleError(error, { source: 'importHistory' });
          showToast('Failed to import history. Check console for details.', 'error');
        } finally {
          importBtn.disabled = false;
          importBtn.querySelector('.icon').textContent = 'download';
          importBtn.childNodes[2].textContent = originalText;
        }
      });
    }
  } catch (error) {
    handleError(error, { source: 'analyticsInit' });
  }
}

function showNotSignedIn() {
  toggleVisibility(document.getElementById('analyticsLoading'), false);
  toggleVisibility(document.getElementById('analyticsContent'), false);
  toggleVisibility(document.getElementById('analyticsNotSignedIn'), true);
}

async function loadAnalytics() {
  const loadingDiv = document.getElementById('analyticsLoading');
  const contentDiv = document.getElementById('analyticsContent');
  const notSignedInDiv = document.getElementById('analyticsNotSignedIn');

  try {
    toggleVisibility(loadingDiv, true);
    toggleVisibility(contentDiv, false);
    toggleVisibility(notSignedInDiv, false);

    // Get date range
    const dateRange = getSelectedDateRange();
    
    // Calculate analytics
    currentAnalytics = await calculateAnalytics(dateRange.start, dateRange.end);

    // Render all sections
    renderKeyMetrics(currentAnalytics);
    renderStatusChart(currentAnalytics);
    renderTimelineChart(currentAnalytics);
    renderTopPrompts(currentAnalytics);
    renderFailureAnalysis(currentAnalytics);
    renderRepoPerformance(currentAnalytics);
    renderRecentPRs(currentAnalytics);

    toggleVisibility(loadingDiv, false);
    toggleVisibility(contentDiv, true);
  } catch (error) {
    handleError(error, { source: 'loadAnalytics' });
    loadingDiv?.classList.add('hidden');
  }
}

function getSelectedDateRange() {
  const select = document.getElementById('dateRangeSelect');
  const days = parseInt(select?.value || '30');
  
  const end = new Date();
  let start = null;

  if (days !== 'all') {
    start = new Date();
    start.setDate(start.getDate() - days);
  }

  return { start, end };
}

function renderKeyMetrics(analytics) {
  document.getElementById('totalSessionsValue').textContent = analytics.totalSessions;
  
  const successRate = (analytics.successRate * 100).toFixed(1);
  document.getElementById('successRateValue').textContent = `${successRate}%`;
  
  document.getElementById('prsCreatedValue').textContent = analytics.sessionsWithPRs;
  
  const prRate = (analytics.prCreationRate * 100).toFixed(1);
  document.getElementById('prRateValue').textContent = `${prRate}% of sessions`;
  
  document.getElementById('failedSessionsValue').textContent = analytics.failedSessions;
}

async function renderStatusChart(analytics) {
  // Lazy load Chart.js
  if (!window.Chart) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    document.head.appendChild(script);
    
    await new Promise((resolve) => {
      script.onload = resolve;
    });
  }

  const ctx = document.getElementById('statusChart');
  if (!ctx) return;

  // Destroy existing chart
  if (statusChartInstance) {
    statusChartInstance.destroy();
  }

  const data = {
    labels: ['Completed', 'Failed', 'In Progress', 'Other'],
    datasets: [{
      data: [
        analytics.statusDistribution.COMPLETED,
        analytics.statusDistribution.FAILED,
        analytics.statusDistribution.IN_PROGRESS + analytics.statusDistribution.PLANNING,
        analytics.statusDistribution.QUEUED + analytics.statusDistribution.AWAITING_USER_FEEDBACK + analytics.statusDistribution.UNKNOWN
      ],
      backgroundColor: [
        'rgba(40, 167, 69, 0.8)',
        'rgba(220, 53, 69, 0.8)',
        'rgba(255, 193, 7, 0.8)',
        'rgba(108, 117, 125, 0.8)'
      ],
      borderColor: [
        'rgb(40, 167, 69)',
        'rgb(220, 53, 69)',
        'rgb(255, 193, 7)',
        'rgb(108, 117, 125)'
      ],
      borderWidth: 2
    }]
  };

  statusChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom'
        },
        title: {
          display: false
        }
      }
    }
  });
}

async function renderTimelineChart(analytics) {
  if (!window.Chart) return; // Already loaded in renderStatusChart

  const ctx = document.getElementById('timelineChart');
  if (!ctx) return;

  // Destroy existing chart
  if (timelineChartInstance) {
    timelineChartInstance.destroy();
  }

  // Group sessions by day
  const sessionsByDay = {};
  const prsByDay = {};

  analytics.sessionsOverTime.forEach(session => {
    const dateKey = session.date.toISOString().split('T')[0];
    sessionsByDay[dateKey] = (sessionsByDay[dateKey] || 0) + 1;
    if (session.hasPR) {
      prsByDay[dateKey] = (prsByDay[dateKey] || 0) + 1;
    }
  });

  // Sort dates
  const dates = Object.keys(sessionsByDay).sort();
  const sessionCounts = dates.map(d => sessionsByDay[d]);
  const prCounts = dates.map(d => prsByDay[d] || 0);

  const data = {
    labels: dates.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Total Sessions',
        data: sessionCounts,
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        tension: 0.1
      },
      {
        label: 'PRs Created',
        data: prCounts,
        borderColor: 'rgb(40, 167, 69)',
        backgroundColor: 'rgba(40, 167, 69, 0.2)',
        tension: 0.1
      }
    ]
  };

  timelineChartInstance = new Chart(ctx, {
    type: 'line',
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      }
    }
  });
}

function renderTopPrompts(analytics) {
  const container = document.getElementById('topPromptsContainer');
  if (!container) return;

  container.textContent = '';

  const prompts = Object.entries(analytics.promptMetrics)
    .map(([path, metric]) => ({ path, ...metric }))
    .filter(p => p.total > 0)
    .sort((a, b) => {
      if (Math.abs(b.successRate - a.successRate) > 0.01) {
        return b.successRate - a.successRate;
      }
      return b.total - a.total;
    })
    .slice(0, 10);

  if (prompts.length === 0) {
    const emptyMsg = createElement('p', 'muted small-text text-center pad-lg', 'No prompts used yet');
    container.appendChild(emptyMsg);
    return;
  }

  prompts.forEach((prompt, index) => {
    const successRate = (prompt.successRate * 100).toFixed(0);
    const prRate = (prompt.prRate * 100).toFixed(0);
    const displayPath = prompt.path.replace(/^prompts\//, '');
    const badgeClass = prompt.successRate >= 0.8 ? 'success' : prompt.successRate >= 0.5 ? 'warn' : 'danger';
    
    const item = createElement('div', 'item');
    
    const content = createElement('div', 'prompt-item__content');
    
    const rank = createElement('span', 'pill prompt-item__rank', String(index + 1));
    
    const details = createElement('div', 'prompt-item__details');
    const title = createElement('div', 'item-title', displayPath);
    const meta = createElement('div', 'item-meta');
    meta.textContent = `${prompt.total} use${prompt.total !== 1 ? 's' : ''} • ${successRate}% success • ${prRate}% with PRs`;
    
    details.appendChild(title);
    details.appendChild(meta);
    content.appendChild(rank);
    content.appendChild(details);
    
    const badge = createElement('span', `status-badge status-badge--${badgeClass}`, `${successRate}%`);
    
    item.appendChild(content);
    item.appendChild(badge);
    container.appendChild(item);
  });
}

function renderFailureAnalysis(analytics) {
  const container = document.getElementById('failureAnalysisContainer');
  if (!container) return;

  container.textContent = '';

  if (analytics.failedSessions === 0) {
    const emptyMsg = createElement('p', 'muted small-text text-center pad-lg', 'No failures recorded 🎉');
    container.appendChild(emptyMsg);
    return;
  }

  const grid = createElement('div', 'failure-grid');
  
  // Total failures
  const totalItem = createElement('div', 'failure-item');
  const totalLabel = createElement('div', 'failure-item__label', 'Total Failures');
  const totalValue = createElement('div', 'failure-item__value', String(analytics.failedSessions));
  const totalDesc = createElement('div', 'failure-item__desc', 
    `${((analytics.failedSessions / analytics.totalSessions) * 100).toFixed(1)}% of sessions`);
  totalItem.appendChild(totalLabel);
  totalItem.appendChild(totalValue);
  totalItem.appendChild(totalDesc);
  grid.appendChild(totalItem);
  
  // Failure reasons
  Object.entries(analytics.failureReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([reason, count]) => {
      const displayReason = reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const item = createElement('div', 'failure-item');
      const label = createElement('div', 'failure-item__label', displayReason);
      const value = createElement('div', 'failure-item__value', String(count));
      const desc = createElement('div', 'failure-item__desc', 
        `${((count / analytics.failedSessions) * 100).toFixed(0)}% of failures`);
      item.appendChild(label);
      item.appendChild(value);
      item.appendChild(desc);
      grid.appendChild(item);
    });

  container.appendChild(grid);
}

function renderRepoPerformance(analytics) {
  const container = document.getElementById('repoPerformanceContainer');
  if (!container) return;

  container.textContent = '';

  const repos = Object.entries(analytics.repoMetrics)
    .map(([id, metric]) => ({ id, ...metric }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  if (repos.length === 0) {
    const emptyMsg = createElement('p', 'muted small-text text-center pad-lg', 'No repository data');
    container.appendChild(emptyMsg);
    return;
  }

  repos.forEach(repo => {
    const prRate = (repo.prRate * 100).toFixed(0);
    const displayName = repo.id.replace('sources/github/', '');
    const avgDuration = repo.avgDurationMinutes ? `${repo.avgDurationMinutes} min avg` : 'N/A';
    const badgeClass = repo.prRate >= 0.7 ? 'success' : repo.prRate >= 0.4 ? 'warn' : 'danger';
    
    const item = createElement('div', 'item');
    
    const content = createElement('div', 'repo-item__content');
    const title = createElement('div', 'item-title', displayName);
    const meta = createElement('div', 'item-meta');
    meta.textContent = `${repo.total} session${repo.total !== 1 ? 's' : ''} • ${repo.withPRs} PR${repo.withPRs !== 1 ? 's' : ''} • ${avgDuration}`;
    
    content.appendChild(title);
    content.appendChild(meta);
    
    const badge = createElement('span', `status-badge status-badge--${badgeClass}`, `${prRate}% PRs`);
    
    item.appendChild(content);
    item.appendChild(badge);
    container.appendChild(item);
  });
}

function renderRecentPRs(analytics) {
  const container = document.getElementById('recentPRsContainer');
  if (!container) return;

  container.textContent = '';

  const recentPRs = analytics.prUrls.slice(0, 10);

  if (recentPRs.length === 0) {
    const emptyMsg = createElement('p', 'muted small-text text-center pad-lg', 'No PRs created yet');
    container.appendChild(emptyMsg);
    return;
  }

  recentPRs.forEach(pr => {
    const item = createElement('div', 'item');
    
    const content = createElement('div', 'pr-item__content');
    const title = createElement('div', 'item-title', pr.title || 'Pull Request');
    
    const meta = createElement('div', 'item-meta');
    const link = document.createElement('a');
    link.href = pr.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.className = 'pr-link';
    const icon = createIcon('open_in_new', 'icon-inline');
    link.appendChild(icon);
    link.appendChild(document.createTextNode(' View PR'));
    meta.appendChild(link);
    
    content.appendChild(title);
    content.appendChild(meta);
    item.appendChild(content);
    container.appendChild(item);
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForComponents);
} else {
  waitForComponents();
}
