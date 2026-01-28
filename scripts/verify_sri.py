import sys
import threading
import http.server
import socketserver
import time
from playwright.sync_api import sync_playwright, expect

PORT = 8081
SERVER_URL = f"http://localhost:{PORT}"

def run_server():
    # Helper to prevent "Address already in use"
    socketserver.TCPServer.allow_reuse_address = True
    Handler = http.server.SimpleHTTPRequestHandler
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Serving at port {PORT}")
        httpd.serve_forever()

def verify_page(page, url_path, screenshot_name=None):
    print(f"Verifying {url_path}...")

    # Capture console errors
    console_errors = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

    page.goto(f"{SERVER_URL}/{url_path}")

    # Wait a bit for scripts to load and init
    page.wait_for_timeout(5000)

    # Check for SRI errors
    sri_error = False
    for error in console_errors:
        print(f"Console Error: {error}")
        if "integrity" in error.lower() or "subresource integrity" in error.lower():
            sri_error = True

    if sri_error:
        raise Exception(f"SRI Error detected on {url_path}")

    # Check if firebase is initialized (window.auth)
    try:
        # Check window.auth
        # We wait for it to be defined
        try:
             page.wait_for_function("typeof window.auth !== 'undefined'", timeout=5000)
             print(f"SUCCESS: window.auth found on {url_path}.")
        except:
             print(f"WARNING: window.auth NOT found on {url_path} after timeout.")
             # We don't raise exception immediately but it is suspicious if we expect it to load
             # However, without valid config/network, init might fail but scripts should load.
             # If SRI failed, scripts wouldn't execute at all.
             # If scripts execute but init fails (e.g. config), that's fine for SRI check.
             # We verified NO SRI errors above.

        # Check window.firebase global from compat scripts
        is_firebase = page.evaluate("typeof firebase !== 'undefined'")
        if is_firebase:
            print(f"SUCCESS: firebase global found on {url_path}.")
        else:
            print(f"FAILURE: firebase global NOT found on {url_path}. Scripts might not have loaded.")
            raise Exception("Firebase global not found")

    except Exception as e:
        print(f"Error checking firebase on {url_path}: {e}")
        raise e

    if screenshot_name:
        page.screenshot(path=f"/home/jules/verification/{screenshot_name}")

def main():
    # Start server in background
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()

    # Give server a moment to start
    time.sleep(2)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()

            verify_page(page, "index.html", "index_sri.png")
            verify_page(page, "pages/jules/jules.html")
            verify_page(page, "pages/queue/queue.html")

            browser.close()
            print("Verification successful!")

    except Exception as e:
        print(f"Verification failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
