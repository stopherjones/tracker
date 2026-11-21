// hobbies.js
// Finds hobby words inside an entry's text so they can be highlighted,
// and holds the colours for hobbies that get their own style.

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Special colours for particular hobbies. Any other hobby uses the default yellow.
const HOBBY_COLOURS = {
  chores: { fill: [124, 58, 237], text: [255, 255, 255] }, // purple, white text
};

export function hobbyColours(name) {
  return HOBBY_COLOURS[name] || null;
}

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
 * Splits text into [{ text, hobby, name }] pieces, marking whole-word hobby matches.
 * `name` is the lowercase hobby word, used to pick its colour.
 */
export function splitHobbies(text, hobbies) {
  const pattern = hobbyPattern(hobbies);
  if (!pattern || !text) return [{ text, hobby: false }];

  const pieces = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) pieces.push({ text: text.slice(last, match.index), hobby: false });
    pieces.push({ text: match[0], hobby: true, name: match[0].toLowerCase() });
    last = match.index + match[0].length;
  }
  if (last < text.length) pieces.push({ text: text.slice(last), hobby: false });
  return pieces;
}
