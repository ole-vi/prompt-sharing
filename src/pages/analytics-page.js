// ===== Analytics Page =====
// Displays Jules session analytics with charts and metrics

import { waitForFirebase } from '../shared-init.js';
import { getAuth } from '../modules/firebase-service.js';
import { calculateAnalytics } from '../modules/analytics.js';
import { syncActiveSessions } from '../modules/session-tracking.js';
import { handleError, ErrorCategory } from '../utils/error-handler.js';
import { TIMEOUTS } from '../utils/constants.js';

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
  } catch (error) {
    handleError(error, { source: 'analyticsInit' });
  }
}

function showNotSignedIn() {
  document.getElementById('analyticsLoading')?.classList.add('hidden');
  document.getElementById('analyticsContent')?.classList.add('hidden');
  document.getElementById('analyticsNotSignedIn')?.classList.remove('hidden');
}

async function loadAnalytics() {
  const loadingDiv = document.getElementById('analyticsLoading');
  const contentDiv = document.getElementById('analyticsContent');
  const notSignedInDiv = document.getElementById('analyticsNotSignedIn');

  try {
    loadingDiv?.classList.remove('hidden');
    contentDiv?.classList.add('hidden');
    notSignedInDiv?.classList.add('hidden');

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

    loadingDiv?.classList.add('hidden');
    contentDiv?.classList.remove('hidden');
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

  const prompts = Object.entries(analytics.promptMetrics)
    .map(([path, metric]) => ({ path, ...metric }))
    .filter(p => p.total > 0)
    .sort((a, b) => {
      // Sort by success rate first, then by total uses
      if (Math.abs(b.successRate - a.successRate) > 0.01) {
        return b.successRate - a.successRate;
      }
      return b.total - a.total;
    })
    .slice(0, 10);

  if (prompts.length === 0) {
    container.innerHTML = '<p class="muted">No prompts used yet</p>';
    return;
  }

  container.innerHTML = prompts.map((prompt, index) => {
    const successRate = (prompt.successRate * 100).toFixed(0);
    const prRate = (prompt.prRate * 100).toFixed(0);
    const displayPath = prompt.path.replace(/^prompts\//, '');
    
    return `
      <div class="analytics-list-item">
        <div class="analytics-rank">${index + 1}</div>
        <div class="analytics-list-content">
          <div class="analytics-list-title">${displayPath}</div>
          <div class="analytics-list-meta">
            ${prompt.total} use${prompt.total !== 1 ? 's' : ''} • 
            ${successRate}% success • 
            ${prRate}% with PRs
          </div>
        </div>
        <div class="analytics-badge ${prompt.successRate >= 0.8 ? 'success' : prompt.successRate >= 0.5 ? 'warning' : 'danger'}">
          ${successRate}%
        </div>
      </div>
    `;
  }).join('');
}

function renderFailureAnalysis(analytics) {
  const container = document.getElementById('failureAnalysisContainer');
  if (!container) return;

  if (analytics.failedSessions === 0) {
    container.innerHTML = '<p class="muted">No failures recorded 🎉</p>';
    return;
  }

  const reasonsHtml = Object.entries(analytics.failureReasons)
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => {
      const displayReason = reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      return `
        <div class="analytics-failure-item">
          <span class="analytics-failure-label">${displayReason}</span>
          <span class="analytics-failure-count">${count}</span>
        </div>
      `;
    }).join('');

  const stepsHtml = Object.entries(analytics.failureSteps)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([step, count]) => {
      return `
        <div class="analytics-failure-item">
          <span class="analytics-failure-label">${step}</span>
          <span class="analytics-failure-count">${count}</span>
        </div>
      `;
    }).join('');

  container.innerHTML = `
    <div class="analytics-failure-section">
      <h3>Failure Reasons</h3>
      ${reasonsHtml || '<p class="muted">No reason data</p>'}
    </div>
    <div class="analytics-failure-section">
      <h3>Failed at Step</h3>
      ${stepsHtml || '<p class="muted">No step data</p>'}
    </div>
  `;
}

function renderRepoPerformance(analytics) {
  const container = document.getElementById('repoPerformanceContainer');
  if (!container) return;

  const repos = Object.entries(analytics.repoMetrics)
    .map(([id, metric]) => ({ id, ...metric }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  if (repos.length === 0) {
    container.innerHTML = '<p class="muted">No repository data</p>';
    return;
  }

  container.innerHTML = repos.map(repo => {
    const successRate = (repo.successRate * 100).toFixed(0);
    const prRate = (repo.prRate * 100).toFixed(0);
    const displayName = repo.id.replace('sources/github/', '');
    const avgDuration = repo.avgDurationMinutes ? `${repo.avgDurationMinutes} min avg` : 'N/A';
    
    return `
      <div class="analytics-list-item">
        <div class="analytics-list-content">
          <div class="analytics-list-title">${displayName}</div>
          <div class="analytics-list-meta">
            ${repo.total} session${repo.total !== 1 ? 's' : ''} • 
            ${repo.withPRs} PR${repo.withPRs !== 1 ? 's' : ''} • 
            ${avgDuration}
          </div>
        </div>
        <div class="analytics-badge ${repo.prRate >= 0.7 ? 'success' : repo.prRate >= 0.4 ? 'warning' : 'danger'}">
          ${prRate}% PRs
        </div>
      </div>
    `;
  }).join('');
}

function renderRecentPRs(analytics) {
  const container = document.getElementById('recentPRsContainer');
  if (!container) return;

  const recentPRs = analytics.prUrls.slice(0, 10);

  if (recentPRs.length === 0) {
    container.innerHTML = '<p class="muted">No PRs created yet</p>';
    return;
  }

  container.innerHTML = recentPRs.map(pr => {
    return `
      <div class="analytics-list-item">
        <div class="analytics-list-content">
          <div class="analytics-list-title">${pr.title}</div>
          <div class="analytics-list-meta">
            <a href="${pr.url}" target="_blank" rel="noopener" class="analytics-pr-link">
              <span class="icon icon-inline" aria-hidden="true">link</span>
              View PR
            </a>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForComponents);
} else {
  waitForComponents();
}
