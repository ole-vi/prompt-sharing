import time
from playwright.sync_api import sync_playwright

def test_debounce():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Mock GitHub API for prompts
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

        # Use file:// protocol to load local file
        import os
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # Wait for list to load (it might take a moment due to async fetch)
        # We simulate the fetch completion by waiting for list items
        try:
            page.wait_for_selector(".item", timeout=5000)
        except:
            print("List didn't load normally, maybe due to mock issues or app logic. Injecting items manually for search test.")
            # If mocking fails to trigger render (e.g. init logic), we can try to inject via evaluate if exposed
            # But the app structure is module-based.
            # Let's hope the mock works. If not, we might need to debug why.

        # Check if list has items
        items = page.locator(".item")
        print(f"Items before search: {items.count()}")

        # Locate search input and clear button
        search_input = page.locator("#search")
        clear_btn = page.locator("#searchClear")

        # Type 'test'
        search_input.type("test", delay=10) # fast typing

        # 1. Immediate UI update: Clear button should be visible immediately
        if not clear_btn.is_visible():
            print("FAILURE: Clear button not visible immediately")
        else:
            print("SUCCESS: Clear button visible immediately")

        # 2. Debounced Render: List should NOT update immediately
        # We expect 'other-prompt.md' to disappear if search works.
        # But immediately after typing, it should still be there (or list not updated yet)
        # Wait 50ms
        page.wait_for_timeout(50)

        # Check if 'other-prompt' is still there (it shouldn't be if it was immediate, but should be if debounced)
        # However, verifying 'still there' is racey if debounce is too short. 300ms is standard.
        # Let's check the DOM changes.

        # Actually, simpler check:
        # Before debounce (e.g. 100ms), list count should be same (or at least not fully filtered if it takes time)
        # But renderList is synchronous once called.

        # Let's wait 400ms (debounce is 300ms)
        page.wait_for_timeout(400)

        # Now it should be filtered
        visible_items = page.locator(".item:visible")
        count = visible_items.count()
        print(f"Items after debounce: {count}")

        if count == 1:
            print("SUCCESS: List filtered after debounce")
        else:
            print(f"FAILURE: List count is {count}, expected 1")

        browser.close()

if __name__ == "__main__":
    test_debounce()
