# Jules API Integration - Developer Reference

## Quick Start

### For Users
1. Sign in with GitHub
2. Click your username in the header
3. Click "➕ Add Jules API Key" 
4. Paste your Jules API key from https://jules.google.com (Settings → API Keys)
5. Your connected repos, branches, and recent sessions will automatically appear

### For Developers

#### Using the Jules API Client

```javascript
import { 
  loadJulesProfileInfo,
  listJulesSources,
  getJulesSourceDetails,
  listJulesSessions,
  getJulesSession,
  createJulesSession,
  getJulesSessionActivities,
  approveJulesSessionPlan
} from './modules/jules-api.js';

// Load complete profile (sources + sessions)
const profile = await loadJulesProfileInfo(uid);
console.log(profile.sources);   // Array of sources with branches
console.log(profile.sessions);  // Array of recent sessions

// Or use individual functions
const apiKey = await getDecryptedJulesKey(uid);
const sources = await listJulesSources(apiKey);
const sourceDetails = await getJulesSourceDetails(apiKey, 'sources/123');
const sessions = await listJulesSessions(apiKey, 10);
```

#### Creating a Jules Session

```javascript
import { createJulesSession } from './modules/jules-api.js';

const session = await createJulesSession(apiKey, {
  prompt: 'Fix all TypeScript errors',
  sourceId: 'sources/my-repo-123',
  branch: 'main',
  autoCreatePR: true,              // Optional: auto-create PR
  requirePlanApproval: false       // Optional: require approval
});

console.log(session.id);           // Use to poll for results
```

#### Monitoring Session Progress

```javascript
import { getJulesSession, getJulesSessionActivities } from './modules/jules-api.js';

// Poll for session status
const checkSession = async (sessionId) => {
  const session = await getJulesSession(apiKey, sessionId);
  console.log(session.state);  // QUEUED, PLANNING, IN_PROGRESS, COMPLETED, FAILED
  
  if (session.state === 'COMPLETED') {
    console.log(session.outputs[0].pullRequest.url);  // PR URL if created
  }
};

// Get execution logs
const activities = await getJulesSessionActivities(apiKey, sessionId);
console.log(activities);  // Full execution trace with tool use, patches, etc.
```

## API Reference

### Constants
```javascript
JULES_API_BASE = "https://jules.googleapis.com/v1alpha"
```

### Available Functions

#### `getDecryptedJulesKey(uid: string): Promise<string|null>`
Retrieves and decrypts the user's stored Jules API key.

#### `listJulesSources(apiKey: string): Promise<Object>`
Lists all connected repositories (sources).
```javascript
// Returns: { sources: [{ id, name, githubRepo }] }
```

#### `getJulesSourceDetails(apiKey: string, sourceId: string): Promise<Object>`
Gets detailed information for a source including branches.
```javascript
// Returns: { id, name, githubRepo: { branches: [{ displayName }] } }
```

#### `listJulesSessions(apiKey: string, pageSize: number): Promise<Object>`
Lists recent Jules sessions.
```javascript
// Returns: { sessions: [{ id, state, prompt, createTime, outputs }] }
```

#### `getJulesSession(apiKey: string, sessionId: string): Promise<Object>`
Gets details for a specific session.
```javascript
// Returns: { id, state, prompt, outputs: [{ pullRequest: { url, title } }] }
```

#### `getJulesSessionActivities(apiKey: string, sessionId: string): Promise<Object>`
Gets execution logs and activities.
```javascript
// Returns: { activities: [{ planGenerated, progressUpdated, gitPatch, sessionCompleted }] }
```

#### `createJulesSession(apiKey: string, config: Object): Promise<Object>`
Creates a new Jules session.
```javascript
// Config: { prompt, sourceId, branch, autoCreatePR?, requirePlanApproval? }
// Returns: { id, state, ... } (poll for completion)
```

#### `approveJulesSessionPlan(apiKey: string, sessionId: string): Promise<Object>`
Approves a session plan when paused.

#### `loadJulesProfileInfo(uid: string): Promise<Object>`
Comprehensive function that loads all profile data.
```javascript
// Returns: { 
//   sources: [{ id, name, githubRepo, branches: [...] }],
//   sessions: [{ id, state, prompt, outputs, ... }]
// }
```

## Session States

