# Chrome Web Store Submission Details

## Store Listing

### Category
**Developer Tools** (or Productivity)

### Short Description (132 chars max)
```
Capture any webpage as Markdown and save directly to your GitHub repository. Perfect for research, documentation, and knowledge management.
```

### Detailed Description
```
PromptRoot Web Capture makes it easy to save web content directly to your GitHub repository in clean Markdown format.

KEY FEATURES:
• One-click web page capture with automatic Markdown conversion
• Direct GitHub integration - save to any repository and branch
• Preserves page structure, links, and formatting
• Perfect for building knowledge bases, documentation, and research collections
• Organize captures in custom folders within your repository
• Syncs seamlessly with your existing GitHub workflow

IDEAL FOR:
- Developers building documentation
- Researchers collecting reference materials
- Content curators organizing information
- Anyone who wants to save web content in a version-controlled, portable format

HOW IT WORKS:
1. Connect your GitHub account
2. Click the extension icon on any webpage
3. Choose your repository, branch, and folder
4. Save - your content is instantly committed to GitHub in Markdown format

All captures are stored in your GitHub repository, giving you full ownership and version control of your saved content.
```

## Privacy Practices

### Single Purpose
```
This extension captures webpage content and converts it to Markdown format for saving to GitHub repositories.
```

### Permission Justifications

**activeTab**
```
Required to access and read the content of the currently active tab when the user clicks the extension icon to capture a webpage.
```

**scripting**
```
Required to inject content extraction scripts into the active tab to convert HTML content to Markdown format when the user initiates a capture.
```

**storage**
```
Required to store user preferences including GitHub authentication tokens and repository settings (owner, repo name, branch, and folder path) locally in the browser.
```

**tabs**
```
Required to retrieve the current tab's URL and title information to include in the captured Markdown file metadata.
```

**Host Permissions (api.github.com, cloudfunctions.net, firebaseapp.com)**
```
Required to authenticate with GitHub OAuth and commit captured Markdown files directly to the user's selected GitHub repository via the GitHub API. Firebase endpoints are used for OAuth callback handling.
```

### Remote Code Usage

**Answer:** No

**Justification:**
```
This extension does not use remote code. All JavaScript code is included in the extension package. The extension only makes API calls to GitHub for data exchange and loads fonts/CSS from Google Fonts for styling.
```

## Data Usage

### Data Collected

**Authentication information**
- GitHub OAuth tokens stored locally
- GitHub username for organizing captures

**Website content**
- Text, images, and webpage content when user explicitly clicks to capture

### How Data is Used

**Authentication information:**
```
GitHub OAuth tokens are stored locally in the browser to authenticate API requests for committing captured content to the user's GitHub repository. GitHub username is used to organize files in the repository folder structure.
```

**Website content:**
```
Webpage content (text, images, links) is captured only when the user explicitly clicks the extension icon. The content is converted to Markdown format and either downloaded locally or committed to the user's GitHub repository. No content is stored on external servers or transmitted to third parties.
```

### Data Handling
- 🔒 Encrypted in transit (HTTPS to GitHub)
- 💾 Stored locally (OAuth tokens)
- ❌ Not sold to third parties
- ✅ User can request deletion (by disconnecting GitHub or uninstalling extension)

### Certifications
✅ I do not sell or transfer user data to third parties, outside of the approved use cases
✅ I do not use or transfer user data for purposes that are unrelated to my item's single purpose
✅ I do not use or transfer user data to determine creditworthiness or for lending purposes

## Additional Information

### Privacy Policy URL
```
https://promptroot.ai/privacy
```

### Trader/Non-Trader Status
**Non-trader** - This is a free, non-commercial extension under a non-profit umbrella

### Contact Email
Must be verified in Chrome Web Store Developer Dashboard Account tab

## Assets

### Icons
- 16x16px: `WebCapture.png`
- 48x48px: `WebCapture.png`
- 128x128px: `WebCapture.png`

### Screenshots
Located in `browser-extension/screenshots/`:
- `PRWC-web-extension-screenshot.png` - Extension popup
- `PR-web-app-screenshot.png` - Web application
- `WebCapture-logo-128x128.png` - Logo

### Extension Package
Create zip excluding README.md:
```powershell
cd browser-extension
powershell -Command "Get-ChildItem -Exclude README.md | Compress-Archive -DestinationPath ../extension.zip -Force"
```
