# PromptSync Web Clipper Browser Extension

A simple browser extension that captures any webpage as Markdown and downloads it locally to your computer.

## Features

- 💾 **One-Click Capture**: Click the extension icon to save any webpage
- 📝 **Markdown Conversion**: Automatically converts HTML to clean Markdown
- 🔗 **Preserves Links**: Keeps all hyperlinks and images intact
- 📊 **Smart Extraction**: Removes navigation, ads, and other clutter
- ⚡ **Instant Download**: Downloads directly to your Downloads folder
- 🎯 **No Setup Required**: Works immediately after installation

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

### Capturing a Webpage

1. **Navigate to any webpage** you want to save (ChatGPT conversation, article, documentation, etc.)

2. **Click the PromptSync Clipper extension icon**

3. **Review the extraction**:
   - Page title (editable)
   - Suggested filename (editable)
   - Preview of converted Markdown

4. **Click "💾 Download Markdown"**

5. **Done!** The `.md` file is downloaded to your Downloads folder

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

### Extension disappeared (Firefox only)

- Temporary extensions are removed when Firefox closes
- Reload it from `about:debugging` each time, or use Chrome for permanent local installation

## File Structure

```
browser-extension/
├── manifest.json          # Extension configuration
├── content.js             # Extracts page content (runs on every page)
├── popup.html             # Extension popup UI
├── popup.js               # Popup logic
├── icons/                 # Extension icons
│   ├── icon16.svg
│   ├── icon48.svg
│   └── icon128.svg
└── README.md             # This file
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
- Canvas/WebGL content is not captured
- Some dynamic content may not be preserved
- Large images are linked, not embedded

## Next Steps

- Add support for selecting specific page regions
- Add templates for different types of pages (ChatGPT, documentation, articles)
- Add bulk capture for multiple tabs
- Add image downloading and embedding

---

**Made for personal use. Not intended for Chrome Web Store distribution.**
