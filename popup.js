/* global NLPToRegex, GeminiRegex, chrome */

document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const retryBtn = document.getElementById('retry-btn');
  const clearBtn = document.getElementById('clear-btn');
  const settingsBtn = document.getElementById('settings-btn');
  const openOptionsLink = document.getElementById('open-options-link');
  const noKeyBanner = document.getElementById('no-key-banner');
  const loadingSection = document.getElementById('loading-section');
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
  let searching = false;

  // Cached settings
  let apiKey = '';
  let geminiModel = '';

  // --- Load settings and check API key ---
  chrome.storage.sync.get(['geminiApiKey', 'geminiModel'], (data) => {
    apiKey = data.geminiApiKey || '';
    geminiModel = data.geminiModel || '';
    if (!apiKey) {
      noKeyBanner.classList.remove('hidden');
    }
  });

  // Listen for storage changes (user saves key while popup is open)
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.geminiApiKey) {
      apiKey = changes.geminiApiKey.newValue || '';
      noKeyBanner.classList.toggle('hidden', !!apiKey);
    }
    if (changes.geminiModel) {
      geminiModel = changes.geminiModel.newValue || '';
    }
  });

  // --- Event listeners ---

  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  openOptionsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

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

  searchInput.focus();

  // --- Core functions ---

  async function performSearch() {
    const query = searchInput.value.trim();
    if (!query || searching) return;

    lastQuery = query;
    hideAll();

    // If user typed a raw regex, use local converter directly (no API needed)
    const rawRegex = query.match(/^\/(.+)\/([gimsuy]*)$/);
    if (rawRegex) {
      const result = { pattern: rawRegex[1], flags: rawRegex[2] || 'gi', label: 'Raw regex' };
      applyResult(result);
      return;
    }

    // Try Gemini API first, fall back to local NLP
    if (apiKey) {
      searching = true;
      searchBtn.disabled = true;
      loadingSection.classList.remove('hidden');

      try {
        const result = await GeminiRegex.convert(query, apiKey, geminiModel);
        hideAll();
        applyResult(result);
      } catch (err) {
        hideAll();
        if (err.message === 'NO_API_KEY' || err.message === 'API_KEY_INVALID') {
          showError('Invalid API key. Please check Settings.');
          noKeyBanner.classList.remove('hidden');
        } else {
          // Fall back to local NLP on API error
          const fallback = NLPToRegex.convert(query);
          if (fallback) {
            applyResult(fallback, true);
          } else {
            showError(err.message);
          }
        }
      } finally {
        searching = false;
        searchBtn.disabled = false;
        retryBtn.disabled = false;
      }
    } else {
      // No API key — use local NLP
      const result = NLPToRegex.convert(query);
      if (!result) {
        showError('Could not understand the query. Try rephrasing or set up a Gemini API key in Settings.');
        retryBtn.disabled = false;
        return;
      }
      applyResult(result);
      retryBtn.disabled = false;
    }
  }

  function applyResult(result, isFallback) {
    // Validate the generated regex
    try {
      new RegExp(result.pattern, result.flags);
    } catch (err) {
      showError(`Invalid pattern generated: ${err.message}`);
      retryBtn.disabled = false;
      return;
    }

    const suffix = isFallback ? '  (fallback — local)' : '';
    generatedQuery.textContent = `/${result.pattern}/${result.flags}  —  ${result.label}${suffix}`;
    queryDisplay.classList.remove('hidden');
    retryBtn.disabled = false;

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
          chrome.scripting.executeScript(
            {
              target: { tabId: tabs[0].id },
              files: ['content.js'],
            },
            () => {
              chrome.scripting.insertCSS(
                {
                  target: { tabId: tabs[0].id },
                  files: ['content.css'],
                },
                () => {
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
    loadingSection.classList.add('hidden');
    noKeyBanner.classList.toggle('hidden', !!apiKey);
    totalMatches = 0;
    currentIndex = 0;
  }
});
