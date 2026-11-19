// app.js
import { parseEntry } from './parser.js';
import { storage } from './storage.js';

const form = document.getElementById('entry-form');
const input = document.getElementById('entry-input');
const errorEl = document.getElementById('error');
const feed = document.getElementById('feed');

const dayFormatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const timeFormatter = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

function dayLabel(date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return dayFormatter.format(date);
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function clearError() {
  errorEl.textContent = '';
  errorEl.hidden = true;
}

function render(entries) {
  feed.replaceChildren();

  if (entries.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Nothing logged yet. Type something above and press Enter.';
    feed.append(empty);
    return;
  }

  // Oldest first, so the newest entry sits at the bottom next to the input.
  const sorted = [...entries].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  let currentDay = null;
  for (const entry of sorted) {
    const date = new Date(entry.timestamp);
    const day = date.toDateString();

    if (day !== currentDay) {
      currentDay = day;
      const heading = document.createElement('h2');
      heading.className = 'day-heading';
      heading.textContent = dayLabel(date);
      feed.append(heading);
    }

    feed.append(renderEntry(entry, date));
  }
}

function renderEntry(entry, date) {
  const card = document.createElement('article');
  card.className = 'entry';

  const time = document.createElement('div');
  time.className = 'entry-time';
  time.textContent = timeFormatter.format(date);

  const body = document.createElement('div');
  body.className = 'entry-body';

  const text = document.createElement('p');
  text.className = 'entry-text';
  text.textContent = entry.cleanText;

  const meta = document.createElement('div');
  meta.className = 'entry-meta';
  const parts = [];
  if (entry.mood !== null) parts.push(`Mood ${entry.mood}/5`);
  parts.push(...entry.activities.map((a) => `@${a}`));
  parts.push(...entry.tags.map((t) => `#${t}`));
  meta.textContent = parts.join('  ·  ');

  body.append(text);
  if (parts.length) body.append(meta);

  const del = document.createElement('button');
  del.className = 'delete';
  del.type = 'button';
  del.setAttribute('aria-label', 'Delete entry');
  del.textContent = '×';
  del.addEventListener('click', async () => {
    await storage.deleteEntry(entry.id);
    await refresh();
  });

  card.append(time, body, del);
  return card;
}

async function refresh() {
  render(await storage.getEntries());
  // Keep the newest entry visible at the bottom of the feed.
  window.scrollTo({ top: document.body.scrollHeight });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();

  const raw = input.value.trim();
  if (!raw) return;

  const parsed = parseEntry(raw);
  if (!parsed.cleanText) {
    showError('Add a few words about what you did, not just a date or tag.');
    return;
  }

  await storage.addEntry(parsed);
  input.value = '';
  await refresh();
});

refresh();
