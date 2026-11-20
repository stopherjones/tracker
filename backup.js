// backup.js
// Full-data backup: export all entries to a JSON file, and import one back.
// Import merges by id, so importing the same file twice never creates duplicates.

const FORMAT = 'tracker-backup';
const VERSION = 1;
export const LAST_EXPORT_KEY = 'tracker.lastExportedAt';

// Downloads every entry as a JSON file and records when it happened.
export function exportBackup(entries) {
  const exportedAt = new Date().toISOString();
  const payload = { format: FORMAT, version: VERSION, exportedAt, entries };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const day = new Date().toLocaleDateString('en-CA');
  const link = document.createElement('a');
  link.href = url;
  link.download = `tracker-backup-${day}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  localStorage.setItem(LAST_EXPORT_KEY, exportedAt);
}

function isValidEntry(e) {
  return (
    e !== null &&
    typeof e === 'object' &&
    typeof e.id === 'string' &&
    typeof e.timestamp === 'string' &&
    !Number.isNaN(Date.parse(e.timestamp)) &&
    typeof e.rawText === 'string' &&
    typeof e.cleanText === 'string' &&
    Array.isArray(e.tags) &&
    Array.isArray(e.activities) &&
    (e.mood === null || (Number.isInteger(e.mood) && e.mood >= 1 && e.mood <= 5))
  );
}

/**
 * Reads backup text. Throws a readable error if the file isn't a backup.
 * Entries that fail validation are counted, not imported.
 */
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!data || data.format !== FORMAT || !Array.isArray(data.entries)) {
    throw new Error('This does not look like a tracker backup.');
  }

  const entries = [];
  let invalid = 0;
  for (const e of data.entries) {
    if (isValidEntry(e)) entries.push(e);
    else invalid++;
  }
  return { entries, invalid };
}
