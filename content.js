/* Content script: highlights regex matches in the page */

(() => {
  const HIGHLIGHT_CLASS = 'nlps-highlight';
  const ACTIVE_CLASS = 'nlps-highlight-active';
  const WRAPPER_TAG = 'nlps-mark';

  let highlights = [];
  let activeIndex = -1;

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'search') {
      const count = doSearch(msg.pattern, msg.flags);
      sendResponse({ count });
      if (count > 0) scrollToMatch(0);
    } else if (msg.action === 'navigate') {
      scrollToMatch(msg.index);
      sendResponse({ ok: true });
    } else if (msg.action === 'clear') {
      clearHighlights();
      sendResponse({ ok: true });
    }
    return true; // keep channel open for async
  });

  /**
   * Walk the DOM, find text nodes matching the regex, and wrap matches
   * in highlight elements. Returns total match count.
   */
  function doSearch(pattern, flags) {
    clearHighlights();

    let regex;
    try {
      regex = new RegExp(pattern, flags);
    } catch {
      return 0;
    }

    // Gather all visible text nodes
    const textNodes = getTextNodes(document.body);
    let count = 0;

    for (const node of textNodes) {
      const text = node.nodeValue;
      if (!text || !text.trim()) continue;

      // Reset regex lastIndex for global searches
      regex.lastIndex = 0;
      const matches = [];
      let match;

      while ((match = regex.exec(text)) !== null) {
        if (match[0].length === 0) {
          regex.lastIndex++;
          continue;
        }
        matches.push({ index: match.index, length: match[0].length });
      }

      if (matches.length === 0) continue;

      // Split the text node and wrap matched portions
      const frag = document.createDocumentFragment();
      let lastEnd = 0;

      for (const m of matches) {
        // Text before match
        if (m.index > lastEnd) {
          frag.appendChild(document.createTextNode(text.slice(lastEnd, m.index)));
        }

        // Highlighted match
        const mark = document.createElement(WRAPPER_TAG);
        mark.className = HIGHLIGHT_CLASS;
        mark.textContent = text.slice(m.index, m.index + m.length);
        mark.dataset.matchIndex = count;
        frag.appendChild(mark);

        highlights.push(mark);
        count++;
        lastEnd = m.index + m.length;
      }

      // Text after last match
      if (lastEnd < text.length) {
        frag.appendChild(document.createTextNode(text.slice(lastEnd)));
      }

      node.parentNode.replaceChild(frag, node);
    }

    return count;
  }

  /**
   * Scroll to and activate the match at the given index.
   */
  function scrollToMatch(index) {
    if (highlights.length === 0) return;
    // Deactivate previous
    if (activeIndex >= 0 && activeIndex < highlights.length) {
      highlights[activeIndex].classList.remove(ACTIVE_CLASS);
    }
    activeIndex = index;
    const el = highlights[activeIndex];
    if (!el) return;
    el.classList.add(ACTIVE_CLASS);
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /**
   * Remove all highlights and restore original text.
   */
  function clearHighlights() {
    const marks = document.querySelectorAll(WRAPPER_TAG + '.' + HIGHLIGHT_CLASS);
    marks.forEach((mark) => {
      const parent = mark.parentNode;
      if (!parent) return;
      const text = document.createTextNode(mark.textContent);
      parent.replaceChild(text, mark);
      // Merge adjacent text nodes
      parent.normalize();
    });
    highlights = [];
    activeIndex = -1;
  }

  /**
   * Collect all text nodes under a root element, skipping scripts/styles/hidden elements.
   */
  function getTextNodes(root) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === WRAPPER_TAG.toUpperCase()) {
          return NodeFilter.FILTER_REJECT;
        }
        if (parent.offsetParent === null && tag !== 'BODY' && tag !== 'HTML') {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }
    return nodes;
  }
})();
