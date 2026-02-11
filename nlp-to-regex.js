/**
 * Natural Language to Regex converter.
 *
 * Converts plain-English search descriptions into regex patterns.
 * Uses a rule-based approach with pattern templates and keyword matching.
 */

const NLPToRegex = (() => {
  // Common pattern templates keyed by intent keywords
  const PATTERN_TEMPLATES = [
    {
      keywords: ['email', 'e-mail', 'mail address'],
      regex: '[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}',
      label: 'Email addresses',
    },
    {
      keywords: ['phone', 'phone number', 'telephone', 'cell number'],
      regex: '(?:\\+?1[\\s.-]?)?(?:\\(?\\d{3}\\)?[\\s.-]?)\\d{3}[\\s.-]?\\d{4}',
      label: 'Phone numbers',
    },
    {
      keywords: ['url', 'link', 'website', 'web address', 'href'],
      regex: 'https?://[^\\s<>"\']+',
      label: 'URLs',
    },
    {
      keywords: ['ip address', 'ip addr', 'ipv4'],
      regex: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b',
      label: 'IP addresses',
    },
    {
      keywords: ['date'],
      regex: '\\b(?:\\d{1,2}[/\\-.]\\d{1,2}[/\\-.]\\d{2,4}|\\d{4}[/\\-.]\\d{1,2}[/\\-.]\\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?\\s+\\d{1,2},?\\s*\\d{2,4})\\b',
      label: 'Dates',
    },
    {
      keywords: ['time', 'timestamp', 'clock'],
      regex: '\\b\\d{1,2}:\\d{2}(?::\\d{2})?(?:\\s*[AaPp][Mm])?\\b',
      label: 'Times',
    },
    {
      keywords: ['price', 'cost', 'dollar', 'money', 'amount', 'currency'],
      regex: '\\$\\s?\\d[\\d,]*(?:\\.\\d{2})?',
      label: 'Prices / dollar amounts',
    },
    {
      keywords: ['hashtag', 'hash tag'],
      regex: '#[a-zA-Z_]\\w*',
      label: 'Hashtags',
    },
    {
      keywords: ['hex color', 'color code', 'colour code', 'hex code'],
      regex: '#(?:[0-9a-fA-F]{3}){1,2}\\b',
      label: 'Hex color codes',
    },
    {
      keywords: ['number', 'digit', 'numeric', 'integer'],
      regex: '-?\\d[\\d,]*(?:\\.\\d+)?',
      label: 'Numbers',
    },
    {
      keywords: ['zip code', 'zipcode', 'postal code'],
      regex: '\\b\\d{5}(?:-\\d{4})?\\b',
      label: 'ZIP codes',
    },
    {
      keywords: ['percent', 'percentage'],
      regex: '-?\\d+(?:\\.\\d+)?\\s?%',
      label: 'Percentages',
    },
    {
      keywords: ['capitalized word', 'proper noun', 'uppercase word'],
      regex: '\\b[A-Z][a-z]+\\b',
      label: 'Capitalized words',
    },
    {
      keywords: ['all caps', 'uppercase', 'shouting', 'acronym'],
      regex: '\\b[A-Z]{2,}\\b',
      label: 'ALL-CAPS words',
    },
    {
      keywords: ['html tag', 'tag', 'element', 'markup'],
      regex: '</?[a-zA-Z][a-zA-Z0-9]*(?:\\s[^>]*)?>',
      label: 'HTML tags',
    },
    {
      keywords: ['json key', 'json field', 'json property'],
      regex: '"[^"]+?"\\s*:',
      label: 'JSON keys',
    },
    {
      keywords: ['parenthes', 'in parens', 'between parens', 'bracketed'],
      regex: '\\([^)]+\\)',
      label: 'Parenthesized text',
    },
    {
      keywords: ['quoted', 'in quotes', 'between quotes', 'quotation'],
      regex: '(?:"[^"]*"|\'[^\']*\')',
      label: 'Quoted strings',
    },
    {
      keywords: ['sentence', 'sentences'],
      regex: '[A-Z][^.!?]*[.!?]',
      label: 'Sentences',
    },
  ];

  // Modifier keywords that refine the pattern
  const YEAR_PATTERN = /\b(?:in|from|of|year)\s+(\d{4})\b/i;
  const DOMAIN_PATTERN = /\b(?:from|on|at|ending in|with domain)\s+([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/i;
  const STARTING_WITH = /\bstart(?:ing|s)?\s+with\s+["']?(\w+)["']?\b/i;
  const ENDING_WITH = /\bend(?:ing|s)?\s+with\s+["']?(\w+)["']?\b/i;
  const CONTAINING = /\bcontain(?:ing|s)?\s+["']?([^"']+?)["']?(?:\s|$)/i;
  const LONGER_THAN = /\blonger\s+than\s+(\d+)\s*(?:char|letter|character)/i;
  const BETWEEN_PATTERN = /\bbetween\s+["']?(.+?)["']?\s+and\s+["']?(.+?)["']?\b/i;

  /**
   * Convert a natural language query into a regex pattern.
   * Returns { pattern: string, flags: string, label: string }
   */
  function convert(query) {
    const q = query.trim();
    if (!q) return null;

    // 1. Check if the user typed a raw regex (starts/ends with /)
    const rawRegex = q.match(/^\/(.+)\/([gimsuy]*)$/);
    if (rawRegex) {
      return { pattern: rawRegex[1], flags: rawRegex[2] || 'gi', label: 'Raw regex' };
    }

    // 2. Try to match known pattern templates
    const lowerQ = q.toLowerCase();
    for (const tpl of PATTERN_TEMPLATES) {
      if (tpl.keywords.some(kw => lowerQ.includes(kw))) {
        let pattern = tpl.regex;
        let label = tpl.label;

        // Apply modifiers
        pattern = applyModifiers(q, pattern, tpl);

        return { pattern, flags: 'gi', label };
      }
    }

    // 3. Handle "words starting/ending/containing" without a template match
    const startMatch = STARTING_WITH.exec(q);
    const endMatch = ENDING_WITH.exec(q);
    const containMatch = CONTAINING.exec(q);

    if (startMatch) {
      return {
        pattern: `\\b${escapeRegex(startMatch[1])}\\w*\\b`,
        flags: 'gi',
        label: `Words starting with "${startMatch[1]}"`,
      };
    }
    if (endMatch) {
      return {
        pattern: `\\b\\w*${escapeRegex(endMatch[1])}\\b`,
        flags: 'gi',
        label: `Words ending with "${endMatch[1]}"`,
      };
    }
    if (containMatch) {
      return {
        pattern: `\\b\\w*${escapeRegex(containMatch[1])}\\w*\\b`,
        flags: 'gi',
        label: `Words containing "${containMatch[1]}"`,
      };
    }

    // 4. Handle "X or Y or Z" patterns
    const orParts = q.split(/\bor\b/i).map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
    if (orParts.length > 1) {
      const pattern = orParts.map(p => escapeRegex(p)).join('|');
      return {
        pattern: `(?:${pattern})`,
        flags: 'gi',
        label: `"${orParts.join('" or "')}"`,
      };
    }

    // 5. Handle "between X and Y"
    const betweenMatch = BETWEEN_PATTERN.exec(q);
    if (betweenMatch) {
      const left = escapeRegex(betweenMatch[1]);
      const right = escapeRegex(betweenMatch[2]);
      return {
        pattern: `${left}[\\s\\S]*?${right}`,
        flags: 'gi',
        label: `Text between "${betweenMatch[1]}" and "${betweenMatch[2]}"`,
      };
    }

    // 6. Fallback: treat the whole input as a literal search (case-insensitive)
    return {
      pattern: escapeRegex(q),
      flags: 'gi',
      label: `Literal search: "${q}"`,
    };
  }

  /**
   * Apply modifier keywords (year, domain, starts with, etc.) to a base pattern.
   */
  function applyModifiers(query, basePattern, tpl) {
    let pattern = basePattern;

    // Year modifier for dates
    const yearMatch = YEAR_PATTERN.exec(query);
    if (yearMatch && tpl.keywords.some(kw => ['date'].includes(kw))) {
      // Inject year constraint — look for dates containing that year
      pattern = `(?:${pattern})(?=[^\\n]*${yearMatch[1]})`;
    }

    // Domain modifier for emails/URLs
    const domainMatch = DOMAIN_PATTERN.exec(query);
    if (domainMatch) {
      const dom = escapeRegex(domainMatch[1]);
      if (tpl.keywords.includes('email')) {
        pattern = `[a-zA-Z0-9._%+\\-]+@${dom}`;
      } else if (tpl.keywords.includes('url')) {
        pattern = `https?://${dom}[^\\s<>"']*`;
      }
    }

    // "starting with X" modifier on URLs (skip if X is just "http"/"https")
    const startMatch = STARTING_WITH.exec(query);
    if (startMatch && tpl.keywords.includes('url') && !/^https?$/i.test(startMatch[1])) {
      pattern = `https?://${escapeRegex(startMatch[1])}[^\\s<>"']*`;
    }

    return pattern;
  }

  /** Escape special regex characters in a string */
  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  return { convert, escapeRegex };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NLPToRegex;
}
