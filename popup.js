/* global NLPToRegex, chrome */

document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const retryBtn = document.getElementById('retry-btn');
  const clearBtn = document.getElementById('clear-btn');
  const queryDisplay = document.getElementById('query-display');
  const generatedQuery = document.getElementById('generated-query');
  const resultsSection = document.getElementById('results-section');
  const matchCount = document.getElementById('match-count');
  const currentMatchEl = document.getElementById('current-match');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const errorSection = document.getElementById('error-section');
  const errorMessage = document.getElementById('error-message');

  let lastQuery = '';
  let totalMatches = 0;
  let currentIndex = 0;

  // --- Event listeners ---

  searchBtn.addEventListener('click', () => performSearch());
  retryBtn.addEventListener('click', () => performSearch());

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    hideAll();
    sendToContent({ action: 'clear' });
    retryBtn.disabled = true;
    lastQuery = '';
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      performSearch();
    }
  });

  prevBtn.addEventListener('click', () => navigate(-1));
  nextBtn.addEventListener('click', () => navigate(1));

  // Keyboard nav for up/down arrows while popup is focused
  document.addEventListener('keydown', (e) => {
    if (totalMatches === 0) return;
    if (e.key === 'ArrowUp' || (e.key === 'Enter' && e.shiftKey)) {
      e.preventDefault();
      navigate(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigate(1);
    }
  });

  // Focus input on popup open
  searchInput.focus();

  // --- Core functions ---

  function performSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    lastQuery = query;
    hideAll();

    const result = NLPToRegex.convert(query);
    if (!result) {
      showError('Could not understand the query. Try rephrasing.');
      retryBtn.disabled = false;
      return;
    }

    // Validate the generated regex
    try {
      new RegExp(result.pattern, result.flags);
    } catch (err) {
      showError(`Invalid pattern generated: ${err.message}`);
      retryBtn.disabled = false;
      return;
    }

    // Show the generated pattern
    generatedQuery.textContent = `/${result.pattern}/${result.flags}  —  ${result.label}`;
    queryDisplay.classList.remove('hidden');
    retryBtn.disabled = false;

    // Send to content script
    sendToContent({
      action: 'search',
      pattern: result.pattern,
      flags: result.flags,
    });
  }

  function navigate(direction) {
    if (totalMatches === 0) return;
    currentIndex = ((currentIndex + direction) % totalMatches + totalMatches) % totalMatches;
    currentMatchEl.textContent = `${currentIndex + 1}/${totalMatches}`;
    sendToContent({ action: 'navigate', index: currentIndex });
  }

  function sendToContent(message) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
        if (chrome.runtime.lastError) {
          // Content script might not be injected yet; inject it manually
          chrome.scripting.executeScript(
            {
              target: { tabId: tabs[0].id },
              files: ['content.js'],
            },
            () => {
              // Also inject CSS
              chrome.scripting.insertCSS(
                {
                  target: { tabId: tabs[0].id },
                  files: ['content.css'],
                },
                () => {
                  // Retry the message
                  chrome.tabs.sendMessage(tabs[0].id, message, handleResponse);
                }
              );
            }
          );
          return;
        }
        handleResponse(response);
      });
    });
  }

  function handleResponse(response) {
    if (!response) return;
    if (response.error) {
      showError(response.error);
      return;
    }
    totalMatches = response.count || 0;
    currentIndex = 0;
    matchCount.textContent = `${totalMatches} match${totalMatches !== 1 ? 'es' : ''}`;
    currentMatchEl.textContent = totalMatches > 0 ? `1/${totalMatches}` : '0/0';
    resultsSection.classList.remove('hidden');
  }

  // --- UI helpers ---

  function showError(msg) {
    errorMessage.textContent = msg;
    errorSection.classList.remove('hidden');
  }

  function hideAll() {
    queryDisplay.classList.add('hidden');
    resultsSection.classList.add('hidden');
    errorSection.classList.add('hidden');
    totalMatches = 0;
    currentIndex = 0;
  }
});
