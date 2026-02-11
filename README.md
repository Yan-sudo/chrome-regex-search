# Natural Language Page Search

A Chrome extension that lets you search any webpage using natural language in any language (Chinese, English, etc.). Powered by **Google Gemini AI** — describe what you're looking for and the AI generates a precise regex pattern, highlights all matches, and lets you navigate between them.

For example, typing "搜索MU单独出现的场景" generates `\bMU\b` — matching only standalone "MU", not "MMUU".

## Setup

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select this project folder
4. Click the extension icon, then click the gear icon to open **Settings**
5. Enter your Gemini API key (get one free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey))
6. Choose a model (Gemini 2.0 Flash recommended)

## Usage

Open the popup on any page and describe what you want to find — in any language:

| You type | What it matches |
|----------|----------------|
| `搜索MU单独出现的` | Only standalone "MU", not "MMUU" |
| `找出所有邮箱地址` | Email addresses |
| `页面中的手机号` | Phone numbers |
| `find all prices` | Dollar amounts like $9.99 |
| `URLs starting with https` | HTTPS links |
| `dates in 2024` | Dates containing 2024 |
| `words ending with "tion"` | action, nation, function, etc. |
| `大写的缩写词` | All-caps acronyms like NASA, API |
| `/\bfoo\d+/gi` | Raw regex — passed through directly |

The AI understands intent: "only exact matches", "as a whole word", "not inside other words", case sensitivity, and more.

### Controls

- **Search** — run the query (or press Enter)
- **Retry** — re-run the same query
- **Clear** — remove all highlights
- **Up/Down arrows** — navigate between matches

### Settings

Click the gear icon to configure:

- **API Key** — your Gemini API key
- **Model** — choose between Flash (fast), Flash Lite (fastest), or Pro (most capable)

### Fallback

If the API is unavailable or no key is set, the extension falls back to a built-in rule-based NLP engine that supports common patterns (emails, phones, URLs, dates, prices, etc.).

## Project structure

```
├── manifest.json       # Chrome extension manifest (V3)
├── popup.html          # Extension popup UI
├── popup.css           # Popup styles
├── popup.js            # Popup controller — orchestrates search flow
├── gemini-api.js       # Gemini AI → regex conversion
├── nlp-to-regex.js     # Local rule-based fallback converter
├── content.js          # Content script — DOM highlighting
├── content.css         # Highlight styles
├── options.html        # Settings page
├── options.js          # Settings logic (API key storage)
└── icons/              # Extension icons (16, 48, 128px)
```

## How it works

1. User types a natural language query in any language
2. `popup.js` sends the query to **Gemini API** via `gemini-api.js`
3. Gemini returns a JSON object with `{ pattern, flags, label }`
4. The regex is validated, then sent to `content.js` in the active tab
5. `content.js` walks all visible text nodes, runs the regex, and wraps matches in highlight elements
6. Navigation buttons scroll between matches (yellow = match, orange = active)
7. If Gemini is unavailable, `nlp-to-regex.js` provides a local rule-based fallback
