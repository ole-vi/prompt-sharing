# Jules API Phase 1 Testing Guide

## 🎯 Testing the Performance Improvements

This guide helps you verify that Phase 1 optimizations are working correctly.

---

## Happy Path Testing Scenario

### Prerequisites
- Logged in user with a Jules API key configured
- At least 3-5 GitHub repos connected to Jules
- Chrome DevTools Console open (F12 → Console tab)

### Test 1: Profile Load Performance ⚡

**Goal:** Verify that branch data is fetched efficiently without redundant API calls

**Steps:**
1. Open your app and sign in
2. Open Chrome DevTools Console (F12)
3. Click on your username in the header to open the profile modal
4. Look for the "🔄 Refresh Jules Info" button and click it

**Expected Console Output:**
```
[Jules API] 🔑 Decrypting API key (cache miss)
[Jules API] ✅ API key decrypted and cached (15ms)
[Jules API] 🚀 Loading profile info for user...
[Jules API] 📡 Fetching sources and sessions in parallel...
[Jules API] 📡 Fetching sources...
[Jules API] 📡 Fetching sessions (pageSize: 10)...
[Jules API] ✅ Fetched 5 sources with 23 total branches (342ms)
[Jules API] ✅ Fetched 10 sessions (287ms)
[Jules API] ✅ Profile loaded: 5 sources, 23 branches, 10 sessions
[Jules API] ⚡ Total time: 687ms (saved 5 redundant API calls!)
```

**What to Verify:**
- ✅ Total time is under 1 second
- ✅ You see "saved X redundant API calls" message
- ✅ Branch count is displayed correctly
- ✅ NO individual `getJulesSourceDetails` API calls
- ✅ Sources list shows branches in the UI

---

### Test 2: API Key Cache Performance 🚀

**Goal:** Verify that API key decryption is cached and reused

**Steps:**
1. With profile modal still open, click "🔄 Refresh Jules Info" again
2. Watch the console output

**Expected Console Output (Second Load):**
```
[Jules API] ✅ API key cache HIT (age: 3s)
[Jules API] 🚀 Loading profile info for user...
[Jules API] 📡 Fetching sources and sessions in parallel...
[Jules API] 📡 Fetching sources...
[Jules API] 📡 Fetching sessions (pageSize: 10)...
[Jules API] ✅ Fetched 5 sources with 23 total branches (298ms)
[Jules API] ✅ Fetched 10 sessions (256ms)
[Jules API] ✅ Profile loaded: 5 sources, 23 branches, 10 sessions
[Jules API] ⚡ Total time: 598ms (saved 5 redundant API calls!)
```

**What to Verify:**
- ✅ You see "API key cache HIT" with age in seconds
- ✅ Total time is even faster (no decryption needed)
- ✅ Age increases each time you refresh

---

### Test 3: Cache Clearing on Logout 🗑️

**Goal:** Verify that API key cache is cleared when signing out

**Steps:**
1. Close the profile modal
2. Click sign out
3. Watch the console

**Expected Console Output:**
```
[Jules API] 🗑️ Cleared API key cache for user: abc123xyz...
```

**What to Verify:**
- ✅ Cache clear message appears
- ✅ User ID is shown in the message

---

### Test 4: Branch Data Display 🌿

**Goal:** Verify branches are displayed correctly in the UI

**Steps:**
1. Sign back in
2. Open profile modal
3. Look at your connected repositories section

**What to Verify:**
- ✅ Each repo shows branch count: "(X branches)"
- ✅ Click the arrow to expand and see branch list
- ✅ All branches are displayed
- ✅ Clicking a branch opens it on GitHub

---

### Test 5: Multiple Refresh Cycles 🔄

**Goal:** Test performance consistency over multiple loads

**Steps:**
1. Click "🔄 Refresh Jules Info" 5 times in a row
2. Watch console for timing patterns

**Expected Pattern:**
```
Load 1: ~700ms (cache miss - decryption needed)
Load 2: ~600ms (cache hit - no decryption)
Load 3: ~550ms (cache hit - warmed up)
Load 4: ~520ms (cache hit - optimal)
Load 5: ~510ms (cache hit - optimal)
```

**What to Verify:**
- ✅ First load is slightly slower (decryption)
- ✅ Subsequent loads are consistently faster
- ✅ Times stabilize after 2-3 loads
- ✅ No errors or warnings

---

## Performance Benchmarks

### Before Phase 1 (Baseline)
```
Profile Load Time: ~5000ms
API Calls: 2 + N (N = number of repos)
Example: 10 repos = 12 API calls
```

