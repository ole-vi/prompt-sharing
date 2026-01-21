# XSS Security Test - Malicious Payloads

⚠️ **WARNING**: This file contains XSS test vectors. Do NOT use in production.

## Test Instructions
1. View this file in the PromptRoot application
2. Open browser DevTools console (F12)
3. Verify NO alerts or script execution occurs
4. Verify legitimate markdown below renders correctly

---

## 🔴 Malicious Payloads (Should Be Blocked)

### Script Tag Injection
<script>alert('XSS: Script Tag')</script>

### Script with Type Attribute
<script type="text/javascript">alert('XSS: Script with Type')</script>

### Image with onerror Handler
<img src="invalid-url" onerror="alert('XSS: Image onerror')">

### Image with onload Handler
<img src="https://via.placeholder.com/1" onload="alert('XSS: Image onload')">

### Link with javascript: Protocol
[Click me for XSS](javascript:alert('XSS: javascript: link'))

### Div with onclick Handler
<div onclick="alert('XSS: onclick handler')">Click this div</div>

### Button with onclick Handler
<button onclick="alert('XSS: Button onclick')">Click Me</button>

### Anchor with javascript: href
<a href="javascript:alert('XSS: Anchor href')">Malicious Link</a>

### Iframe Injection
<iframe src="javascript:alert('XSS: iframe')"></iframe>

### Iframe with Data URI
<iframe src="data:text/html,<script>alert('XSS: iframe data URI')</script>"></iframe>

### Object Injection
<object data="javascript:alert('XSS: object tag')"></object>

### Embed Injection
<embed src="javascript:alert('XSS: embed tag')">

### SVG with Script
<svg><script>alert('XSS: SVG script')</script></svg>

### SVG with onload
<svg onload="alert('XSS: SVG onload')"></svg>

### Meta Refresh Redirect
<meta http-equiv="refresh" content="0;url=javascript:alert('XSS: meta refresh')">

### Link Tag Injection
<link rel="stylesheet" href="javascript:alert('XSS: link tag')">

### Style Tag Injection
<style>body { background: url('javascript:alert("XSS: style tag")'); }</style>

### Base Tag Hijacking
<base href="javascript:alert('XSS: base tag')//">

### Form with action="javascript:"
<form action="javascript:alert('XSS: form action')"><input type="submit" value="Submit"></form>

### Input with onfocus
<input type="text" onfocus="alert('XSS: input onfocus')" autofocus>

### Textarea with onchange
<textarea onchange="alert('XSS: textarea onchange')"></textarea>

### Details with ontoggle
<details ontoggle="alert('XSS: details ontoggle')"><summary>Click</summary></details>

### Data URI with HTML
<a href="data:text/html,<script>alert('XSS: data URI')</script>">Data URI Link</a>

### Base64 Encoded JavaScript
<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgnWFNTOiBiYXNlNjQnKTwvc2NyaXB0Pg==">Base64 Link</a>

---

## ✅ Safe Content (Should Render Correctly)

### Headings Work
# H1 Heading
## H2 Heading
### H3 Heading
#### H4 Heading
##### H5 Heading
###### H6 Heading

### Text Formatting Works
**This is bold text**
*This is italic text*
~~This is strikethrough~~
`This is inline code`

### Lists Work
- Unordered list item 1
- Unordered list item 2
  - Nested item
  - Another nested item

1. Ordered list item 1
2. Ordered list item 2
3. Ordered list item 3

### Links Work (HTTPS only)
[Safe Link to Example](https://example.com)
[GitHub](https://github.com)
[Google](https://google.com)

### Images Work (HTTPS only)
![Placeholder Image](https://via.placeholder.com/150)

### Code Blocks Work
```javascript
function safeCode() {
  console.log('This is safe code in a code block');
  const x = 1 + 1;
  return x;
}
```

```python
def safe_function():
    print("Safe Python code")
    return True
```

### Blockquotes Work
> This is a blockquote
> It can span multiple lines
> 
> And have multiple paragraphs

### Tables Work
| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Data A   | Data B   | Data C   |
| Row 3    | Row 3    | Row 3    |

### Horizontal Rules Work
---

### Escaped HTML Should Display as Text
Escaped characters: `<script>alert('This should display as text')</script>`

The following should display literally:
- `<script>` tags
- `<img>` tags with onerror
- `javascript:` URLs

---

## 🧪 Test Checklist

After viewing this file, verify:

- [ ] No JavaScript alerts appeared
- [ ] No console errors about XSS attempts
- [ ] All headings (H1-H6) render correctly
- [ ] Bold, italic, and inline code formatting works
- [ ] Safe HTTPS links are clickable
- [ ] Safe HTTPS images display
- [ ] Code blocks render with syntax
- [ ] Tables render properly
- [ ] Lists (ordered and unordered) work
- [ ] Blockquotes render correctly
- [ ] Horizontal rules display
- [ ] All malicious payloads are stripped/neutralized

## Expected Behavior

✅ **Success**: No alerts, no script execution, safe content renders perfectly
❌ **Failure**: Any alert appears or console shows executed scripts

---

## Test Result

Document your test result:
- **Date**: _____________________
- **Browser**: _____________________
- **DOMPurify Version**: 3.0.6
- **Result**: PASS / FAIL
- **Notes**: _____________________
