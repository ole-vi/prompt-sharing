import { showToast } from './toast.js';
import { JULES_MESSAGES } from '../utils/constants.js';
import { updateJulesQueueItem, getUserTimeZone, saveUserTimeZone } from './jules-queue-api.js';

let scheduleState = {
  selectedIds: [],
  onSchedule: null
};

export async function showScheduleModal(selectedIds, onScheduleCallback) {
  const user = window.auth?.currentUser;
  if (!user) {
    showToast(JULES_MESSAGES.SIGN_IN_REQUIRED, 'warn');
    return;
  }

  scheduleState.selectedIds = selectedIds;
  scheduleState.onSchedule = onScheduleCallback;

  const userTimeZone = await getUserTimeZone();

  let modal = document.getElementById('scheduleQueueModal');
  if (!modal) {
    await loadScheduleModal();
    modal = document.getElementById('scheduleQueueModal');
    if (!modal) {
      console.error('Failed to load schedule modal');
      return;
    }
  }

  populateTimeZoneDropdown(userTimeZone);
  initializeScheduleModalInputs();
  attachScheduleModalHandlers();

  modal.style.display = 'flex';
}

async function loadScheduleModal() {
  const container = document.getElementById('scheduleQueueModalContainer');
  if (!container) {
    console.error('Schedule modal container not found');
    return;
  }

  try {
    const response = await fetch('/partials/schedule-queue-modal.html');
    if (!response.ok) throw new Error('Failed to load modal');
    const html = await response.text();
    container.innerHTML = html;
  } catch (err) {
    console.error('Error loading schedule modal:', err);
  }
}

function populateTimeZoneDropdown(selectedTimeZone) {
  const tzSelect = document.getElementById('scheduleTimeZone');
  if (!tzSelect) return;

  const timeZones = getCommonTimeZones();
  tzSelect.innerHTML = timeZones.map(tz =>
    `<option value="${tz.value}" ${tz.value === selectedTimeZone ? 'selected' : ''}>${tz.label}</option>`
  ).join('');
}

function initializeScheduleModalInputs() {
  const dateInput = document.getElementById('scheduleDate');
  const timeInput = document.getElementById('scheduleTime');
  const tzSelect = document.getElementById('scheduleTimeZone');

  const updateMinDate = () => {
    if (!dateInput || !tzSelect) return;

    const selectedTz = tzSelect.value;
    const nowInTz = new Date().toLocaleString('en-US', { timeZone: selectedTz });
    const minDate = new Date(nowInTz).toISOString().split('T')[0];
    dateInput.min = minDate;
    dateInput.value = minDate;
  };

  const updateDefaultTime = () => {
    if (!timeInput || !tzSelect) return;

    try {
      const selectedTz = tzSelect.value;
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: selectedTz
      });
      const parts = formatter.formatToParts(now);
      let hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10);
      hour = (hour + 1) % 24;
      timeInput.value = `${hour.toString().padStart(2, '0')}:00`;
    } catch (e) {
      const now = new Date();
      now.setHours(now.getHours() + 1);
      now.setMinutes(0);
      timeInput.value = now.toTimeString().slice(0, 5);
    }
  };

  if (dateInput) {
    updateMinDate();
  }

  if (timeInput) {
    updateDefaultTime();
  }

  if (tzSelect) {
    const handleTzChange = () => {
      updateMinDate();
      updateDefaultTime();
    };
    tzSelect.removeEventListener('change', handleTzChange);
    tzSelect.addEventListener('change', handleTzChange);
  }
}

function attachScheduleModalHandlers() {
  const modal = document.getElementById('scheduleQueueModal');
  if (!modal) return;

  const closeBtn = document.getElementById('closeScheduleModal');
  const cancelBtn = document.getElementById('cancelSchedule');
  const confirmBtn = document.getElementById('confirmSchedule');

  if (closeBtn) closeBtn.onclick = hideScheduleModal;
  if (cancelBtn) cancelBtn.onclick = hideScheduleModal;
  if (confirmBtn) confirmBtn.onclick = confirmScheduleItems;

  modal.onclick = (e) => {
    if (e.target === modal) hideScheduleModal();
  };
}

