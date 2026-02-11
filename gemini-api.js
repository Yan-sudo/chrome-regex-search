/**
 * Gemini API module for converting natural language queries to regex patterns.
 *
 * Sends the user's query to Google Gemini and expects a JSON response with
 * { pattern, flags, label }.
 */

const GeminiRegex = (() => {
  const DEFAULT_MODEL = 'gemini-2.0-flash';

  const SYSTEM_PROMPT = `You are a regex generator. The user will describe what they want to search for on a web page. You must return a JSON object with three fields:
- "pattern": a JavaScript-compatible regular expression (string, no surrounding slashes)
- "flags": regex flags string (usually "gi")
- "label": short human-readable description of what the pattern matches

Rules:
1. ONLY output the JSON object. No markdown, no explanation, no code fences.
2. When the user wants to match an exact word or phrase (e.g. "MU alone", "only MU", "standalone MU"), use word boundaries \\b to avoid partial matches. For example searching for "MU" as a standalone word → pattern: "\\\\bMU\\\\b".
3. When the user wants to match a category (emails, phone numbers, URLs, dates, prices, etc.), generate an appropriate regex pattern.
4. Support queries in any language. The user may write in Chinese, English, or other languages.
5. Make sure the regex is valid JavaScript regex syntax.
6. For literal text searches, default to case-insensitive matching with "gi" flags.
7. When the user explicitly asks for case-sensitive matching, use "g" flag only.
8. The pattern string must use double-escaped backslashes for JSON (e.g. \\\\b not \\b).

Examples:
User: "搜索MU单独出现的场景"
Output: {"pattern":"\\\\bMU\\\\b","flags":"gi","label":"Standalone MU"}

User: "find email addresses"
Output: {"pattern":"[a-zA-Z0-9._%+\\\\-]+@[a-zA-Z0-9.\\\\-]+\\\\.[a-zA-Z]{2,}","flags":"gi","label":"Email addresses"}

User: "搜索所有价格"
Output: {"pattern":"\\\\$\\\\s?\\\\d[\\\\d,]*(?:\\\\.\\\\d{2})?","flags":"gi","label":"Dollar amounts"}

User: "words starting with pre"
Output: {"pattern":"\\\\bpre\\\\w*\\\\b","flags":"gi","label":"Words starting with pre"}`;

  /**
   * Call Gemini API to convert a natural language query into a regex.
   * Returns { pattern, flags, label } or throws an error.
   */
  async function convert(query, apiKey, model) {
    if (!apiKey) {
      throw new Error('NO_API_KEY');
    }

    const modelId = model || DEFAULT_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${SYSTEM_PROMPT}\n\nUser query: ${query}` }],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 256,
      },
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      if (resp.status === 400 || resp.status === 403) {
        throw new Error('API_KEY_INVALID');
      }
      throw new Error(`Gemini API error ${resp.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Empty response from Gemini');
    }

    // Parse JSON from response — strip code fences if present
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error(`Failed to parse Gemini response: ${cleaned.slice(0, 200)}`);
    }

    if (!parsed.pattern) {
      throw new Error('Gemini returned no pattern');
    }

    return {
      pattern: parsed.pattern,
      flags: parsed.flags || 'gi',
      label: parsed.label || 'AI-generated pattern',
    };
  }

  return { convert };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GeminiRegex;
}
