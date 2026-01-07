// src/utils/retry.js

import { MAX_RETRIES } from './constants.js';
import { showSubtaskErrorModal } from '../modules/jules-modal.js';

/**
 * Retries an async function with a user-facing error modal.
 * @param {Function} asyncFn - The async function to retry. Must return a truthy value on success.
 * @param {object} context - The context for the retry logic.
 * @param {Function} [context.onSuccess] - Function to call on success, receives result of asyncFn.
 * @param {Function} [context.onQueue] - Function to call when user chooses to queue.
 * @param {Function} [context.onFinalFailure] - Function to call after all retries fail.
 * @param {number} [context.subtaskNumber=1] - The subtask number for the error modal.
 * @param {number} [context.totalSubtasks=1] - The total number of subtasks for the error modal.
 * @returns {Promise<{success: boolean, reason?: string, result?: any, error?: any}>}
 */
export async function retryWithErrorModal(asyncFn, context) {
  let attempt = 0;
  const {
    onSuccess,
    onQueue,
    onFinalFailure,
    subtaskNumber = 1,
    totalSubtasks = 1,
  } = context;

  while (attempt < MAX_RETRIES) {
    try {
      const result = await asyncFn();
      if (onSuccess) {
        onSuccess(result);
      }
      return { success: true, result };
    } catch (error) {
      attempt++;
      if (attempt < MAX_RETRIES) {
        // Intermediate failure
        const result = await showSubtaskErrorModal(subtaskNumber, totalSubtasks, error);

        if (result.action === 'cancel') {
          return { success: false, reason: 'cancelled' };
        } else if (result.action === 'skip') {
          return { success: false, reason: 'skipped' };
        } else if (result.action === 'queue') {
          if (onQueue) await onQueue(false);
          return { success: false, reason: 'queued' };
        } else if (result.action === 'retry') {
          if (result.shouldDelay) {
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
          // Continue to next attempt
        }
      } else {
        // Final failure
        const result = await showSubtaskErrorModal(subtaskNumber, totalSubtasks, error);

        if (result.action === 'cancel' || result.action === 'skip') {
             return { success: false, reason: result.action === 'cancel' ? 'cancelled' : 'skipped' };
        } else if (result.action === 'queue') {
            if (onQueue) await onQueue(true);
            return { success: false, reason: 'queued' };
        } else if (result.action === 'retry') {
            // This was a common pattern, one last try
            if (result.shouldDelay) {
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
            try {
                const finalResult = await asyncFn();
                if (onSuccess) onSuccess(finalResult);
                return { success: true, result: finalResult };
            } catch (finalError) {
                if (onFinalFailure) {
                    onFinalFailure(finalError);
                } else {
                    alert('Failed to submit task after multiple retries. Please try again later.');
                }
                return { success: false, reason: 'failed', error: finalError };
            }
        }
        // If user closes modal without action on final failure, treat as cancel.
        return { success: false, reason: 'cancelled' };
      }
    }
  }
}
