// export.js
// Builds the one-page weekly grid: last 7 complete days across, Morning /
// Afternoon / Evening down. Rendered into #week-print and printed to PDF.

const MAX_PER_CELL = 3;
const BANDS = ['morning', 'afternoon', 'evening'];
const BAND_LABELS = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };

const dayKey = (date) => date.toLocaleDateString('en-CA'); // YYYY-MM-DD, local time
const dayHeader = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const rangeFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// Before 12:00 is Morning, 12:00 to 16:59 is Afternoon, 17:00 onwards is Evening.
function bandFor(date) {
  const h = date.getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

// The seven days before today, oldest first. Today is never included.
export function lastSevenCompleteDays(now = new Date()) {
  const days = [];
  for (let i = 7; i >= 1; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  return days;
}

function buildGrid(entries, now) {
  const days = lastSevenCompleteDays(now);
  const index = new Map(days.map((d, i) => [dayKey(d), i]));
  const grid = days.map((date) => ({
    date,
    cells: { morning: [], afternoon: [], evening: [] },
  }));

  const sorted = [...entries].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  for (const e of sorted) {
    const date = new Date(e.timestamp);
    const i = index.get(dayKey(date));
    if (i === undefined) continue;
    grid[i].cells[bandFor(date)].push(e);
  }
  return { days, grid };
}

function moodClass(mood) {
  if (mood === null || mood === undefined) return '';
  if (mood >= 4) return 'mood-good';
  if (mood === 3) return 'mood-ok';
  return 'mood-low';
}

function renderCell(entries) {
  const td = document.createElement('td');
  if (entries.length === 0) return td;

  for (const e of entries.slice(0, MAX_PER_CELL)) {
    const p = document.createElement('p');
    p.className = moodClass(e.mood);
    p.textContent = e.cleanText;
    td.append(p);
  }

  if (entries.length > MAX_PER_CELL) {
    const more = document.createElement('p');
    more.className = 'more';
    more.textContent = `+${entries.length - MAX_PER_CELL} more`;
    td.append(more);
  }

  const moods = entries.map((e) => e.mood).filter((m) => m !== null);
  if (moods.length) {
    const avg = moods.reduce((a, b) => a + b, 0) / moods.length;
    const mood = document.createElement('p');
    mood.className = `cell-mood ${moodClass(avg)}`;
    mood.textContent = avg.toFixed(1);
    td.append(mood);
  }

  return td;
}

/**
 * Renders the weekly grid into `container`. Call window.print() afterwards.
 */
export function renderWeekPrint(container, entries, now = new Date()) {
  const { days, grid } = buildGrid(entries, now);

  const title = document.createElement('h1');
  title.textContent = 'Activity review';

  const range = document.createElement('p');
  range.className = 'range';
  range.textContent = `${rangeFormat.format(days[0])} to ${rangeFormat.format(days[6])}`;

  const table = document.createElement('table');

  // Explicit column widths so seven day columns always fit the page width.
  const colgroup = document.createElement('colgroup');
  const bandCol = document.createElement('col');
  bandCol.style.width = '12%';
  colgroup.append(bandCol);
  for (let i = 0; i < grid.length; i++) {
    const col = document.createElement('col');
    col.style.width = `${88 / grid.length}%`;
    colgroup.append(col);
  }

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.append(document.createElement('th'));
  for (const day of grid) {
    const th = document.createElement('th');
    th.textContent = dayHeader.format(day.date);
    headRow.append(th);
  }
  thead.append(headRow);

  const tbody = document.createElement('tbody');
  for (const band of BANDS) {
    const row = document.createElement('tr');
    const label = document.createElement('th');
    label.className = 'band';
    label.textContent = BAND_LABELS[band];
    row.append(label);
    for (const day of grid) {
      row.append(renderCell(day.cells[band]));
    }
    tbody.append(row);
  }

  table.append(colgroup, thead, tbody);
  container.replaceChildren(title, range, table);
}
