/**
 * Checkbox Mutual Exclusivity Helper
 * Ensures that two checkboxes cannot be checked at the same time
 */

/**
 * Makes two checkboxes mutually exclusive
 * @param {string} checkbox1Id - ID of the first checkbox
 * @param {string} checkbox2Id - ID of the second checkbox
 */
export function setupMutualExclusivity(checkbox1Id, checkbox2Id) {
  const checkbox1 = document.getElementById(checkbox1Id);
  const checkbox2 = document.getElementById(checkbox2Id);
  
  if (checkbox1 && checkbox2) {
    checkbox1.addEventListener('change', () => {
      if (checkbox1.checked) checkbox2.checked = false;
    });
    
    checkbox2.addEventListener('change', () => {
      if (checkbox2.checked) checkbox1.checked = false;
    });
  }
}

/**
 * Initialize all checkbox mutual exclusivity pairs for a page
 * @param {Array<{id1: string, id2: string}>} pairs - Array of checkbox ID pairs
 */
export function initializeMutualExclusivity(pairs) {
  pairs.forEach(pair => {
    setupMutualExclusivity(pair.id1, pair.id2);
  });
}