| State | Emoji | Description |
|-------|-------|-------------|
| `QUEUED` | ⏸️ | Session is waiting to start |
| `PLANNING` | 📋 | Jules is creating a plan |
| `IN_PROGRESS` | ⏳ | Jules is executing the plan |
| `COMPLETED` | ✅ | Session completed successfully |
| `FAILED` | ❌ | Session encountered an error |

## Error Handling

All API functions throw errors with descriptive messages:

```javascript
try {
  const profile = await loadJulesProfileInfo(uid);
} catch (error) {
  if (error.message.includes('No Jules API key')) {
    // User needs to add API key
  } else {
    // Other API error
    console.error('API Error:', error);
  }
}
```

## UI Components

### Profile Modal Elements
- `#julesProfileInfoSection` - Main container (hidden by default)
- `#julesSourcesList` - Connected repositories list
- `#julesSessionsList` - Recent sessions list
- `#loadJulesInfoBtn` - Refresh button
- `#julesKeyStatus` - API key status indicator

### Styling Classes
- Custom scrollbars on sources/sessions lists
- Fade-in animation for profile section
- Hover effects on links and buttons
- Loading states with disabled styling

## Architecture

```
User Profile Modal
    ↓
showUserProfileModal() [jules.js]
    ↓
checkJulesKey() → Has key?
    ↓ YES
loadAndDisplayJulesProfile() [jules.js]
    ↓
loadJulesProfileInfo() [jules-api.js]
    ↓
[Parallel] listJulesSources() + listJulesSessions()
    ↓
[Sequential] getJulesSourceDetails() for each source
    ↓
Return: { sources: [...], sessions: [...] }
    ↓
Render in modal with formatting
```

## Example: Full Integration

```javascript
// In a custom feature
import { getCurrentUser } from './auth.js';
import { loadJulesProfileInfo, createJulesSession } from './jules-api.js';

async function runPromptOnJules(promptText) {
  const user = getCurrentUser();
  if (!user) return;
  
  // Load profile to get available sources
  const profile = await loadJulesProfileInfo(user.uid);
  const firstSource = profile.sources[0];
  
  if (!firstSource) {
    alert('No connected repositories. Connect a repo in Jules first.');
    return;
  }
  
  // Create session
  const session = await createJulesSession(apiKey, {
    prompt: promptText,
    sourceId: firstSource.id,
    branch: 'main',
    autoCreatePR: true
  });
  
  // Open Jules session
  const sessionUrl = `https://jules.google.com/sessions/${session.id}`;
  window.open(sessionUrl, '_blank');
}
```

## Testing

### Manual Testing Checklist
- [ ] User can add API key
- [ ] Profile loads sources automatically
- [ ] Profile loads sessions automatically
- [ ] Branches display correctly (max 5 shown)
- [ ] Session states show correct emoji
- [ ] PR links open in new tabs
- [ ] Refresh button works
- [ ] Loading states display correctly
- [ ] Error states display correctly
- [ ] Empty states display correctly
- [ ] Modal scrolls properly with many items
- [ ] Mobile responsive layout works

### Test with Different States
```javascript
// No API key
// Empty sources list
// Empty sessions list
// Many sources (test scrolling)
// Many sessions (test scrolling)
// Failed API calls (test error handling)
```

## Future Enhancements

### Potential Features
1. **Real-time Updates**: Poll sessions for status updates
2. **Session Management**: Cancel, retry failed sessions
3. **Activity Viewer**: Show detailed execution logs
4. **Source Filtering**: Filter sessions by repository
5. **Search**: Search through sessions by prompt text
6. **Direct Creation**: Create sessions from PromptSync UI
7. **Notifications**: Alert when sessions complete
8. **Analytics**: Session success rates, common patterns

### API Limitations to Work Around
- No webhooks → Use polling for real-time updates
- No cancel API → Store session IDs, show warning
- No create repo API → Direct users to Jules UI
- Alpha API → Handle breaking changes gracefully

## Support Resources

- **Jules API Docs**: https://jules.googleapis.com/docs
- **Jules UI**: https://jules.google.com
- **Get API Key**: https://jules.google.com (Settings → API Keys)
- **GitHub App**: Install from Jules UI to connect repos

## Security Notes

⚠️ **Important Security Practices**
- API keys are encrypted with AES-GCM before storage
- Keys use user UID as encryption key (32 bytes, padded)
- Never log API keys to console
- Always use HTTPS for API calls
- Don't expose API keys in error messages
- Validate all user inputs before API calls

---

For questions or issues, check the main integration doc: `JULES_API_INTEGRATION.md`
