
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Navigate to app
  await page.goto('http://localhost:3000');
  await page.waitForSelector('#main');

  // Trigger Jules Key Modal
  await page.evaluate(async () => {
    const { showJulesKeyModal } = await import('./src/modules/jules-modal.js');
    showJulesKeyModal();
  });

  // Wait for modal
  const modal = page.locator('#julesKeyModal');
  await modal.waitFor({ state: 'visible' });

  // Wait for focus trap to apply (it uses requestAnimationFrame)
  await page.waitForTimeout(200);

  // Check focus (programmatically, since screenshot won't show focus ring clearly in headless sometimes)
  const focusedId = await page.evaluate(() => {
    return document.activeElement.id;
  });
  console.log('Focused element ID:', focusedId);

  // Take screenshot
  await page.screenshot({ path: 'verification/jules_key_modal.png' });

  await browser.close();
})();