### After Phase 1 (Optimized)
```
Profile Load Time: ~600ms
API Calls: 2 (sources + sessions)
Example: 10 repos = 2 API calls
```

### Expected Improvements
- **Speed:** 8-10x faster
- **API Calls:** 83% reduction (12 → 2 calls for 10 repos)
- **Bandwidth:** 90% reduction in data transfer

---

## Console Logging Reference

### Log Symbols
- 🚀 = Major operation starting
- 📡 = API call initiated
- ✅ = Success / completion
- 🔑 = Key decryption
- 🗑️ = Cache cleared
- ⚡ = Performance metric

### Log Levels
All logs use `console.log()` for easy visibility. No errors should appear unless there's a real problem.

---

## Troubleshooting

### Issue: No logs appear
**Solution:** Make sure you're looking at the Console tab in DevTools, not Network or Elements

### Issue: Still seeing getJulesSourceDetails calls
**Solution:** Hard refresh the page (Ctrl+Shift+R) to clear old cached JavaScript

### Issue: Cache always shows "miss"
**Solution:** Check that clearJulesKeyCache isn't being called unexpectedly

### Issue: Branches not showing in UI
**Solution:** 
1. Check console for the branch count in "Fetched X sources with Y total branches"
2. Verify `source.githubRepo.branches` exists in the data
3. Check that your repos actually have branches in Jules

### Issue: Performance isn't much better
**Possible causes:**
- Network is very slow (check Network tab)
- Many repos (>20) may still take time
- Database read for key is slow
- Your Jules account has limited data

---

## Manual Network Tab Verification

Want to see the API calls directly?

### Steps:
1. Open DevTools → Network tab
2. Filter by "jules.googleapis.com"
3. Click "🔄 Refresh Jules Info"

### What You Should See:
```
GET https://jules.googleapis.com/v1alpha/sources
GET https://jules.googleapis.com/v1alpha/sessions?pageSize=10
```

### What You Should NOT See:
```
❌ GET https://jules.googleapis.com/v1alpha/sources/github/owner/repo1
❌ GET https://jules.googleapis.com/v1alpha/sources/github/owner/repo2
❌ GET https://jules.googleapis.com/v1alpha/sources/github/owner/repo3
... (etc)
```

**If you see multiple source detail calls, the optimization didn't work!**

---

## Success Criteria Checklist

- [ ] Profile loads in under 1 second
- [ ] Only 2 API calls to Jules (sources + sessions)
- [ ] Branches display correctly in UI
- [ ] Cache hit messages appear on subsequent loads
- [ ] Cache clears on logout
- [ ] No errors or warnings in console
- [ ] All repos and branches are visible
- [ ] "Saved X redundant API calls" message appears

---

## Next Steps

Once all tests pass:
1. ✅ Mark Phase 1 as complete
2. ✅ Monitor in production for any issues
3. ✅ Proceed to Phase 2 (Code Quality improvements)

---

## Quick Test Command

Paste this in console for a quick automated test:

```javascript
// Quick Phase 1 Test
(async function testPhase1() {
  console.log('🧪 Starting Phase 1 Test...');
  
  const user = window.auth?.currentUser;
  if (!user) {
    console.error('❌ Not logged in!');
    return;
  }
  
  const { loadJulesProfileInfo } = await import('./src/modules/jules-api.js');
  
  console.log('\n📊 Test 1: First Load (cache miss)');
  const start1 = performance.now();
  const data1 = await loadJulesProfileInfo(user.uid);
  const time1 = Math.round(performance.now() - start1);
  
  console.log('\n📊 Test 2: Second Load (cache hit)');
  const start2 = performance.now();
  const data2 = await loadJulesProfileInfo(user.uid);
  const time2 = Math.round(performance.now() - start2);
  
  console.log('\n✅ RESULTS:');
  console.log(`   First load: ${time1}ms`);
  console.log(`   Second load: ${time2}ms`);
  console.log(`   Speedup: ${Math.round(time1/time2)}x`);
  console.log(`   Sources: ${data1.sources.length}`);
  console.log(`   Sessions: ${data1.sessions.length}`);
  console.log(`   Total branches: ${data1.sources.reduce((s, src) => s + (src.githubRepo?.branches?.length || 0), 0)}`);
  
  if (time1 < 1000 && time2 < time1) {
    console.log('\n🎉 Phase 1 optimizations working correctly!');
  } else {
    console.warn('\n⚠️ Performance may need investigation');
  }
})();
```

---

**Happy Testing! 🚀**
