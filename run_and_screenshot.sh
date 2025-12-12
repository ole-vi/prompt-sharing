#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

echo "Starting Python server..."
python3 -m http.server 8888 > server.log 2>&1 &
SERVER_PID=$!

# Ensure the server is killed on script exit, suppressing errors if the process is already gone.
trap 'echo "Shutting down server..."; kill $SERVER_PID 2>/dev/null || true' EXIT

echo "Waiting for server to start..."
sleep 2

echo "Running screenshot script..."
xvfb-run --auto-servernum node screenshot.js

echo "Screenshot created as screenshot.png"
