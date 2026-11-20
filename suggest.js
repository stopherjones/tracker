// suggest.js
// Chips for the word being typed: mood (m:1 to m:5), then #tags and @activities
// ranked by how often you've used them.

const MOOD_OPTIONS = ['m:1', 'm:2', 'm:3', 'm:4', 'm:5'];
const MAX_CHIPS = 6;

// The word the cursor is in at the end of the text.
export function currentToken(text) {
  const match = text.match(/(\S*)$/);
  return match ? match[1] : '';
}

// Most-used values first, alphabetical for ties.
function rankedByUse(entries, field) {
  const counts = new Map();
  for (const e of entries) {
    for (const value of e[field] || []) {
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value]) => value);
}

/**
 * Returns chips for the current word: [{ label, insert }].
 * An empty array means nothing to suggest.
 */
export function suggestionsFor(text, entries) {
  const token = currentToken(text);
  if (!token) return [];
  const lower = token.toLowerCase();

  // Mood: "m", "m:" or "m:2". Only when the word is just the mood prefix.
  if (/^m:?[1-5]?$/i.test(token)) {
    return MOOD_OPTIONS.filter((o) => o.startsWith(lower)).map((o) => ({ label: o, insert: o }));
  }

  // Tags: "#" shows the most used, "#w" filters to those starting with w.
  if (token.startsWith('#')) {
    const prefix = lower.slice(1);
    return rankedByUse(entries, 'tags')
      .filter((t) => t.startsWith(prefix) && t !== prefix)
      .slice(0, MAX_CHIPS)
      .map((t) => ({ label: `#${t}`, insert: `#${t}` }));
  }

  // Activities: same as tags, with @.
  if (token.startsWith('@')) {
    const prefix = lower.slice(1);
    return rankedByUse(entries, 'activities')
      .filter((a) => a.startsWith(prefix) && a !== prefix)
      .slice(0, MAX_CHIPS)
      .map((a) => ({ label: `@${a}`, insert: `@${a}` }));
  }

  return [];
}

// Replaces the word being typed with the chosen value and adds a space.
export function applySuggestion(text, insert) {
  return text.replace(/\S*$/, `${insert} `);
}
