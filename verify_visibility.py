from playwright.sync_api import sync_playwright, expect

def verify_visibility(page):
    page.goto("http://localhost:3000")

    # 1. Verify editBtn is hidden (it has class hidden now)
    edit_btn = page.locator("#editBtn")
    expect(edit_btn).not_to_be_visible()

    # Verify it has class 'hidden'
    classes = edit_btn.get_attribute("class")
    print(f"EditBtn classes: {classes}")
    assert "hidden" in classes

    # 2. Verify Free Input section toggling
    free_input_section = page.locator("#freeInputSection")

    # Check current state (expecting hidden or visible, but should toggle correctly)
    if free_input_section.is_visible():
        print("Free Input section is initially visible.")
        section_classes = free_input_section.get_attribute("class")
        assert "hidden" not in section_classes

        # Click Cancel to hide it
        page.locator("#freeInputCancelBtn").click()
        expect(free_input_section).not_to_be_visible()
        section_classes = free_input_section.get_attribute("class")
        assert "hidden" in section_classes
        print("Verified hiding works.")

    # Click Free Input button to show/toggle it
    page.locator("#freeInputBtn").click()
    expect(free_input_section).to_be_visible()
    section_classes = free_input_section.get_attribute("class")
    assert "hidden" not in section_classes
    print("Verified showing works.")

    # Take screenshot
    page.screenshot(path="verification_visibility.png")
    print("Verification screenshot saved.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify_visibility(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification_error.png")
        finally:
            browser.close()
