
from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 720})
        page = context.new_page()

        # Load the page
        page.goto("http://localhost:3000")

        # Wait for the app to initialize
        page.wait_for_selector("#search", state="visible")

        # Trigger "No prompts found"
        # Type a search query that won't match anything
        page.fill("#search", "this_string_should_not_exist_in_prompts_12345")

        # Wait for the list to update. We expect "No prompts found."
        # The code creates a div with text "No prompts found." and class "color-muted pad-8"
        # We can look for text "No prompts found." and check its classes.

        # Wait for the element
        locator = page.get_by_text("No prompts found.")
        locator.wait_for(state="visible", timeout=5000)

        # Verify classes
        # Note: Playwright's to_have_class checks for exact class list or partial with regex
        # The element should have 'color-muted' and 'pad-8'.
        # Since I added 'color-muted pad-8' (and maybe 'text-center' was considered but I didn't add it in the end? Let me check my code).
        # Checking my code: createElement('div', 'color-muted pad-8')

        expect(locator).to_have_class("color-muted pad-8")

        # Take screenshot
        page.screenshot(path="verification/empty_state.png")
        print("Empty state verification passed.")

        browser.close()

if __name__ == "__main__":
    run()
