import asyncio
from playwright.async_api import async_playwright, expect
import os
import sys

# Ensure we can import local modules if needed (not strict for this script)
sys.path.append(os.getcwd())

async def verify_styles():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # 1. Verify index.html (Split Modal Styles)
        print("Verifying index.html...")
        # Load local file
        await page.goto(f"file://{os.getcwd()}/index.html")

        # Patch for font loading visibility issue
        await page.evaluate("document.body.style.visibility = 'visible'")

        # Check #splitEditPanel for scroll styles
        split_panel = page.locator("#splitEditPanel")
        import re
        await expect(split_panel).to_have_class(re.compile(r"split-scroll-container"))

        # Verify computed styles for split panel
        max_height = await split_panel.evaluate("el => getComputedStyle(el).maxHeight")
        overflow_y = await split_panel.evaluate("el => getComputedStyle(el).overflowY")
        print(f"Split Panel - Max Height: {max_height}, Overflow Y: {overflow_y}")

        if max_height != "400px" and max_height != "400": # Browser might normalize
             print(f"WARNING: Unexpected max-height: {max_height}")

        # Check .split-panel-config
        config_panel = page.locator(".split-panel-config").first
        if await config_panel.count() > 0:
            bg_color = await config_panel.evaluate("el => getComputedStyle(el).backgroundColor")
            padding = await config_panel.evaluate("el => getComputedStyle(el).padding")
            margin_bottom = await config_panel.evaluate("el => getComputedStyle(el).marginBottom")
            print(f"Config Panel - BG: {bg_color}, Padding: {padding}, MarginBottom: {margin_bottom}")
        else:
            print("ERROR: .split-panel-config not found in DOM")

        # Check .label-flex
        label_flex = page.locator(".label-flex").first
        if await label_flex.count() > 0:
            display = await label_flex.evaluate("el => getComputedStyle(el).display")
            gap = await label_flex.evaluate("el => getComputedStyle(el).gap")
            cursor = await label_flex.evaluate("el => getComputedStyle(el).cursor")
            font_size = await label_flex.evaluate("el => getComputedStyle(el).fontSize")
            print(f"Label Flex - Display: {display}, Gap: {gap}, Cursor: {cursor}, FontSize: {font_size}")
            if display != "flex":
                print("ERROR: .label-flex is not display: flex")
            if cursor != "pointer":
                print("ERROR: .label-flex is not cursor: pointer")
        else:
             print("ERROR: .label-flex not found in DOM")


        # 2. Verify webcapture.html (Button Padding)
        print("\nVerifying webcapture.html...")
        await page.goto(f"file://{os.getcwd()}/pages/webcapture/webcapture.html")
        await page.evaluate("document.body.style.visibility = 'visible'")

        btn_xs = page.locator(".btn-padding-xs").first
        if await btn_xs.count() > 0:
            padding_top = await btn_xs.evaluate("el => getComputedStyle(el).paddingTop")
            padding_bottom = await btn_xs.evaluate("el => getComputedStyle(el).paddingBottom")
            font_size = await btn_xs.evaluate("el => getComputedStyle(el).fontSize")
            print(f"Btn XS - Padding Top: {padding_top}, Bottom: {padding_bottom}, Font Size: {font_size}")
            # Expected: 2px 8px -> top/bottom 2px. Font 11px.
        else:
            print("ERROR: .btn-padding-xs not found in webcapture.html")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_styles())
