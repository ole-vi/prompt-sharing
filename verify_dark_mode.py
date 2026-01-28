from playwright.sync_api import sync_playwright, expect
import re

def verify_dark_mode():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Create a context with dark mode preference
        context = browser.new_context(color_scheme='dark')
        page = context.new_page()

        try:
            page.goto("http://localhost:3000/")

            # Wait for body to be visible
            page.wait_for_selector('body')

            # Check if html has 'dark' class
            # We use re because class might be "dark" or "dark other-class"
            html = page.locator('html')
            expect(html).to_have_class(re.compile(r'\bdark\b'))

            print("Dark mode class found on html element due to system preference")

            page.screenshot(path="verification_dark.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification_error.png")
            raise e
        finally:
            browser.close()

if __name__ == "__main__":
    verify_dark_mode()
