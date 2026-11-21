// app.js
import { parseEntry } from './parser.js';
import { storage } from './storage.js';
import { exportWeekPdf } from './export.js';
import { suggestionsFor, applySuggestion } from './suggest.js';
import { exportBackup, parseBackup, LAST_EXPORT_KEY } from './backup.js';
import { splitHobbies, hobbyColours } from './hobbies.js';

const form = document.getElementById('entry-form');
const input = document.getElementById('entry-input');
const errorEl = document.getElementById('error');
const suggestionsEl = document.getElementById('suggestions');
const backupStatus = document.getElementById('backup-status');
const importFile = document.getElementById('import-file');
const feed = document.getElementById('feed');

// Which past days are expanded. Kept across re-renders so the view doesn't collapse.
const openDays = new Set();

const dayFormatter = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const timeFormatter = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

const dayKey = (date) => date.toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

function dayLabel(date, today) {
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(date) === dayKey(today)) return 'Today';
  if (dayKey(date) === dayKey(yesterday)) return 'Yesterday';
  return dayFormatter.format(date);
}

// An entry is valid if it has any content: text, a tag, an activity or a mood.
function hasContent(parsed) {
  return Boolean(parsed.cleanText) || parsed.tags.length > 0 || parsed.activities.length > 0 || parsed.mood !== null;
}

// Chips for the word being typed (mood, #tags, @activities).
async function updateSuggestions() {
  const entries = await storage.getEntries();
  const chips = suggestionsFor(input.value, entries);
  suggestionsEl.replaceChildren(
    ...chips.map((chip) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip';
      button.textContent = chip.label;
      // Keep focus in the input, so the phone keyboard stays open.
      button.addEventListener('pointerdown', (e) => e.preventDefault());
      button.addEventListener('click', () => {
        input.value = applySuggestion(input.value, chip.insert);
        input.focus();
        updateSuggestions();
      });
      return button;
    })
  );
}

input.addEventListener('input', updateSuggestions);

// Tells the user how long since the last backup, and warns after two weeks.
function showBackupStatus() {
  const last = localStorage.getItem(LAST_EXPORT_KEY);
  if (!last) {
    backupStatus.textContent = 'No backup yet. Back up your entries to protect them.';
    backupStatus.classList.add('warn');
    return;
  }
  const days = Math.floor((Date.now() - Date.parse(last)) / 86400000);
  backupStatus.textContent = days === 0 ? 'Last backup: today' : `Last backup: ${days} day${days === 1 ? '' : 's'} ago`;
  backupStatus.classList.toggle('warn', days >= 14);
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function clearError() {
  errorEl.textContent = '';
  errorEl.hidden = true;
}

const byTimeAsc = (a, b) => new Date(a.timestamp) - new Date(b.timestamp);

async function render() {
  const entries = await storage.getEntries();
  const today = new Date();
  const todayKey = dayKey(today);

  // Group by local day.
  const groups = new Map();
  for (const entry of [...entries].sort(byTimeAsc)) {
    const date = new Date(entry.timestamp);
    const key = dayKey(date);
    if (!groups.has(key)) groups.set(key, { date, entries: [] });
    groups.get(key).entries.push(entry);
  }

  feed.replaceChildren();

  // 1. Today, always expanded, at the top under the input.
  const todayGroup = groups.get(todayKey);
  const todaySection = document.createElement('section');
  todaySection.className = 'today';
  if (todayGroup) {
    todayGroup.entries.forEach((e) => todaySection.append(renderEntry(e)));
  } else {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Nothing logged today yet.';
    todaySection.append(empty);
  }
  feed.append(todaySection);

  // 2. Visual break, then past days as concertinas, oldest at top, newest at bottom.
  const pastKeys = [...groups.keys()].filter((k) => k !== todayKey).sort();
  if (pastKeys.length) {
    const divider = document.createElement('div');
    divider.className = 'divider';
    feed.append(divider);

    for (const key of pastKeys) {
      feed.append(renderDay(groups.get(key), today));
    }
  }
}

function renderDay(group, today) {
  const details = document.createElement('details');
  details.className = 'day';
  details.dataset.day = dayKey(group.date);
  details.open = openDays.has(details.dataset.day);

  details.addEventListener('toggle', () => {
    if (details.open) openDays.add(details.dataset.day);
    else openDays.delete(details.dataset.day);
  });

  const summary = document.createElement('summary');
  const moods = group.entries.map((e) => e.mood).filter((m) => m !== null);
  const avg = moods.length ? ` · avg mood ${(moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1)}` : '';
  summary.textContent = `${dayLabel(group.date, today)} · ${group.entries.length} ${group.entries.length === 1 ? 'entry' : 'entries'}${avg}`;
  details.append(summary);

  const content = document.createElement('div');
  content.className = 'day-content';
  group.entries.forEach((e) => content.append(renderEntry(e)));
  details.append(content);

  return details;
}

function renderEntry(entry) {
  const card = document.createElement('article');
  card.className = 'entry';

  const date = new Date(entry.timestamp);
  const time = document.createElement('div');
  time.className = 'entry-time';
  time.textContent = timeFormatter.format(date);

  const body = document.createElement('div');
  body.className = 'entry-body';
  body.tabIndex = 0;
  body.setAttribute('role', 'button');
  body.setAttribute('aria-label', 'Edit entry');

  const text = document.createElement('p');
  text.className = 'entry-text';
  const pieces = entry.hobby
    ? [{ text: entry.cleanText, hobby: true, name: entry.cleanText.toLowerCase() }]
    : splitHobbies(entry.cleanText, entry.hobbies);
  for (const piece of pieces) {
    if (piece.hobby) {
      const mark = document.createElement('mark');
      mark.className = 'hobby';
      mark.textContent = piece.text;
      const style = hobbyColours(piece.name);
      if (style) {
        mark.style.background = `rgb(${style.fill.join(',')})`;
        mark.style.color = `rgb(${style.text.join(',')})`;
      }
      text.append(mark);
    } else {
      text.append(document.createTextNode(piece.text));
    }
  }
  if (entry.important) text.classList.add('starred');
  if (entry.cleanText) body.append(text);

  const parts = [];
  if (entry.mood !== null) parts.push(`Mood ${entry.mood}/5`);
  parts.push(...entry.tags.map((t) => `#${t}`));
  if (parts.length) {
    const meta = document.createElement('div');
    meta.className = 'entry-meta';
    meta.textContent = parts.join('  ·  ');
    body.append(meta);
  }

  body.addEventListener('click', () => startEdit(card, entry));
  body.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startEdit(card, entry);
  });

  const del = document.createElement('button');
  del.className = 'delete';
  del.type = 'button';
  del.setAttribute('aria-label', 'Delete entry');
  del.textContent = '×';
  del.addEventListener('click', async () => {
    await storage.deleteEntry(entry.id);
    await render();
  });

  card.append(time, body, del);
  return card;
}

