/**
 * Checkbox Mutual Exclusivity Helper
 * Ensures that within a group of checkboxes, only one can be checked at a time.
 * The group is defined by the `data-exclusive-group` attribute in the HTML.
 */

/**
 * Initializes mutual exclusivity for all checkboxes with `data-exclusive-group` attribute.
 */
export function initMutualExclusivity() {
  const checkboxGroups = {};

  // Find all checkboxes with the data attribute and group them
  document.querySelectorAll('input[type="checkbox"][data-exclusive-group]').forEach(checkbox => {
    const group = checkbox.dataset.exclusiveGroup;
    if (!checkboxGroups[group]) {
      checkboxGroups[group] = [];
    }
    checkboxGroups[group].push(checkbox);
  });

  // Add event listeners to each group
  for (const groupName in checkboxGroups) {
    const groupCheckboxes = checkboxGroups[groupName];
    
    groupCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          // Uncheck all other checkboxes in the same group
          groupCheckboxes.forEach(otherCheckbox => {
            if (otherCheckbox !== checkbox) {
              otherCheckbox.checked = false;
            }
          });
        }
      });
    });
  }
}
