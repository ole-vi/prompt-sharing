https://chatgpt.com/s/cd_68f2759ac2ac8191a52786255921050c


---

### Extracted Prompt
(node:2535) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/runner/work/prompt-sharing/prompt-sharing/scrape.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/runner/work/prompt-sharing/prompt-sharing/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
file:///home/runner/work/prompt-sharing/prompt-sharing/scrape.js:14
  await page.waitForTimeout(5000); // give JS time to render
             ^

TypeError: page.waitForTimeout is not a function
    at file:///home/runner/work/prompt-sharing/prompt-sharing/scrape.js:14:14

Node.js v20.19.5
