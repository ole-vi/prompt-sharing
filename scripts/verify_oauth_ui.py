from playwright.sync_api import sync_playwright

def verify(page):
    print("Navigating to setup storage...")
    page.goto("http://localhost:3000/oauth-callback.html")
    page.evaluate("sessionStorage.setItem('oauth_nonce', 'test-nonce')")

    print("Navigating with params...")
    page.goto("http://localhost:3000/oauth-callback.html?code=test-code&state=webapp-test-nonce")

    print("Waiting for error message (expected due to network failure)...")
    try:
        page.wait_for_selector(".error", timeout=5000)
        print("Error element found.")
    except:
        print("Error element not found within timeout.")

    page.screenshot(path="oauth_verification.png")
    print("Screenshot saved.")

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    try:
        verify(page)
    except Exception as e:
        print(f"Error: {e}")
    finally:
        browser.close()
