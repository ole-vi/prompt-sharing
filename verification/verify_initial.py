import re
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto('http://localhost:3000/')

        # Wait for list to load or fail (timeout after 5s if nothing happens)
        try:
            page.wait_for_selector('#list', timeout=5000)
            # Give it a bit more time for content to populate
            page.wait_for_timeout(1000)
        except:
            print("Timeout waiting for list")

        # Take a screenshot of the list area
        page.screenshot(path='verification/initial_state.png')

        # Log the content of the list to see what's in there
        list_content = page.inner_html('#list')
        print(f"List Content Length: {len(list_content)}")

        browser.close()

if __name__ == '__main__':
    run()
