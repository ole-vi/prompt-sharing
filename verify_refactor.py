from playwright.sync_api import sync_playwright, expect
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Create verification directory
    os.makedirs("/home/jules/verification", exist_ok=True)

    try:
        # 1. Verify Index Page Footer
        print("Verifying Index Page...")
        page.goto("http://localhost:3000/index.html")
        page.wait_for_selector("footer")

        # Check footer alignment
        footer = page.locator("footer")
        expect(footer).to_have_css("text-align", "center")

        # Check a footer link
        footer_link = page.locator(".footer-link").first
        expect(footer_link).to_have_css("color", "rgb(139, 148, 168)") # var(--muted) #8b94a8 is roughly this or computed

        # Check split modal config (hidden by default but we can check CSS rules or make it visible)
        # We can check if classes are present
        split_config = page.locator(".split-panel-config")
        # It is inside a modal which is hidden.
        # But we can check if the element exists and has classes.
        expect(split_config).to_have_class("split-panel-config")

        # Take screenshot at desktop size
        page.set_viewport_size({"width": 1280, "height": 800})
        page.screenshot(path="/home/jules/verification/index_desktop.png")
        print("Index Desktop screenshot taken.")

        # 2. Verify Privacy Page
        print("Verifying Privacy Page...")
        page.goto("http://localhost:3000/pages/privacy/privacy.html")

        # Force visibility just in case fonts fail to load in headless
        page.evaluate("document.body.style.visibility = 'visible'")

        # Check container
        container = page.locator(".privacy-container")
        expect(container).to_have_css("max-width", "900px")
        expect(container).to_have_css("margin-top", "40px")

        # Check responsive behavior
        # Mobile
        page.set_viewport_size({"width": 400, "height": 800})
        page.screenshot(path="/home/jules/verification/privacy_mobile_400.png")
        print("Privacy Mobile 400px screenshot taken.")

        # Tablet
        page.set_viewport_size({"width": 600, "height": 800})
        page.screenshot(path="/home/jules/verification/privacy_tablet_600.png")
        print("Privacy Tablet 600px screenshot taken.")

        # Desktop
        page.set_viewport_size({"width": 1000, "height": 800})
        page.screenshot(path="/home/jules/verification/privacy_desktop_1000.png")
        print("Privacy Desktop 1000px screenshot taken.")

        # 3. Verify Jules Page
        print("Verifying Jules Page...")
        page.goto("http://localhost:3000/pages/jules/jules.html")

        # Check header
        header = page.locator(".jules-header")
        expect(header).to_have_css("display", "flex")
        expect(header).to_have_css("justify-content", "space-between")

        page.screenshot(path="/home/jules/verification/jules_page.png")
        print("Jules Page screenshot taken.")

        print("Verification successful!")

    except Exception as e:
        print(f"Verification failed: {e}")
        # Take screenshot of failure
        page.screenshot(path="/home/jules/verification/failure.png")
        raise e
    finally:
        browser.close()

if __name__ == "__main__":
    with sync_playwright() as playwright:
        run(playwright)
