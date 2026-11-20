// test-parser.mjs
// Run with:  npm install chrono-node  then  node test-parser.mjs
// Fixed reference time so date tests don't depend on when you run them.
import assert from 'node:assert/strict';
import { parseEntry } from './parser.js';

const NOW = new Date(2026, 10, 19, 10, 0, 0); // 19 Nov 2026, 10:00 local

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('ok  ', name);
  } catch (err) {
    console.log('FAIL', name);
    console.log(err.message);
    process.exitCode = 1;
  }
}

test('full example: date, mood, activity, tag', () => {
  const e = parseEntry('Went for a long walk yesterday 5pm m:4 @walk #outdoors', NOW);
  assert.equal(e.cleanText, 'Went for a long walk');
  assert.equal(e.mood, 4);
  assert.deepEqual(e.activities, ['walk']);
  assert.deepEqual(e.tags, ['outdoors']);
  assert.ok(e.timestamp.startsWith('2026-11-18T17:00:00'), e.timestamp);
});

test('multiple activities, duplicates removed', () => {
  const e = parseEntry('Coffee @coffee @work @Coffee m:3', NOW);
  assert.equal(e.cleanText, 'Coffee');
  assert.deepEqual(e.activities, ['coffee', 'work']);
  assert.equal(e.mood, 3);
});

test('no mood token gives null, not 0', () => {
  const e = parseEntry('Quiet afternoon @reading', NOW);
  assert.equal(e.mood, null);
});

test('out-of-range mood is left in the text, not parsed', () => {
  const e = parseEntry('Long day m:9', NOW);
  assert.equal(e.mood, null);
  assert.ok(e.cleanText.includes('m:9'), e.cleanText);
});

test('@ inside an email address is not an activity', () => {
  const e = parseEntry('Emailed me@example.com about the trip', NOW);
  assert.deepEqual(e.activities, []);
  assert.ok(e.cleanText.includes('me@example.com'), e.cleanText);
});

test('no date typed defaults to now', () => {
  const e = parseEntry('Just a note', NOW);
  assert.ok(e.timestamp.startsWith('2026-11-19T10:00:00'), e.timestamp);
});

test('UK date order: 3/11 is 3 November', () => {
  const e = parseEntry('Rainy day 3/11 m:2', NOW);
  assert.ok(e.timestamp.startsWith('2026-11-03'), e.timestamp);
  assert.equal(e.cleanText, 'Rainy day');
});

test('timestamp includes an offset', () => {
  const e = parseEntry('Test', NOW);
  assert.match(e.timestamp, /[+-]\d{2}:\d{2}$/);
});

test('12.30 is read as a time when it is clearly one', () => {
  const e = parseEntry('Lunch at 12.30 @food', NOW);
  assert.ok(e.timestamp.startsWith('2026-11-19T12:30'), e.timestamp);
  assert.equal(e.cleanText, 'Lunch');
  assert.equal(e.dateFound, true);
});

test('12.30pm is read as a time', () => {
  const e = parseEntry('Meeting 12.30pm', NOW);
  assert.ok(e.timestamp.startsWith('2026-11-19T12:30'), e.timestamp);
});

test('prices and distances are not turned into times', () => {
  const price = parseEntry('Coffee £3.50 @coffee', NOW);
  assert.ok(price.cleanText.includes('£3.50'), price.cleanText);
  assert.equal(price.dateFound, false);

  const run = parseEntry('Ran 10.45 miles', NOW);
  assert.ok(run.cleanText.includes('10.45'), run.cleanText);
});

test('dateFound is false when no date is typed', () => {
  assert.equal(parseEntry('Just a note', NOW).dateFound, false);
});

test('standalone * marks an important entry and is removed from the text', () => {
  const e = parseEntry('Went out for dinner * @food', NOW);
  assert.equal(e.important, true);
  assert.equal(e.cleanText, 'Went out for dinner');
  assert.deepEqual(e.activities, ['food']);
});

test('entries without * are not important', () => {
  const e = parseEntry('Quick email #work', NOW);
  assert.equal(e.important, false);
  assert.deepEqual(e.tags, ['work']);
});

test('a tag-only entry has no text but keeps its tag and date', () => {
  const e = parseEntry('#wfh yesterday afternoon', NOW);
  assert.equal(e.cleanText, '');
  assert.deepEqual(e.tags, ['wfh']);
  assert.equal(e.dateFound, true);
});

console.log(`\n${passed} passed`);
