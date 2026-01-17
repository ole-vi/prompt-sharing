import re
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto('http://localhost:3000/')

        # Wait for list to load or fail
        try:
            page.wait_for_selector('#list', timeout=5000)
            page.wait_for_timeout(1000)
        except:
            print("Timeout waiting for list")

        # Take a screenshot
        page.screenshot(path='verification/refactored_state.png')

        # Check for specific elements that should exist if refactor worked
        # e.g. the toggle button icon
        # It should be a span with class 'icon' inside the button

        # We can try to select one toggle button and check its content
        toggles = page.query_selector_all('button[data-action="toggle-dir"]')
        print(f"Found {len(toggles)} toggle buttons")

        if toggles:
            first_toggle = toggles[0]
            # Check if it has the icon span
            icon = first_toggle.query_selector('span.icon')
            if icon:
                print(f"Toggle icon text: {icon.inner_text()}")
                print(f"Toggle icon class: {icon.get_attribute('class')}")
            else:
                print("Toggle icon NOT found inside button")

        browser.close()

if __name__ == '__main__':
    run()
