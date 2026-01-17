
from playwright.sync_api import sync_playwright, expect

def verify_aria(page):
    page.goto("http://localhost:3000")

    # Wait for page to load (header is injected)
    page.wait_for_selector("header")

    print("Checking static dropdowns...")
    # Check static dropdowns in index.html
    dropdown_btns = [
        "#freeInputRepoDropdownBtn",
        "#freeInputBranchDropdownBtn",
        "#julesRepoDropdownBtn",
        "#julesBranchDropdownBtn"
    ]

    for selector in dropdown_btns:
        btn = page.locator(selector)
        if btn.is_visible():
            expect(btn).to_have_attribute("aria-haspopup", "true")
            # expect(btn).to_have_attribute("aria-expanded", "false") # Might be false by default
            print(f"Verified {selector}")

    # Check static modals
    print("Checking static modals...")
    modals = [
        "#julesKeyModal",
        "#julesEnvModal",
        "#subtaskSplitModal",
        "#subtaskPreviewModal"
    ]

    for selector in modals:
        modal = page.locator(selector)
        expect(modal).to_have_attribute("role", "dialog")
        expect(modal).to_have_attribute("aria-modal", "true")
        expect(modal).to_have_attribute("aria-labelledby", re.compile(r".+"))
        print(f"Verified {selector}")

    # Check mobile sidebar (injected header)
    print("Checking mobile sidebar...")
    mobile_sidebar = page.locator("#mobileSidebar")
    expect(mobile_sidebar).to_have_attribute("role", "dialog")
    expect(mobile_sidebar).to_have_attribute("aria-modal", "true")
    expect(mobile_sidebar).to_have_attribute("aria-label", "Mobile navigation")
    print("Verified mobile sidebar")

    # Check mobile menu button
    mobile_btn = page.locator("#mobileMenuBtn")
    expect(mobile_btn).to_have_attribute("aria-expanded", "false")
    print("Verified mobile menu button")

    # Check icon buttons (sample)
    print("Checking icon buttons...")
    search_clear = page.locator("#searchClear")
    expect(search_clear).to_have_attribute("aria-label", "Clear search")

    copy_btn = page.locator("#copyBtn")
    # These might be hidden, so we check attribute existence if they exist in DOM
    expect(copy_btn).to_have_attribute("aria-label", "Copy the entire prompt")
    print("Verified icon buttons")

    # Take screenshot
    page.screenshot(path="verification/aria_verification.png")
    print("Screenshot taken")

if __name__ == "__main__":
    import re
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_aria(page)
        except Exception as e:
            print(f"Verification failed: {e}")
            page.screenshot(path="verification/error.png")
            raise e
        finally:
            browser.close()
