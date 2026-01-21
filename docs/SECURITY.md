# Security Guidelines

## XSS Protection

### Overview
This application renders user-provided markdown content from GitHub repositories. To prevent Cross-Site Scripting (XSS) attacks, all HTML generated from markdown is sanitized using DOMPurify before being inserted into the DOM.

### Implementation

#### DOMPurify Integration
DOMPurify (v3.0.6) is loaded via CDN in all HTML files that render prompt content:
- `index.html`
- `pages/jules/jules.html`
- `pages/queue/queue.html`

```html
<script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js"></script>
```

#### Sanitization Function
The `sanitizeHtml()` function in `src/modules/prompt-renderer.js` wraps all markdown-to-HTML conversions:

```javascript
function sanitizeHtml(html) {
  // Uses DOMPurify to strip dangerous content
  return window.DOMPurify.sanitize(html, config);
}
```

#### Allowed HTML Elements
The sanitizer allows standard markdown elements:

**Text Formatting:**
- Headings: `h1`, `h2`, `h3`, `h4`, `h5`, `h6`
- Paragraphs: `p`, `br`, `hr`
- Emphasis: `strong`, `em`, `u`, `s`, `del`, `ins`, `sub`, `sup`

**Code:**
- `code`, `pre` (for inline code and code blocks)

**Lists:**
- `ul`, `ol`, `li`

**Quotes:**
- `blockquote`

**Links and Images:**
- `a` (with href, title, target, rel attributes)
- `img` (with src, alt, title attributes)

**Tables:**
- `table`, `thead`, `tbody`, `tfoot`, `tr`, `th`, `td`
- Table attributes: `colspan`, `rowspan`, `align`

**Containers:**
- `div`, `span` (with class, id attributes)

#### Blocked Content

**Dangerous Tags:**
- `<script>` - JavaScript execution
- `<style>` - CSS injection
- `<iframe>` - Frame injection
- `<object>`, `<embed>` - Plugin execution
- `<base>` - Base URL hijacking
- `<link>`, `<meta>` - External resource loading

**Dangerous Attributes:**
- `onerror` - Event handler injection
- `onload` - Event handler injection
- `onclick` - Event handler injection
- `onmouseover` - Event handler injection
- `onfocus`, `onblur` - Event handler injection

**Dangerous URI Schemes:**
- `javascript:` - JavaScript execution via links
- `data:text/html` - HTML injection via data URIs
- `vbscript:` - VBScript execution

Only safe URI schemes are allowed: `http`, `https`, `mailto`, `tel`, `callto`, `sms`, `cid`, `xmpp`, and safe `data:` URIs (images).

### Fallback Safety
If DOMPurify fails to load:
1. An error is logged to console
2. All HTML tags are stripped using `textContent` (displays as plain text)
3. This prevents any HTML execution as a last resort

### Testing XSS Protection

#### Test Payloads
Create a test markdown file with these XSS payloads to verify they are blocked:

```markdown
# XSS Test Cases

## Script Tag
<script>alert('XSS')</script>

## Image onerror
<img src="invalid" onerror="alert('XSS')">

## Link with javascript: URL
[Click me](javascript:alert('XSS'))

## Inline onclick
<div onclick="alert('XSS')">Click me</div>

## Iframe injection
<iframe src="javascript:alert('XSS')"></iframe>

## Object injection
<object data="javascript:alert('XSS')"></object>

## Data URI HTML injection
<a href="data:text/html,<script>alert('XSS')</script>">Click</a>

## SVG with script
<svg><script>alert('XSS')</script></svg>

## Meta refresh redirect
<meta http-equiv="refresh" content="0;url=javascript:alert('XSS')">
```

#### Expected Results
All of the above should be **stripped or neutralized**:
- `<script>` tags completely removed
- Event handlers (`onerror`, `onclick`, etc.) removed
- `javascript:` URLs blocked
- Dangerous tags (`iframe`, `object`, `meta`) removed

#### Safe Content Test
Verify legitimate markdown still renders correctly:

```markdown
# Heading 1
## Heading 2

**Bold text** and *italic text*

- List item 1
- List item 2

[Safe link](https://example.com)

![Safe image](https://example.com/image.png)

\```javascript
console.log('code blocks');
\```

| Table | Header |
|-------|--------|
| Cell  | Data   |
```

### Security Best Practices

1. **Never use `innerHTML` without sanitization** - Always wrap with `sanitizeHtml()`
2. **Keep DOMPurify updated** - Check for security updates regularly
3. **Test new payload vectors** - XSS techniques evolve; test periodically
4. **Validate on server side** - Client-side sanitization is last defense, not primary
5. **CSP headers** - Consider Content Security Policy headers for additional protection
6. **Audit third-party content** - User-provided markdown from GitHub is untrusted

### Known Limitations

**What DOMPurify protects against:**
- ✅ Script injection via `<script>` tags
- ✅ Event handler injection (onclick, onerror, etc.)
- ✅ Malicious URI schemes (javascript:, data:text/html)
- ✅ Frame/plugin injection (iframe, object, embed)

**What DOMPurify does NOT protect against:**
- ❌ Server-side vulnerabilities (SQL injection, etc.)
- ❌ CSRF attacks (use proper CSRF tokens)
- ❌ Clickjacking (implement CSP frame-ancestors)
- ❌ Social engineering attacks
- ❌ Malicious content in external resources (linked images, etc.)

### Browser Compatibility
DOMPurify v3.0.6 supports:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- All modern browsers with ES6 support

### Performance Impact
- DOMPurify adds ~50KB to initial page load (gzipped)
- Sanitization adds <5ms per prompt render
- No noticeable performance degradation

### Maintenance

**Update Schedule:**
- Check for DOMPurify updates quarterly
- Monitor [DOMPurify releases](https://github.com/cure53/DOMPurify/releases) for security patches
- Test new versions with XSS test file before updating

**Security Audit:**
- Review sanitization config annually
- Test against OWASP Top 10 XSS vectors
- Monitor security advisories for DOMPurify

### Reporting Security Issues
If you discover a security vulnerability:
1. **Do not** open a public GitHub issue
2. Create a [GitHub Security Advisory](https://github.com/jessewashburn/prompt-sharing/security/advisories/new)
3. Or email: security@[repository-domain]
4. Include proof-of-concept (PoC) if possible
5. Allow reasonable time (90 days) for fix before public disclosure

### References
- [DOMPurify Documentation](https://github.com/cure53/DOMPurify)
- [DOMPurify Security Policy](https://github.com/cure53/DOMPurify/security/policy)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP Top 10 - A03:2021 Injection](https://owasp.org/Top10/A03_2021-Injection/)
- [MDN: innerHTML security](https://developer.mozilla.org/en-docs/Web/API/Element/innerHTML#security_considerations)
- [Content Security Policy (CSP) Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
