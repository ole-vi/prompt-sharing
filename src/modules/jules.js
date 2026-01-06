// ===== Compatibility Re-Exports =====
// This file exists to preserve legacy imports of "../modules/jules.js".
// New code should import from the focused modules directly.

// Queue
export {
  addToJulesQueue,
  updateJulesQueueItem,
  deleteFromJulesQueue,
  listJulesQueue,
  showJulesQueueModal,
  hideJulesQueueModal,
  renderQueueListDirectly,
  attachQueueHandlers,
  loadQueuePage
} from './jules-queue.js';

// Account/Profile
export { loadProfileDirectly, loadJulesAccountInfo } from './jules-account.js';

// Key management
export { checkJulesKey, deleteStoredJulesKey, encryptAndStoreKey, getDecryptedJulesKey } from './jules-keys.js';

// UI modals
export { showJulesKeyModal } from './jules-modal.js';
