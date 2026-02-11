# Natural Language Page Search

A Chrome extension that lets you search any webpage using plain English. Describe what you're looking for and the extension converts your query into a regex pattern, highlights all matches, and lets you navigate between them.

## Install

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select this project folder
4. The extension icon appears in your toolbar — click it on any page to start searching

## Usage

Open the popup and type what you're looking for:

| You type | What it finds |
|----------|--------------|
| `email addresses` | All email addresses on the page |
| `phone numbers` | US phone numbers (with or without country code) |
| `urls` | All HTTP/HTTPS links in page text |
| `prices` | Dollar amounts like $9.99, $1,200 |
| `dates in 2024` | Date strings containing the year 2024 |
| `emails from gmail.com` | Only @gmail.com addresses |
| `words starting with "pre"` | prefix, preview, prepare, etc. |
| `words ending with "tion"` | action, nation, function, etc. |
| `words containing "script"` | JavaScript, typescript, scripting, etc. |
| `hello or world or goodbye` | Any of the three words |
| `between header and footer` | All text between "header" and "footer" |
| `zip codes` | 5-digit and ZIP+4 postal codes |
| `percentages` | Values like 50%, 3.14% |
| `all caps words` | Acronyms and shouted words (NASA, README) |
| `hashtags` | Twitter/social-style #hashtags |
| `hex colors` | Color codes like #ff0 or #1a2b3c |
| `quoted strings` | Text inside single or double quotes |
| `ip addresses` | IPv4 addresses |
| `json keys` | Keys in JSON-formatted text |
| `/\bfoo\d+/gi` | Raw regex — pass through directly |
| `anything else` | Falls back to literal case-insensitive search |

The generated regex pattern is displayed below your query so you can see exactly what's being matched.

### Controls

- **Search** — run the query (or press Enter)
- **Retry** — re-run the same query (useful after page content changes)
- **Clear** — remove all highlights from the page
- **Up/Down arrows** — navigate between matches (scrolls to each one)

## Supported pattern templates

The NLP engine recognizes these categories out of the box:

- Email addresses
- Phone numbers
- URLs / links
- IP addresses (IPv4)
- Dates (multiple formats)
- Times / timestamps
- Prices / dollar amounts
- Hashtags
- Hex color codes
- Numbers / digits
- ZIP codes
- Percentages
- Capitalized words / proper nouns
- ALL-CAPS words / acronyms
- HTML tags
- JSON keys
- Parenthesized text
- Quoted strings
- Sentences

### Modifiers

Modifiers refine template patterns:

- **Year**: `dates in 2024` — filters dates by year
- **Domain**: `emails from example.com`, `urls from github.com` — scopes to a domain
- **Starts with**: `urls starting with api` — URL prefix filtering

### Fallback behavior

If no template or modifier matches, the input is treated as a literal case-insensitive text search — so the extension always finds *something*.

## Project structure

```
├── manifest.json       # Chrome extension manifest (V3)
├── popup.html          # Extension popup UI
├── popup.css           # Popup styles
├── popup.js            # Popup controller and messaging
├── nlp-to-regex.js     # Natural language → regex conversion engine
├── content.js          # Content script — DOM walking and highlighting
├── content.css         # Highlight styles (yellow matches, orange active)
└── icons/              # Extension icons (16, 48, 128px)
```

## How it works

1. User types a natural language query in the popup
2. `nlp-to-regex.js` converts it to a regex pattern via keyword matching and rule-based templates
3. The popup sends the pattern to `content.js` running in the active tab
4. `content.js` walks all visible text nodes in the DOM, runs the regex, and wraps matches in custom `<nlps-mark>` highlight elements
5. Navigation buttons scroll between highlights, marking the active one in orange
6. Clearing removes all highlight elements and restores the original text nodes
