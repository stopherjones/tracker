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

// dateFound is only used while editing, so it is not stored.
function stripTransient({ dateFound, ...fields }) {
  return fields;
}

export const storage = {
  async getEntries() {
    return load();
  },

  async addEntry(parsed) {
    const entry = {
      id: makeId(),
      ...stripTransient(parsed),
      createdAt: new Date().toISOString(),
    };
    const entries = load();
    entries.push(entry);
    save(entries);
    return entry;
  },

  async updateEntry(id, changes) {
    const entries = load().map((e) =>
      e.id === id ? { ...e, ...stripTransient(changes), updatedAt: new Date().toISOString() } : e
    );
    save(entries);
  },

  // Adds entries whose id isn't already stored. Existing entries are never overwritten.
  async mergeEntries(incoming) {
    const existing = load();
    const known = new Set(existing.map((e) => e.id));
    const added = [];
    for (const e of incoming) {
      if (!known.has(e.id)) {
        known.add(e.id);
        added.push(e);
      }
    }
    save([...existing, ...added]);
    return { added: added.length, duplicates: incoming.length - added.length };
  },

  async deleteEntry(id) {
    save(load().filter((e) => e.id !== id));
  },
};
