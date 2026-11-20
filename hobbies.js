// hobbies.js
// Finds hobby words inside an entry's text so they can be highlighted.
// The word stays in the sentence, so nothing is lost from the export.

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Longest first, so "painting" wins over "paint" when both are listed.
function hobbyPattern(hobbies) {
  const words = [...new Set(hobbies || [])].filter(Boolean);
  if (!words.length) return null;
  const alternatives = words
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join('|');
  return new RegExp(`(?<![\\p{L}\\p{N}])(${alternatives})(?![\\p{L}\\p{N}])`, 'giu');
}

/**
 * Splits text into [{ text, hobby }] pieces, marking whole-word hobby matches.
 */
export function splitHobbies(text, hobbies) {
  const pattern = hobbyPattern(hobbies);
  if (!pattern || !text) return [{ text, hobby: false }];

  const pieces = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) pieces.push({ text: text.slice(last, match.index), hobby: false });
    pieces.push({ text: match[0], hobby: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) pieces.push({ text: text.slice(last), hobby: false });
  return pieces;
}
