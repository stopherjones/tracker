// storage.js
// All reads and writes go through here. Methods are async so a remote
// backend can replace localStorage later without touching the UI.

const KEY = 'tracker.entries.v1';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function save(entries) {
  localStorage.setItem(KEY, JSON.stringify(entries));
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export const storage = {
  async getEntries() {
    return load();
  },

  async addEntry(parsed) {
    const entry = {
      id: makeId(),
      ...parsed,
      createdAt: new Date().toISOString(),
    };
    const entries = load();
    entries.push(entry);
    save(entries);
    return entry;
  },

  async deleteEntry(id) {
    const entries = load().filter((e) => e.id !== id);
    save(entries);
  },
};
