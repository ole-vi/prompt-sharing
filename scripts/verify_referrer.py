import sys
import time
import subprocess
from playwright.sync_api import sync_playwright

def verify_referrer():
    print("Starting server...")
    # Start server in background
    server_process = subprocess.Popen(["python3", "-m", "http.server", "3000"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(2) # Wait for server

    try:
        with sync_playwright() as p:
            print("Launching browser...")
            browser = p.chromium.launch()
            page = browser.new_page()

            print("Navigating to app...")
            page.goto("http://localhost:3000")
            page.wait_for_load_state("networkidle")

            # 1. Verify Meta Tag Injection
            print("Verifying meta tag...")
            meta_content = page.evaluate("""() => {
                const meta = document.querySelector('meta[name="referrer"]');
                return meta ? meta.content : null;
            }""")

            print(f"Meta Referrer Policy: {meta_content}")

            if meta_content == "origin":
                print("SUCCESS: Meta tag is 'origin' on localhost (as requested for debugging).")
            else:
                print(f"FAILURE: Expected 'origin' on localhost, got '{meta_content}'")
                sys.exit(1)

            # 2. Verify sanitizeHtml adds referrerpolicy attribute
            print("Verifying sanitizeHtml integration...")
            try:
                # We need to use module import path relative to the page
                sanitized_html = page.evaluate("""async () => {
                    // Try to dynamically import the module
                    const mod = await import('./src/modules/prompt-renderer.js');
                    return mod.sanitizeHtml('<img src="http://example.com/test.png">');
                }""")

                print(f"Sanitized HTML output: {sanitized_html}")

                if 'referrerpolicy="no-referrer"' in sanitized_html:
                    print("SUCCESS: sanitizeHtml adds 'referrerpolicy=\"no-referrer\"'")
                else:
                    print("FAILURE: sanitizeHtml did not add the attribute")
                    sys.exit(1)

            except Exception as e:
                print(f"Error testing sanitizeHtml: {e}")
                # Fallback: Check if we can just inspect the DOM if we can trigger rendering
                sys.exit(1)

            browser.close()
            print("Verification passed!")

    finally:
        print("Stopping server...")
        server_process.kill()

if __name__ == "__main__":
    verify_referrer()
