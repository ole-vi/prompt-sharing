import { signInWithGitHub } from './auth.js';
import { checkJulesKey } from './jules-keys.js';
import { showJulesKeyModal, showJulesEnvModal } from './jules-modal.js';

export async function handleTryInJules(promptText) {
  try {
    const user = window.auth ? window.auth.currentUser : null;
    if (!user) {
      try {
        await signInWithGitHub();
        setTimeout(() => handleTryInJulesAfterAuth(promptText), 500);
      } catch (error) {
        alert('Login required to use Jules.');
      }
      return;
    }
    await handleTryInJulesAfterAuth(promptText);
  } catch (error) {
    alert('An error occurred: ' + error.message);
  }
}

export async function handleTryInJulesAfterAuth(promptText) {
  const user = window.auth ? window.auth.currentUser : null;
  if (!user) {
    alert('Not logged in.');
    return;
  }

  try {
    const hasKey = await checkJulesKey(user.uid);
    
    if (!hasKey) {
      showJulesKeyModal(() => {
        showJulesEnvModal(promptText);
      });
    } else {
      showJulesEnvModal(promptText);
    }
  } catch (error) {
    alert('An error occurred. Please try again.');
  }
}
