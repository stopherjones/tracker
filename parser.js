// parser.js
// Turns a single line like "Long walk yesterday 5pm m:4 @walk #outdoors"
// into a structured entry. Pure logic, no DOM, so it can be tested in Node.

import * as chrono from 'chrono-node';

// UK date order (19/11 means 19 November). chrono-node exposes UK rules as en.GB.
const dateParser = chrono.en.GB;

// Tokens must be whole words: preceded by start-of-string or whitespace.
// That stops "me@example.com" and "C#" from being read as tokens.
const MOOD_RE = /(?<!\S)m:([1-5])(?!\S)/i;
const ACTIVITY_RE = /(?<!\S)@([\p{L}\p{N}_-]+)/gu;
const TAG_RE = /(?<!\S)#([\p{L}\p{N}_-]+)/gu;

/**
 * Turns "12.30" into "12:30" when it is clearly a time:
 * either followed by am/pm, or preceded by at/by/from/until/till/before/after.
 * Leaves prices (£3.50) and distances (10.45 miles) alone.
 */
function normaliseDotTimes(text) {
  return text.replace(/(?<![\d.:£$€])(\d{1,2})\.(\d{2})(?![\d:])/g, (match, h, m, offset, str) => {
    if (Number(h) > 23 || Number(m) > 59) return match;
    const before = str.slice(0, offset);
    const after = str.slice(offset + match.length);
    const hasAmPm = /^\s*[ap]\.?m\b/i.test(after);
    const hasKeyword = /\b(?:at|by|from|until|till|before|after)\s+$/i.test(before);
    return hasAmPm || hasKeyword ? `${h}:${m}` : match;
  });
}

/**
 * @param {string} raw        the text exactly as typed
 * @param {Date}   [now]      reference time, injectable for tests
 * @returns {{
 *   rawText: string,
 *   cleanText: string,
 *   timestamp: string,
 *   dateFound: boolean,
 *   mood: number | null,
 *   activities: string[],
 *   tags: string[]
 * }}
 */
export function parseEntry(raw, now = new Date()) {
  let text = raw;

  // 1. Mood: m:1 to m:5, at most one per entry (first one wins).
  let mood = null;
  const moodMatch = text.match(MOOD_RE);
  if (moodMatch) {
    mood = Number(moodMatch[1]);
    text = text.replace(MOOD_RE, ' ');
  }

  // 2. Activities and tags. Collected in order, duplicates removed.
  const activities = [];
  text = text.replace(ACTIVITY_RE, (_, name) => {
    activities.push(name.toLowerCase());
    return ' ';
  });

  const tags = [];
  text = text.replace(TAG_RE, (_, name) => {
    tags.push(name.toLowerCase());
    return ' ';
  });

  // 3. Date and time. Use the first date chrono finds and cut it out of the text.
  text = normaliseDotTimes(text);

  let when = now;
  let dateFound = false;
  const found = dateParser.parse(text, now);
  if (found.length > 0) {
    const first = found[0];
    when = first.start.date();
    dateFound = true;
    text = text.slice(0, first.index) + ' ' + text.slice(first.index + first.text.length);
  }

  // Drop a connector left dangling by the removed time, e.g. "Lunch at".
  const cleanText = text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+(?:at|on|by|from|until|till|before|after)$/i, '');

  return {
    rawText: raw,
    cleanText,
    timestamp: toLocalIsoWithOffset(when),
    dateFound,
    mood,
    activities: [...new Set(activities)],
    tags: [...new Set(tags)],
  };
}

/**
 * Formats a Date as local time with its UTC offset, e.g. 2026-11-18T17:00:00+00:00.
 * Keeps 5pm meaning 5pm even after the clocks change.
 */
export function toLocalIsoWithOffset(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}
