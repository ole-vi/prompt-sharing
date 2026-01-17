from playwright.sync_api import sync_playwright, expect
import os

def run():
    os.makedirs("/home/jules/verification", exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto("http://localhost:3000/index.html")

            # Expect title
            expect(page).to_have_title("PromptRoot")

            # Expect shared header (wait for it to appear, might take 50ms * retries)
            expect(page.locator("header")).to_be_visible(timeout=10000)

            # Expect sidebar
            expect(page.locator("#sidebar")).to_be_visible()

            # Expect free input button (loaded by js)
            expect(page.locator("#freeInputBtn")).to_be_visible()

            # Take screenshot
            page.screenshot(path="/home/jules/verification/index_verified.png")
            print("Verification successful")
        except Exception as e:
            print(f"Verification failed: {e}")
            try:
                page.screenshot(path="/home/jules/verification/error.png")
            except:
                pass
        finally:
            browser.close()

if __name__ == "__main__":
    run()
