
import time
from playwright.sync_api import sync_playwright

def test_debounce():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # 1. Setup global mocks via init script
        page.add_init_script("""
            window.firebaseReady = true;
            window.auth = {
                currentUser: {
                    uid: 'test-user',
                    providerData: [{ providerId: 'github.com' }]
                },
                onAuthStateChanged: (cb) => {
                    cb({
                        uid: 'test-user',
                        providerData: [{ providerId: 'github.com' }]
                    });
                    return () => {};
                }
            };
            window.db = {};
            window.functions = {};
            localStorage.setItem('github_access_token', JSON.stringify({
                token: 'mock-token',
                timestamp: Date.now()
            }));
        """)

        # 2. Intercept Firebase scripts
        page.route("**/firebase-init.js", lambda route: route.fulfill(
            status=200,
            content_type="application/javascript",
            body="console.log('Firebase init mocked');"
        ))

        page.route("**/firebase-*.js", lambda route: route.fulfill(
            status=200,
            content_type="application/javascript",
            body="console.log('Firebase SDK mocked');"
        ))

        # 3. Mock GitHub API
        page.route("**/git/trees/**", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='''{
              "tree": [
                {
                  "path": "prompts/test-prompt.md",
                  "mode": "100644",
                  "type": "blob",
                  "sha": "abc",
                  "size": 100,
                  "url": "..."
                },
                {
                  "path": "prompts/other-prompt.md",
                  "mode": "100644",
                  "type": "blob",
                  "sha": "def",
                  "size": 100,
                  "url": "..."
                }
              ],
              "sha": "root-sha",
              "url": "..."
            }'''
        ))

        page.route("**/branches**", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='[{"name": "main", "commit": {"sha": "123", "url": "..."}}]'
        ))

        page.route("**/commits/**", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='{"sha": "123", "commit": {"committer": {"date": "2023-01-01"}}}'
        ))

        # Mock loading the header partial (even on localhost, just to be safe/fast)
        page.route("**/partials/header.html", lambda route: route.fulfill(
            status=200,
            content_type="text/html",
            body='<header>PromptRoot Header <div id="userMenuButton"></div><div id="userMenuDropdown"></div></header>'
        ))

        print("Navigating to http://localhost:3000/index.html")
        page.goto("http://localhost:3000/index.html")

        # Wait for the list to render initial items
        print("Waiting for list items...")
        try:
            page.wait_for_selector(".item", timeout=5000)
            print("List items loaded.")
        except:
            print("Timeout waiting for list items.")
            print(f"List element present: {page.evaluate('!!document.getElementById(\"list\")')}")
            # print(page.content())


        search_input = page.locator("#search")
        clear_btn = page.locator("#searchClear")

        if not search_input.is_visible():
            print("Search input not found!")
            return

        print("Typing 'test' in search...")
        search_input.type("test", delay=10)

        # 1. Immediate UI update
        if clear_btn.is_visible():
            print("SUCCESS: Clear button visible immediately")
        else:
            print("FAILURE: Clear button not visible immediately")

        # 2. Debounce Check
        visible_items = page.locator(".item:visible")
        count_immediate = visible_items.count()
        print(f"Items immediately after typing: {count_immediate}")

        if count_immediate == 2:
            print("SUCCESS: Render delayed (debounce working)")
        else:
            print(f"WARNING: List updated too fast (or empty). Count: {count_immediate}")

        # Wait for debounce
        print("Waiting 500ms for debounce...")
        page.wait_for_timeout(500)

        count_delayed = visible_items.count()
        print(f"Items after debounce: {count_delayed}")

        # We expect 0 items because "test" doesn't match "prompts/test-prompt.md" via Fuse?
        # Wait, "test" is in the name "test-prompt.md".
        # Fuse settings: keys: ['name', 'path', 'tags'], threshold 0.4.
        # "test" should match "test-prompt.md".
        # "other-prompt.md" should NOT match.
        # So we expect 1 item.

        if count_delayed == 1:
            print("SUCCESS: List filtered after debounce")
        else:
            print(f"FAILURE: List not filtered correctly. Count: {count_delayed}")

        page.screenshot(path="verification_debounce.png")
        print("Screenshot taken.")

        browser.close()

if __name__ == "__main__":
    test_debounce()
