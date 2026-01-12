# Blob URL Memory Leak Fix - Test Guide

## What Was Fixed
The app was creating blob URLs for gist/codex content but never revoking them, causing memory leaks in long sessions. Now blob URLs are properly tracked and revoked when no longer needed.

## Happy Path Test Scenario

### Setup
1. Open the app in your browser
2. Open DevTools Console (F12 → Console tab)
3. Filter console for `[BlobURL]` to see only blob lifecycle logs

### Test Steps

#### Scenario 1: Multiple Gist Selections
1. **Select a gist-based prompt** (one that contains a gist URL)
   - Console shows: `[BlobURL] Created new gist URL: blob:http://...`
   - Note the blob URL created

2. **Select a different gist-based prompt**
   - Console shows: `[BlobURL] Revoking old gist URL: blob:http://...` (previous URL)
   - Console shows: `[BlobURL] Created new gist URL: blob:http://...` (new URL)
   - ✅ **Old URL was revoked before creating new one**

3. **Repeat 5-10 times** with different gist prompts
   - Each selection should show revoke → create pattern
   - ✅ **Only ONE blob URL exists at a time**

#### Scenario 2: Switching Between Types
1. **Select a gist prompt**
   - Console shows: `[BlobURL] Created new gist URL: blob:http://...`

2. **Select a regular markdown prompt** (from repo files)
   - Console shows: `[BlobURL] Revoking for regular file: blob:http://...`
   - ✅ **Blob URL cleaned up when switching to regular file**

3. **Select another gist prompt**
   - Console shows: `[BlobURL] Created new gist URL: blob:http://...` (no revoke since none existed)

4. **Select a codex prompt** (if available)
   - Console shows: `[BlobURL] Revoking old gist URL: ...`
   - Console shows: `[BlobURL] Created new codex URL: ...`
   - ✅ **Cross-type revocation works**

#### Scenario 3: Memory Inspection (Advanced)
1. Open DevTools → Memory tab
2. Take a heap snapshot (baseline)
3. Click through 20+ gist/codex prompts rapidly
4. Take another heap snapshot
5. Compare snapshots
   - ✅ **Blob objects should NOT accumulate** (only 0-1 should exist)

### Expected Console Output Example

```
[BlobURL] Created new gist URL: blob:http://localhost:5000/abc123-def456
[BlobURL] Revoking old gist URL: blob:http://localhost:5000/abc123-def456
[BlobURL] Created new gist URL: blob:http://localhost:5000/xyz789-uvw012
[BlobURL] Revoking old gist URL: blob:http://localhost:5000/xyz789-uvw012
[BlobURL] Created new codex URL: blob:http://localhost:5000/qrs345-tuv678
[BlobURL] Revoking for regular file: blob:http://localhost:5000/qrs345-tuv678
```

### What to Look For

✅ **Good Signs:**
- Every `Created` is preceded by `Revoking` (except the first)
- Blob URLs are different each time
- Only one URL tracked at a time
- Logs show proper cleanup

❌ **Bad Signs (would indicate bug):**
- Multiple `Created` logs with no `Revoking`
- Same blob URL appearing repeatedly
- No logs appearing at all

### Testing Different Content Types

**Gist Content:** Prompts that contain GitHub gist URLs
- Look for "View on Gist" button
- Raw link uses blob URL

**Codex Content:** Prompts that match codex URL pattern
- Look for "View on Codex" button  
- Raw link uses blob URL

**Regular Files:** Markdown files from repo
- Look for "View on GitHub" button
- Raw link uses direct GitHub URL (no blob)

### Quick 2-Minute Test

1. Open app with console filtered to `[BlobURL]`
2. Click gist prompt → see "Created"
3. Click another gist → see "Revoking" then "Created"
4. Click regular file → see "Revoking"
5. ✅ **Pass if you see all expected logs**

## What Happens Without the Fix

Before this fix, selecting 100 gist prompts would create 100 blob URLs in memory that never get cleaned up. After hours of use, this could cause:
- Increased memory usage
- Browser slowdown
- Potential crashes in extreme cases

Now each blob URL is properly released before creating a new one.
