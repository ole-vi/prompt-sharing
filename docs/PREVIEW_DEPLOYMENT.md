# Preview Deployment Workflow

This document describes how to use the Preview Deployment GitHub Actions workflow to create temporary, shareable instances of PromptRoot for testing on mobile devices or sharing with reviewers.

## Overview

The Preview Deployment workflow allows you to:
- Manually trigger a temporary deployment of any branch
- Choose how long the preview should remain active (3, 5, 10, or 15 minutes)
- Get a publicly accessible URL via ngrok
- Automatically share the URL via Discord using treehouses CLI
- Review changes on mobile devices or share with team members

## Prerequisites

Before using this workflow, you need to set up two GitHub repository secrets:

### 1. NGROK_AUTH_TOKEN

The workflow uses [ngrok](https://ngrok.com/) to create a secure tunnel to expose the local server publicly.

**Setup Steps:**
1. Sign up for a free account at [ngrok.com](https://ngrok.com/)
2. Go to your ngrok dashboard: https://dashboard.ngrok.com/get-started/your-authtoken
3. Copy your authtoken
4. In your GitHub repository, go to: Settings → Secrets and variables → Actions
5. Click "New repository secret"
6. Name: `NGROK_AUTH_TOKEN`
7. Value: Paste your ngrok authtoken
8. Click "Add secret"

### 2. CHANNEL

This is the Discord channel ID or webhook where deployment notifications will be sent using treehouses CLI.

**Setup Steps:**
1. Get your Discord channel information from your treehouses setup
2. In your GitHub repository, go to: Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `CHANNEL`
5. Value: Your Discord channel identifier
6. Click "Add secret"

## How to Use

### Triggering a Preview Deployment

1. Go to your GitHub repository
2. Click on the "Actions" tab
3. Select "Preview Deployment" from the workflows list
4. Click "Run workflow"
5. Select the branch you want to deploy
6. Choose the duration (3, 5, 10, or 15 minutes)
7. Click "Run workflow"

### What Happens

1. GitHub Actions spins up an Ubuntu runner
2. Installs Node.js and dependencies
3. Installs treehouses CLI globally
4. Installs and configures ngrok
5. Starts the npm server (`npm start`)
6. Creates a public ngrok tunnel
7. Sends the preview URL to Discord with:
   - Branch name
   - Duration
   - Public URL
   - Who triggered it
8. Keeps the server running for the specified duration
9. Automatically cleans up and shuts down after the time expires
10. Sends a completion message to Discord

### Accessing the Preview

Once the workflow runs:
1. Check the Discord channel for the deployment notification
2. Click the ngrok URL provided
3. The preview will be available for the selected duration
4. Share the URL with reviewers or access it on your mobile device

### Monitoring the Deployment

- The workflow run page shows real-time logs
- Server logs are displayed while the preview is active
- You can see when the server starts and when it will shut down
- The Discord channel receives start and completion notifications

## Use Cases

- **Mobile Testing**: Test responsive design on actual mobile devices
- **Client Reviews**: Share a live preview with clients or stakeholders
- **Quick Demos**: Show features to team members without deploying to production
- **Cross-Device Testing**: Test on different devices and browsers
- **Remote Collaboration**: Share work with distributed team members

## Limitations

- Free ngrok accounts have bandwidth and connection limits
- Preview URLs are temporary and expire after the selected duration
- The workflow consumes GitHub Actions minutes
- Only one preview can run at a time per workflow execution

## Troubleshooting

### Preview URL not working
- Check that NGROK_AUTH_TOKEN is correctly set
- Verify the server started successfully in the workflow logs
- Ensure port 3000 is properly exposed

### Discord notification not received
- Verify CHANNEL secret is correctly set
- Check that treehouses CLI is configured properly
- Review the workflow logs for error messages

### Server fails to start
- Check the server.log output in the workflow
- Verify npm dependencies installed correctly
- Ensure package.json has the correct start script

## Security Notes

- ngrok URLs are public but temporary
- Do not use this for production deployments
- Be cautious about exposing sensitive data
- Preview URLs expire automatically after the set duration
- GitHub secrets are encrypted and only accessible during workflow execution

## Related Documentation

- [ngrok Documentation](https://ngrok.com/docs)
- [treehouses CLI](https://github.com/treehouses/cli)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
