# GitHub API Rate Limit Solution

## Problem
The app was hitting GitHub's API rate limits:
- **Unauthenticated requests**: 60 requests/hour (shared by IP)
- **Authenticated requests**: 5,000 requests/hour (per user)

## Solution Implemented

### Overview
Instead of using a shared PAT (which would still limit all users to 5,000 requests/hour total), we now leverage the **GitHub OAuth tokens** that users already have from logging in with GitHub.

### Benefits
✅ **5,000 requests/hour per user** (not shared)  
✅ **No additional user action required** (already logged in)  
✅ **More secure** (no exposed PAT)  
✅ **Scalable** (grows with user base)  
✅ **Respects user permissions** (each user's own access)

### How It Works

1. **Sign In** - When users sign in with GitHub OAuth, we now:
   - Request the `repo` scope for API access
   - Capture the OAuth access token from the sign-in result
   - Store it in localStorage with a timestamp

2. **API Calls** - All GitHub API requests now:
   - Check if user is authenticated
   - Retrieve the stored OAuth token
   - Include `Authorization: Bearer <token>` header
   - Fall back to unauthenticated if no token

3. **Token Lifecycle**:
   - Stored in localStorage (persists across sessions)
   - Expires after 60 days for security
   - Cleared on sign-out

### Files Changed

#### 1. [src/modules/auth.js](c:\Users\jesse\prompt-sharing\src\modules\auth.js)
- `signInWithGitHub()`: Added `repo` scope and token storage
- `signOutUser()`: Clear stored token

#### 2. [src/modules/github-api.js](c:\Users\jesse\prompt-sharing\src\modules\github-api.js)
- Added `getGitHubAccessToken()`: Retrieves token from localStorage
- Updated `fetchJSON()`: Includes Authorization header with token

#### 3. [src/utils/github-rate-limit.js](c:\Users\jesse\prompt-sharing\src\utils\github-rate-limit.js) (NEW)
- `checkRateLimit()`: Check current rate limit status
- `logRateLimit()`: Console logging utility
- `warnIfLowRateLimit()`: Warning when approaching limit

### Testing the Changes

#### Check if authenticated API calls are working:
```javascript
// In browser console
import { checkRateLimit, logRateLimit } from './src/utils/github-rate-limit.js';

// Check your current rate limit
await logRateLimit();
```

Expected output when **authenticated**:
```
GitHub API Rate Limit Status:
  Authenticated: Yes (5000/hr)
  Limit: 5000 requests/hour
  Remaining: 4998 requests
  Used: 0.0%
  Resets at: 1/12/2026, 3:45:23 PM
```

Expected output when **not authenticated**:
```
GitHub API Rate Limit Status:
  Authenticated: No (60/hr)
  Limit: 60 requests/hour
  Remaining: 58 requests
  Used: 3.3%
  Resets at: 1/12/2026, 2:45:23 PM
```

#### Verify token storage:
```javascript
// Check if token is stored
const tokenData = localStorage.getItem('github_access_token');
console.log(tokenData ? 'Token stored ✓' : 'No token stored');

// View token data (sanitized)
if (tokenData) {
  const data = JSON.parse(tokenData);
  console.log('Token age:', Math.round((Date.now() - data.timestamp) / 1000 / 60), 'minutes');
}
```

### Migration Notes

#### For existing users:
- Will need to **sign out and sign in again** to capture the OAuth token
- Previous sessions won't have the token stored

#### For new users:
- Automatically authenticated from first sign-in

### Security Considerations

1. **Token Storage**: Stored in localStorage (client-side only)
   - Not sent to your server
   - Only accessible to same origin
   - Cleared on sign-out

2. **Token Lifetime**: 
   - GitHub OAuth tokens don't expire unless revoked
   - We enforce 60-day refresh for security
   - User can revoke via GitHub settings

3. **Scope**: Only requests `repo` scope
   - Read/write access to repositories
   - Required for content API access

### Alternative Approaches Considered

#### ❌ Shared PAT via Cloudflare Worker
- **Problem**: 5,000 requests/hour shared by ALL users
- **Risk**: Single point of failure, token exposure
- **Not scalable**: Quickly exhausted with multiple users

#### ✅ User OAuth Tokens (Implemented)
- **Benefit**: 5,000 requests/hour PER USER
- **Secure**: Each user's own token, no shared secrets
- **Scalable**: Grows with user base

#### 🔄 Server-side Token Storage (Future Enhancement)
Could store tokens encrypted in Firestore:
- More secure (encrypted at rest)
- Centralized revocation
- But adds complexity and latency

### Future Enhancements

1. **Rate Limit UI Indicator**:
   - Show rate limit status in status bar
   - Warning when approaching limit

2. **Token Refresh**:
   - Automatic re-authentication prompt when token expires
   - Background token refresh

3. **Firestore Token Storage**:
   - Encrypt and store tokens server-side
   - Sync across devices

4. **Caching Strategy**:
   - Cache API responses to reduce calls
   - Smart invalidation

### Troubleshooting

#### "Still getting rate limited"
1. Check if user is signed in: Look for user avatar/name in header
2. Verify token is stored: Run `localStorage.getItem('github_access_token')`
3. Check rate limit: Run `await logRateLimit()` in console
4. If token missing: Sign out and sign in again

#### "API calls failing"
1. Check browser console for errors
2. Verify GitHub OAuth app has correct redirect URI
3. Check if token is expired (>60 days old)
4. Try revoking and re-authorizing

#### "Token not being stored"
1. Check localStorage permissions in browser
2. Verify Firebase Auth is working
3. Check for sign-in errors in console

### Monitoring

To monitor rate limit usage across your app, you can:

1. Add rate limit logging to key operations
2. Show warnings when users approach limits
3. Track authentication success rate

Example:
```javascript
import { warnIfLowRateLimit } from './src/utils/github-rate-limit.js';

// Before heavy API operations
if (await warnIfLowRateLimit(80)) {
  // Show user-friendly message
  console.log('Consider waiting for rate limit to reset');
}
```

## Summary

✨ **Your users now get 5,000 API requests per hour each**, using their existing GitHub authentication. No additional setup required!
