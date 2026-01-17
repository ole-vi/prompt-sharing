#!/bin/bash

# Check for "export default" in src directory
echo "Checking for default exports..."
FOUND=$(grep -r "export default" src)

if [ -n "$FOUND" ]; then
  echo "Error: Default exports found!"
  echo "$FOUND"
  exit 1
else
  echo "No default exports found."
  exit 0
fi
