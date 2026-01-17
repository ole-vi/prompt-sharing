#!/bin/bash
# Check for innerHTML usage in src directory

# Find files with innerHTML
# Exclude dom-helpers.js as it provides the safe abstraction
# Exclude lines with marked.parse as it is a trusted markdown renderer

VIOLATIONS=$(grep -r "innerHTML" src --include="*.js" \
  --exclude="dom-helpers.js" \
  | grep -v "marked.parse")

if [ -n "$VIOLATIONS" ]; then
  echo "Error: innerHTML usage detected in the following files:"
  echo "$VIOLATIONS"
  echo ""
  echo "Please use createElement from src/utils/dom-helpers.js instead."
  exit 1
fi

echo "No innerHTML violations found."
exit 0
