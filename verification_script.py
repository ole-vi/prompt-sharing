from playwright.sync_api import sync_playwright, expect

def test_branch_selector(page):
    # 1. Go to the homepage
    page.goto("http://localhost:3000")

    # 2. Wait for the header to be injected
    # The header is loaded dynamically, so wait for branchSelect
    branch_select = page.locator("#branchSelect")
    branch_select.wait_for(state="attached", timeout=5000)

    # 3. Take a screenshot of the initial state (might be Loading...)
    page.screenshot(path="/home/jules/verification/branch_selector_loading.png")

    # 4. Check if options are present (even if it's just Loading)
    options = branch_select.locator("option")
    count = options.count()
    print(f"Found {count} options")

    # Check text of first option
    first_text = options.first.text_content()
    print(f"First option text: {first_text}")

    # If GitHub API fails (likely in this env without proper tokens/CORS setup maybe?),
    # it might go to error state or stay loading.
    # We just want to ensure the element is there and not broken HTML.

    # Wait a bit to see if it populates (it might fail and revert to current branch)
    page.wait_for_timeout(2000)
    page.screenshot(path="/home/jules/verification/branch_selector_after_wait.png")

    final_text = options.first.text_content()
    print(f"Option text after wait: {final_text}")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_branch_selector(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
