# PromptSync Web Clipper Browser Extension

A browser extension that captures any webpage as Markdown and syncs it directly to your GitHub repository.

## Features

- 💾 **One-Click Capture**: Click the extension icon to save any webpage
- 📝 **Markdown Conversion**: Automatically converts HTML to clean Markdown
- 🔗 **Preserves Links**: Keeps all hyperlinks and images intact
- 📊 **Smart Extraction**: Removes navigation, ads, and other clutter
- ☁️ **GitHub Sync**: Automatically sync clips to your GitHub repository
- ⚡ **Instant Download**: Option to download locally to your Downloads folder
- 🔐 **Secure OAuth**: Connect via GitHub OAuth (no PAT needed)
- 👥 **Multi-User**: Each user gets their own folder in the repository

## Installation

### Chrome / Edge / Brave

1. **Open Extensions Page**:
   - Chrome: Navigate to `chrome://extensions/`
   - Edge: Navigate to `edge://extensions/`
   - Brave: Navigate to `brave://extensions/`

2. **Enable Developer Mode**:
   - Toggle the "Developer mode" switch in the top-right corner

3. **Load the Extension**:
   - Click "Load unpacked"
   - Navigate to the `browser-extension` folder in your prompt-sharing repository
   - Select the folder and click "Select Folder"

4. **Pin the Extension** (optional):
   - Click the puzzle piece icon in the browser toolbar
   - Find "PromptSync Web Clipper"
   - Click the pin icon to keep it visible

### Firefox

1. **Open Debugging Page**:
   - Navigate to `about:debugging#/runtime/this-firefox`

2. **Load Temporary Add-on**:
   - Click "Load Temporary Add-on..."
   - Navigate to the `browser-extension` folder
   - Select the `manifest.json` file

**Note**: In Firefox, the extension will be removed when you close the browser. For permanent installation, you'd need to sign it through Mozilla's Add-ons site (not necessary for personal use).

## Usage

### First Time Setup - Connect to GitHub

1. **Click the extension icon** to open the popup

2. **Click "🔗 Connect to GitHub"**

3. **Authorize the application** on GitHub
   - You'll be redirected to GitHub
   - Click "Authorize" to grant access
   - The extension will automatically complete authentication

4. **You're connected!** Your GitHub username will appear in the popup

### Syncing a Webpage to GitHub

1. **Navigate to any webpage** you want to save (ChatGPT conversation, article, documentation, etc.)

2. **Click the PromptSync Clipper extension icon**

3. **Review the extraction**:
   - Page title (editable)
   - Suggested filename (editable)
   - Preview of converted Markdown

4. **Choose your action**:
   - **💾 Download**: Save locally to your Downloads folder
   - **☁️ Send to GitHub**: Commit directly to the repository

5. **Done!** Your clip is synced to `webclips/{your-username}/{filename}.md`

### Viewing Your Clips

Your synced clips appear at:
```
https://github.com/jessewashburn/prompt-sharing/tree/main/webclips/{your-username}
```

### File Format

Downloaded files include frontmatter metadata:

```markdown
---
title: "Page Title"
source: https://example.com/page
domain: example.com
captured: 2025-12-12T10:30:00.000Z
type: web-clip
---

# Page Title

**Source:** [https://example.com/page](https://example.com/page)

**Captured:** 12/12/2025, 10:30:00 AM

---

[Page content in Markdown...]
```

## Updating the Extension

When you make changes to the extension code:

1. Go to your browser's extensions page
2. Find "PromptSync Web Clipper"
3. Click the refresh/reload icon
4. The extension is now updated with your changes

## Troubleshooting

### "Could not connect to page. Try refreshing."

- Refresh the webpage you're trying to clip
- The extension needs to inject its content script first

### "Not connected to GitHub"

- Click "Connect to GitHub" in the popup
- Make sure you authorize the application on GitHub
- Check that pop-ups are not blocked

### "Permission denied" when syncing

- You need to be added as a collaborator to the repository
- Contact the repository owner to grant you access

### Extension disappeared (Firefox only)
 and GitHub sync
├── config.js              # OAuth and GitHub configuration
├── github-auth.js         # GitHub OAuth authentication
├── github-sync.js         # GitHub API sync logic
├── background.js          # Service worker for OAuth callbacks
- Temporary extensions are removed when Firefox closes
- Reload it from `about:debugging` each time, or use Chrome for permanent local installation

### OAuth errors

- Make sure the Firebase Functions are deployed
- Check browser console for detailed error messages
- Verify your GitHub OAuth app is configured correctly

## File Structure

```
browser-extension/
├── manifest.json          # Extension configuration
├── content.js             # Extracts page content (runs on every page)
├── popup.html             # Extension popup UI
├── popup.js               # Popup logic
└── README.md              # This file
```

## Customization

### Adjust Markdown Conversion

Edit `content.js` to modify how HTML elements are converted to Markdown. The `htmlToMarkdown()` function handles the conversion logic.

### Change Default Filename Format

Edit `popup.js` in the `generateFilename()` function to customize how filenames are generated:

```javascript
function generateFilename(title, domain) {
  const timestamp = new Date().toISOString().slice(0, 10);
  // Customize filename format here
  return `${timestamp}-${domain}-${title}.md`;
}
```

## Limitations

- Cannot capture pages behind authentication that require cookies (but CAN capture pages you're viewing while logged in)
- CConfiguration

The extension is pre-configured to sync with the `prompt-sharing` repository. If you want to fork this and use your own repository:

1. Edit [config.js](config.js)
2. Update `github.targetRepo.owner` and `github.targetRepo.repo`
3. Register your own GitHub OAuth app
4. Update `github.clientId` in config.js
5. Configure Firebase Functions with your OAuth credentials

## Security

- GitHub OAuth client secret is stored securely in Firebase Functions (server-side)
- Access tokens are stored in Chrome's encrypted sync storage
- State parameter prevents CSRF attacks
- All OAuth token exchanges happen server-side, not in the extension

## Next Steps

- Add support for selecting specific page regions
- Add templates for different types of pages (ChatGPT, documentation, articles)
- Add bulk capture for multiple tabs
- Add image downloading and embedding
- Add conflict resolution for duplicate filenames
- Add sync history and status indicators
- Add support for selecting specific page regions
- Add templates for different types of pages (ChatGPT, documentation, articles)
- Add bulk capture for multiple tabs
- Add image downloading and embedding

---

**Made for personal use. Not intended for Chrome Web Store distribution.**
