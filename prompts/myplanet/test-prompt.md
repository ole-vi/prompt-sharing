# Test already existing code
REPO CONSTRAINTS
- Architecture: ViewModels + Repository pattern.
- Data layer: prefer RealmRepository (interface). Use a minimal FakeRealmRepository when needed.
- Lists: use ListAdapter + our DiffUtils.itemCallback(::ID_EXTRACTOR) if applicable.
- DI: Hilt modules should be tested with lightweight fakes, not full Hilt setup.
- Keep each test tiny, deterministic, and self-contained (no sleeps).
- Use the project’s existing JUnit4.13.2 and kotlinx-coroutines-test.
- No new runtime dependencies. Minimal imports; no unused code.


TEST REQUIREMENTS
1) Create exactly ONE test file at TEST_FILE_PATH mirroring PACKAGE_UNDER_TEST (e.g., app/src/test/java/.../ClassNameTest.kt).
2) Include 1–3 focused tests that cover the public API/observables of the class in this file. if possible generate 2 happy scenario and 1 negative scenario.
3) If it’s a ViewModel: 
   - Use runTest + StandardTestDispatcher.
   - Verify state emissions and that blocking work happens via withContext(Dispatchers.IO) indirectly (fake repo call recorded).
   - Expose LiveData/StateFlow read-only to the outside; assert values.
4) If it’s a RecyclerView adapter using DiffUtil/ListAdapter:
   - Use AsyncListDiffer or a ListUpdateCallback spy to assert insert/update/remove dispatches from submitList.
5) If it’s a repository or data helper:
   - Provide a minimal in-memory fake or stub for RealmRepository or Realm objects used.
   - Assert return values and side effects.
6) If it’s a DI module:
   - Verify that the binding resolves the correct implementation using a minimal manual graph or simple fetch via provider functions; no full Hilt runtime.

OUTPUT FORMAT
- A single compilable Kotlin test file with correct package, imports, and code.
- No explanations or comments—just the test file.

INPUT
FILE_PATH: [PASTE THE FILE PATH HERE]
PACKAGE_UNDER_TEST: [PASTE THE PACKAGE HERE]
TEST_FILE_PATH: [PASTE THE DESIRED TEST PATH HERE]
