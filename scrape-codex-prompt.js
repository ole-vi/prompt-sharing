// scrape-codex-prompt.js
// Usage: node scrape-codex-prompt.js https://chatgpt.com/s/...
// Requires: node >= 16, npm i puppeteer

const fs = require('fs');
const readline = require('readline');

const url = process.argv[2];
if (!url) {
  console.error('Usage: node scrape-codex-prompt.js <share-url>');
  process.exit(1);
}

const puppeteer = require('puppeteer');

async function waitForEnter(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(prompt || 'Press ENTER to continue…', () => { rl.close(); resolve(); }));
}

(async () => {
  console.log('Launching browser (headful) — please do NOT run headless.');
  const browser = await puppeteer.launch({
    headless: false,              // headful so you can login / solve CAPTCHA
    defaultViewport: { width: 1200, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Optional: make navigation appear more like a regular user
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36');

    console.log('Opening URL:', url);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });

    console.log('\n-- Intervene if required --');
    console.log('If login or Cloudflare checks appear, complete them in the browser.');
    console.log('When the page shows the shared conversation content, come back here and press ENTER.\n');

    await waitForEnter('After you completed login/challenges and the conversation is visible, press ENTER: ');

    // Give the page a moment to finish rendering
    await new Promise(resolve => setTimeout(resolve, 800));

    // Extraction heuristic:
    // - Find the initial user prompt (text before the first copy icon)
    // - Look for conversation structure and extract the first user message
    const result = await page.evaluate(() => {
      function isVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        if (rect.width < 10 || rect.height < 10) return false;
        const style = window.getComputedStyle(el);
        if (style && (style.visibility === 'hidden' || style.display === 'none' || parseFloat(style.opacity || '1') === 0)) return false;
        return true;
      }

      // Strategy 1: Look for the first copy button and get content before it
      const copyButtons = Array.from(document.querySelectorAll('button'))
        .filter(btn => {
          const text = btn.innerText?.toLowerCase() || '';
          const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
          return text.includes('copy') || ariaLabel.includes('copy') || 
                 btn.querySelector('svg') || btn.querySelector('[data-icon]');
        });

      if (copyButtons.length > 0) {
        const firstCopyButton = copyButtons[0];
        const beforeCopy = [];
        
        // Walk backwards from the copy button to find the initial prompt
        let current = firstCopyButton;
        while (current && beforeCopy.length < 50) { // safety limit
          current = current.previousElementSibling || current.parentElement?.previousElementSibling;
          if (current && isVisible(current)) {
            const text = current.innerText?.trim();
            if (text && text.length > 20 && !text.toLowerCase().includes('copy')) {
              beforeCopy.unshift(text);
              if (text.length > 100) break; // likely found the main prompt
            }
          }
        }
        
        if (beforeCopy.length > 0) {
          return { ok: true, text: beforeCopy.join(' ').replace(/\s+/g, ' ') };
        }
      }

      // Strategy 2: Look for conversation message structure
      const messageSelectors = [
        '[data-message-id]', '[class*="message"]', '[class*="conversation"]',
        'div[class*="user"]', 'div[class*="prompt"]', '.prose', 'article'
      ];

      for (const selector of messageSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          if (isVisible(el)) {
            const text = el.innerText?.trim().replace(/\s+/g, ' ');
            if (text && text.length >= 50 && text.length <= 5000) {
              // Check if this looks like a user prompt (not a response)
              if (!text.toLowerCase().includes('assistant') && 
                  !text.toLowerCase().includes('i\'ll help') &&
                  !text.toLowerCase().includes('i can help')) {
                return { ok: true, text };
              }
            }
          }
        }
      }

      // Strategy 3: Fallback - find first substantial text block
      const candidates = Array.from(document.querySelectorAll('main, article, div, section, p'))
        .filter(el => isVisible(el))
        .map(el => {
          const rect = el.getBoundingClientRect();
          const text = (el.innerText || '').trim().replace(/\s+/g, ' ');
          return { el, text, top: rect.top, area: rect.width * rect.height };
        })
        .filter(x => x.text && x.text.length >= 50 && x.text.length <= 5000)
        .sort((a, b) => {
          if (Math.abs(a.top - b.top) > 2) return a.top - b.top;
          return b.area - a.area;
        });

      if (candidates.length > 0) {
        return { ok: true, text: candidates[0].text };
      }

      return { ok: false, reason: 'no_suitable_content_found' };
    });

    if (!result.ok) {
      console.error('Failed to find prompt text (reason:', result.reason || 'unknown', ')');
      process.exitCode = 2;
    } else {
      const promptText = result.text;
      console.log('\n=== Extracted prompt (first block) ===\n');
      console.log(promptText);
      console.log('\n=====================================\n');
      fs.writeFileSync('prompt.txt', promptText, 'utf8');
      console.log('Saved to ./prompt.txt');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    console.log('You can close the browser manually. Script will exit now.');
    // Keep browser open for inspection, optionally close:
    // await browser.close();
    process.exit(0);
  }
})();