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
 * @param {string} raw        the text exactly as typed
 * @param {Date}   [now]      reference time, injectable for tests
 * @returns {{
 *   rawText: string,
 *   cleanText: string,
 *   timestamp: string,
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
  let when = now;
  const found = dateParser.parse(text, now);
  if (found.length > 0) {
    const first = found[0];
    when = first.start.date();
    text = text.slice(0, first.index) + ' ' + text.slice(first.index + first.text.length);
  }

  return {
    rawText: raw,
    cleanText: text.replace(/\s+/g, ' ').trim(),
    timestamp: toLocalIsoWithOffset(when),
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
