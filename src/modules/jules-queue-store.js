let queueCache = [];
let queuePromptViewerHandlers = new Map();
let editModalState = {
  originalData: null,
  hasUnsavedChanges: false,
  currentDocId: null,
  currentType: null,
  repoSelector: null,
  branchSelector: null,
  isUnscheduled: false,
  isInitializing: false
};
let activeEditModal = null;
let activeScheduleModal = null;
let queueModalEscapeHandler = null;

export function getQueueCache() {
  return queueCache;
}

export function setQueueCache(items) {
  queueCache = items;
}

export function findQueueItem(docId) {
  return queueCache.find(i => i.id === docId);
}

export function getPromptViewerHandlers() {
  return queuePromptViewerHandlers;
}

export function clearPromptViewerHandlers() {
  queuePromptViewerHandlers.forEach((handler, key) => {
    delete window[key];
  });
  queuePromptViewerHandlers.clear();
}

export function registerPromptViewerHandler(key, handler) {
  window[key] = handler;
  queuePromptViewerHandlers.set(key, handler);
}

export function getEditModalState() {
  return editModalState;
}

export function updateEditModalState(updates) {
  Object.assign(editModalState, updates);
}

export function resetEditModalState() {
  editModalState = {
    originalData: null,
    hasUnsavedChanges: false,
    currentDocId: null,
    currentType: null,
    repoSelector: null,
    branchSelector: null,
    isUnscheduled: false,
    isInitializing: false
  };
}

export function getActiveEditModal() {
  return activeEditModal;
}

export function setActiveEditModal(modal) {
  activeEditModal = modal;
}

export function getActiveScheduleModal() {
  return activeScheduleModal;
}

export function setActiveScheduleModal(modal) {
  activeScheduleModal = modal;
}

export function getQueueModalEscapeHandler() {
  return queueModalEscapeHandler;
}

export function setQueueModalEscapeHandler(handler) {
  queueModalEscapeHandler = handler;
}
