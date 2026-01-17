from playwright.sync_api import sync_playwright, expect
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Assuming the server is running on port 3000 as per previous context
        # Or I can just load the file directly since it is static?
        # The app uses modules so it needs a server ideally, but let's try file if server not running.
        # But wait, I can start a server.

        # Let's assume I need to start a server. But for now I will try to access the file via local server I will start.
        page.goto("http://localhost:3000/pages/privacy/privacy.html")

        # Check title
        expect(page).to_have_title("Privacy Policy - PromptRoot")

        # Check for font-init (check if font class or something is present, or just console log?)
        # font-init.js loads fonts.

        # Check text content
        expect(page.get_by_role("heading", name="Privacy Policy")).to_be_visible()
        expect(page.get_by_text("Last updated: January 15, 2026")).to_be_visible()

        # Check footer
        footer = page.locator("footer")
        expect(footer).to_be_visible()
        expect(footer.get_by_role("link", name="Privacy Policy")).to_be_visible()

        # Screenshot
        page.screenshot(path="verification/privacy_verification.png")

        browser.close()

if __name__ == "__main__":
    run()
