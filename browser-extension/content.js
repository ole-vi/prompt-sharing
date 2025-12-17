// ===== Content Script - Runs on every webpage =====
// Extracts page content and converts to Markdown

(function() {
  'use strict';

  /**
   * Extract the main content from the current page
   */
  function extractPageContent() {
    const title = document.title || 'Untitled Page';
    const url = window.location.href;
    
    // Try to find the main content area
    let mainContent = null;
    
    // Common content selectors (ordered by priority)
    const selectors = [
      'article',
      'main',
      '[role="main"]',
      '.content',
      '#content',
      '.post-content',
      '.article-content',
      'body'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        mainContent = element;
        break;
      }
    }
    
    if (!mainContent) {
      mainContent = document.body;
    }
    
    // Clone to avoid modifying the actual page
    const content = mainContent.cloneNode(true);
    
    // Remove unwanted elements
    const unwantedSelectors = [
      'script',
      'style',
      'nav',
      'header',
      'footer',
      '.ad',
      '.advertisement',
      '.social-share',
      '.comments',
      '#comments',
      '.sidebar',
      'iframe',
      'noscript'
    ];
    
    unwantedSelectors.forEach(selector => {
      content.querySelectorAll(selector).forEach(el => el.remove());
    });
    
    return {
      title,
      url,
      content: content,
      timestamp: new Date().toISOString(),
      domain: new URL(url).hostname
    };
  }

  /**
   * Convert HTML element to Markdown
   */
  function htmlToMarkdown(element) {
    if (!element) return '';
    
    let markdown = '';
    
    // Handle text nodes
    if (element.nodeType === Node.TEXT_NODE) {
      return element.textContent.trim();
    }
    
    // Handle element nodes
    const tagName = element.tagName ? element.tagName.toLowerCase() : '';
    
    switch (tagName) {
      case 'h1':
        markdown += `# ${getTextContent(element)}\n\n`;
        break;
      case 'h2':
        markdown += `## ${getTextContent(element)}\n\n`;
        break;
      case 'h3':
        markdown += `### ${getTextContent(element)}\n\n`;
        break;
      case 'h4':
        markdown += `#### ${getTextContent(element)}\n\n`;
        break;
      case 'h5':
        markdown += `##### ${getTextContent(element)}\n\n`;
        break;
      case 'h6':
        markdown += `###### ${getTextContent(element)}\n\n`;
        break;
      case 'p':
        markdown += `${processInlineElements(element)}\n\n`;
        break;
      case 'br':
        markdown += '\n';
        break;
      case 'strong':
      case 'b':
        markdown += `**${getTextContent(element)}**`;
        break;
      case 'em':
      case 'i':
        markdown += `*${getTextContent(element)}*`;
        break;
      case 'code':
        if (element.parentElement?.tagName !== 'PRE') {
          markdown += `\`${getTextContent(element)}\``;
        }
        break;
      case 'pre':
        const codeElement = element.querySelector('code');
        const code = codeElement ? codeElement.textContent : element.textContent;
        markdown += `\n\`\`\`\n${code.trim()}\n\`\`\`\n\n`;
        break;
      case 'a':
        const href = element.getAttribute('href') || '';
        const text = getTextContent(element);
        markdown += `[${text}](${href})`;
        break;
      case 'img':
        const src = element.getAttribute('src') || '';
        const alt = element.getAttribute('alt') || 'image';
        markdown += `\n![${alt}](${src})\n\n`;
        break;
      case 'ul':
      case 'ol':
        const isOrdered = tagName === 'ol';
        let listMarkdown = '\n';
        Array.from(element.children).forEach((li, index) => {
          if (li.tagName.toLowerCase() === 'li') {
            const marker = isOrdered ? `${index + 1}.` : '-';
            listMarkdown += `${marker} ${processInlineElements(li)}\n`;
          }
        });
        markdown += listMarkdown + '\n';
        break;
      case 'blockquote':
        const quoteText = processInlineElements(element);
        markdown += '\n' + quoteText.split('\n').map(line => `> ${line}`).join('\n') + '\n\n';
        break;
      case 'hr':
        markdown += '---\n\n';
        break;
      default:
        // For other elements, process children
        Array.from(element.childNodes).forEach(child => {
          markdown += htmlToMarkdown(child);
        });
        break;
    }
    
    return markdown;
  }

  /**
   * Get text content from element
   */
  function getTextContent(element) {
    return element.textContent.trim().replace(/\s+/g, ' ');
  }

  /**
   * Process inline elements (bold, italic, links, etc.)
   */
  function processInlineElements(element) {
    let result = '';
    
    Array.from(element.childNodes).forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();
        
        switch (tag) {
          case 'strong':
          case 'b':
            result += `**${getTextContent(node)}**`;
            break;
          case 'em':
          case 'i':
            result += `*${getTextContent(node)}*`;
            break;
          case 'code':
            result += `\`${getTextContent(node)}\``;
            break;
          case 'a':
            const href = node.getAttribute('href') || '';
            result += `[${getTextContent(node)}](${href})`;
            break;
          case 'br':
            result += '\n';
            break;
          default:
            result += processInlineElements(node);
            break;
        }
      }
    });
    
    return result.trim();
  }

  /**
   * Build full Markdown document
   */
  function buildMarkdownDocument(pageData) {
    const { title, url, content, timestamp, domain } = pageData;
    
    let markdown = `# ${title}\n\n`;
    markdown += `**Source:** [${url}](${url})\n\n`;
    markdown += `**Captured:** ${new Date(timestamp).toLocaleString()}\n\n`;
    markdown += '---\n\n';
    
    // Convert content to markdown
    markdown += htmlToMarkdown(content);
    
    return markdown;
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractContent') {
      try {
        const pageData = extractPageContent();
        const markdown = buildMarkdownDocument(pageData);
        
        sendResponse({
          success: true,
          title: pageData.title,
          url: pageData.url,
          markdown: markdown,
          domain: pageData.domain
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error.message
        });
      }
    }
    return true; // Keep channel open for async response
  });

})();
