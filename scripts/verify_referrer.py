import sys
import time
import subprocess
from playwright.sync_api import sync_playwright

PORT = 3000
BASE_URL = f"http://localhost:{PORT}"
PAGES = [
    "index.html",
    "pages/jules/jules.html",
    "pages/queue/queue.html",
    "pages/sessions/sessions.html",
    "pages/profile/profile.html",
    "pages/webcapture/webcapture.html",
    "oauth-callback.html"
]

def start_server():
    print(f"Starting server on port {PORT}...")
    # Kill any existing process on port 3000
    subprocess.run("kill $(lsof -t -i :3000) 2>/dev/null || true", shell=True)

    proc = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(2) # Wait for server to start
    return proc

def verify_page(page, url_path):
    full_url = f"{BASE_URL}/{url_path}"
    print(f"\nTesting {full_url}...")

    try:
        page.goto(full_url)
    except Exception as e:
        print(f"Failed to load {full_url}: {e}")
        return False

    # Check meta tag
    meta_tag = page.locator('meta[name="referrer"][content="strict-origin-when-cross-origin"]')
    if meta_tag.count() > 0:
        print("PASS: Meta tag found.")
    else:
        print("FAIL: Meta tag NOT found.")

    # Check Cross-Origin Referer
    cross_origin_referer = None
    def handle_request(request):
        nonlocal cross_origin_referer
        if request.url.startswith("https://example.com"):
            headers = request.headers
            cross_origin_referer = headers.get("referer")

    page.on("request", handle_request)

    # Trigger cross-origin request
    try:
        page.evaluate("fetch('https://example.com', {mode: 'no-cors'}).catch(e => {})")
        page.wait_for_timeout(1000) # Wait for request
    except Exception as e:
        print(f"Error triggering fetch: {e}")

    page.remove_listener("request", handle_request)

    if cross_origin_referer:
        if cross_origin_referer == f"{BASE_URL}/":
             print(f"PASS: Cross-origin Referer is '{cross_origin_referer}' (Origin only).")
        else:
             print(f"FAIL: Cross-origin Referer is '{cross_origin_referer}'. Expected '{BASE_URL}/'.")
    else:
        print("FAIL: No cross-origin request detected.")

    # Check Same-Origin Referer
    same_origin_referer = None
    def handle_same_request(request):
        nonlocal same_origin_referer
        if request.url.endswith("favicon.ico"):
            headers = request.headers
            same_origin_referer = headers.get("referer")

    page.on("request", handle_same_request)

    # Trigger same-origin request
    try:
        page.evaluate("fetch('/assets/favicon.ico').catch(e => {})")
        page.wait_for_timeout(1000)
    except Exception as e:
         print(f"Error triggering same-origin fetch: {e}")

    page.remove_listener("request", handle_same_request)

    # Take screenshot for verification
    if url_path == "index.html":
        page.screenshot(path="verification.png")
        print("Screenshot saved to verification.png")

    if same_origin_referer:
        # Expected referer is the full URL
        expected_referer = full_url
        if same_origin_referer == expected_referer:
             print(f"PASS: Same-origin Referer is '{same_origin_referer}' (Full path).")
        else:
             print(f"FAIL: Same-origin Referer is '{same_origin_referer}'. Expected '{expected_referer}'.")
    else:
        print("FAIL: No same-origin request detected.")

def run_tests():
    server_proc = start_server()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()

            for url_path in PAGES:
                verify_page(page, url_path)

            browser.close()
    finally:
        print("Stopping server...")
        server_proc.terminate()
        server_proc.wait()

if __name__ == "__main__":
    run_tests()