export function hideScheduleModal() {
  const modal = document.getElementById('scheduleQueueModal');
  if (modal) {
    modal.style.display = 'none';
    const errorDiv = document.getElementById('scheduleError');
    if (errorDiv) {
      errorDiv.classList.add('hidden');
      errorDiv.textContent = '';
    }
  }
  scheduleState.selectedIds = [];
  scheduleState.onSchedule = null;
}

async function confirmScheduleItems() {
  const user = window.auth?.currentUser;
  if (!user) return;

  const dateInput = document.getElementById('scheduleDate');
  const timeInput = document.getElementById('scheduleTime');
  const timeZoneSelect = document.getElementById('scheduleTimeZone');
  const retryCheckbox = document.getElementById('scheduleRetryOnFailure');
  const errorDiv = document.getElementById('scheduleError');

  errorDiv.classList.add('hidden');
  errorDiv.textContent = '';

  if (!dateInput.value || !timeInput.value) {
    errorDiv.textContent = 'Date and time are required';
    errorDiv.classList.remove('hidden');
    return;
  }

  const selectedDate = dateInput.value;
  const selectedTime = timeInput.value;
  const selectedTimeZone = timeZoneSelect.value;

  const dateTimeStr = `${selectedDate}T${selectedTime}:00`;
  const scheduledDate = parseDateInTimeZone(dateTimeStr, selectedTimeZone);

  const now = new Date();
  if (scheduledDate < now) {
    errorDiv.textContent = 'Scheduled time must be in the future';
    errorDiv.classList.remove('hidden');
    return;
  }

  await saveUserTimeZone(selectedTimeZone);

  const queueSelections = scheduleState.selectedIds;

  try {
    const scheduledAt = firebase.firestore.Timestamp.fromDate(scheduledDate);
    const retryOnFailure = retryCheckbox ? retryCheckbox.checked : false;

    for (const docId of queueSelections) {
      await updateJulesQueueItem(user.uid, docId, {
        status: 'scheduled',
        scheduledAt: scheduledAt,
        scheduledTimeZone: selectedTimeZone,
        retryOnFailure: retryOnFailure,
        retryCount: 0,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    const totalScheduled = queueSelections.length;

    const formattedScheduledAt = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: selectedTimeZone,
      timeZoneName: 'short'
    }).format(scheduledDate);

    const itemText = totalScheduled === 1 ? 'item' : 'items';
    showToast(`Scheduled ${totalScheduled} ${itemText} for ${formattedScheduledAt}`, 'success');

    const callback = scheduleState.onSchedule;
    hideScheduleModal();

    if (callback) {
      await callback();
    }
  } catch (err) {
    errorDiv.textContent = `Failed to schedule items: ${err.message}`;
    errorDiv.classList.remove('hidden');
  }
}

function parseDateInTimeZone(dateTimeStr, timeZone) {
  const parts = dateTimeStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/);
  if (!parts) {
    throw new Error('Invalid date format');
  }

  const [, year, month, day, hour, minute, second] = parts;
  const dateInTz = new Date(new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`).toLocaleString('en-US', { timeZone }));
  const dateInLocal = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
  const offset = dateInLocal - dateInTz;

  return new Date(dateInLocal.getTime() - offset);
}

function getCommonTimeZones() {
  return [
    { value: 'America/New_York', label: 'New York (ET)' },
    { value: 'America/Chicago', label: 'Chicago (CT)' },
    { value: 'America/Denver', label: 'Denver (MT)' },
    { value: 'America/Los_Angeles', label: 'Los Angeles (PT)' },
    { value: 'America/Anchorage', label: 'Anchorage (AKT)' },
    { value: 'Pacific/Honolulu', label: 'Honolulu (HT)' },
    { value: 'America/Mexico_City', label: 'Mexico City (CST)' },
    { value: 'America/Toronto', label: 'Toronto (ET)' },
    { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
    { value: 'America/Buenos_Aires', label: 'Buenos Aires (ART)' },
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
    { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
    { value: 'Europe/Moscow', label: 'Moscow (MSK)' },
    { value: 'Africa/Cairo', label: 'Cairo (EET)' },
    { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Asia/Kolkata', label: 'India (IST)' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
    { value: 'Asia/Bangkok', label: 'Bangkok (ICT)' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEDT/AEST)' },
    { value: 'Pacific/Auckland', label: 'Auckland (NZDT/NZST)' },
    { value: 'UTC', label: 'UTC' }
  ];
}