function startEdit(card, entry) {
  if (card.classList.contains('editing')) return;
  card.classList.add('editing');
  card.replaceChildren();

  const editor = document.createElement('div');
  editor.className = 'editor';

  const field = document.createElement('input');
  field.type = 'text';
  field.className = 'edit-input';
  field.value = entry.rawText;
  field.setAttribute('aria-label', 'Edit entry text');

  const error = document.createElement('p');
  error.className = 'error';
  error.hidden = true;

  const actions = document.createElement('div');
  actions.className = 'edit-actions';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'secondary';
  cancel.textContent = 'Cancel';

  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'primary';
  save.textContent = 'Save';

  actions.append(cancel, save);
  editor.append(field, error, actions);
  card.append(editor);
  field.focus();

  const finish = () => render();

  const doSave = async () => {
    const raw = field.value.trim();
    if (!raw) return;
    const parsed = parseEntry(raw, new Date(entry.timestamp));
    if (!hasContent(parsed)) {
      error.textContent = 'Add something to log: a few words, a #tag, an @activity or a mood.';
      error.hidden = false;
      return;
    }
    // If no date is typed in the edit, keep the original time.
    const changes = parsed.dateFound ? parsed : { ...parsed, timestamp: entry.timestamp };
    await storage.updateEntry(entry.id, changes);
    await finish();
  };

  cancel.addEventListener('click', finish);
  save.addEventListener('click', doSave);
  field.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSave();
    if (e.key === 'Escape') finish();
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();

  const raw = input.value.trim();
  if (!raw) return;

  const parsed = parseEntry(raw);
  if (!hasContent(parsed)) {
    showError('Add something to log: a few words, a #tag, an @activity or a mood.');
    return;
  }

  await storage.addEntry(parsed);
  input.value = '';
  await render();
  await updateSuggestions();
});

document.getElementById('export-week').addEventListener('click', async () => {
  const entries = await storage.getEntries();
  exportWeekPdf(entries);
});

document.getElementById('export-backup').addEventListener('click', async () => {
  exportBackup(await storage.getEntries());
  showBackupStatus();
});

document.getElementById('import-backup').addEventListener('click', () => importFile.click());

importFile.addEventListener('change', async () => {
  const file = importFile.files[0];
  importFile.value = '';
  if (!file) return;
  try {
    const { entries, invalid } = parseBackup(await file.text());
    const { added, duplicates } = await storage.mergeEntries(entries);
    let message = `Restored ${added} new ${added === 1 ? 'entry' : 'entries'}`;
    if (duplicates) message += `, ${duplicates} already on this device`;
    if (invalid) message += `, ${invalid} skipped as invalid`;
    backupStatus.textContent = `${message}.`;
    backupStatus.classList.remove('warn');
    await render();
    await updateSuggestions();
  } catch (err) {
    backupStatus.textContent = err.message;
    backupStatus.classList.add('warn');
  }
});

render();
showBackupStatus();
