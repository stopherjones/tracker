import { splitHobbies } from './hobbies.js';
// export.js
// Builds the one-page weekly PDF with jsPDF (loaded in index.html).
// Last 7 complete days across; Morning / Afternoon / Evening down.
// Each block shows context pills (from #tags) above the detailed activities.
// Starred entries (*) are drawn first, and when a block runs out of room the
// rest are counted as "+N more".

const BANDS = ['morning', 'afternoon', 'evening'];
const BAND_LABELS = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };

// A4 landscape, in mm
const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 10;
const LABEL_W = 26;
const HEADER_H = 9;
const TITLE_H = 26;
const COLS = 7;
const DAY_W = (PAGE_W - 2 * MARGIN - LABEL_W) / COLS;
const TABLE_TOP = MARGIN + TITLE_H;
const BAND_H = (PAGE_H - MARGIN - TABLE_TOP - HEADER_H) / BANDS.length;

const PILL_H = 4.2;
const LINE_H = 3.3;      // line height for 8pt text
const ENTRY_GAP = 1.2;
const MORE_H = 3.6;
const MOOD_RESERVE = 5;  // room at the bottom of a cell for the average

const C = {
  border: [208, 208, 212],
  orange: [201, 122, 0],
  grey: [110, 110, 115],
  text: [28, 28, 30],
  good: [21, 128, 61],
  ok: [29, 78, 216],
  low: [185, 28, 28],
  pill: [240, 236, 228],
  header: [255, 243, 224],
  hobby: [253, 230, 138],
};

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
  const grid = days.map((date) => ({ date, cells: { morning: [], afternoon: [], evening: [] } }));

  const sorted = [...entries].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  for (const e of sorted) {
    const date = new Date(e.timestamp);
    const i = index.get(dayKey(date));
    if (i === undefined) continue;
    grid[i].cells[bandFor(date)].push(e);
  }
  return { days, grid };
}

// Priority: starred (*), hobby (@), or with a mood (m:). Priority entries come
// first, then chronological within each group.
function isPriority(e) {
  return Boolean(e.important) || (e.hobbies || []).length > 0 || (e.mood !== null && e.mood !== undefined);
}

function priorityOrder(list) {
  return [...list].sort(
    (a, b) => (isPriority(b) ? 1 : 0) - (isPriority(a) ? 1 : 0) ||
      new Date(a.timestamp) - new Date(b.timestamp)
  );
}

// Unique tags across a block, in the order they first appear.
function cellTags(list) {
  const seen = new Set();
  const out = [];
  for (const e of list) {
    for (const t of e.tags || []) {
      if (!seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
  }
  return out;
}

const pillLabel = (tag) => {
  const s = tag.replace(/-/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function moodColour(mood) {
  if (mood === null || mood === undefined) return C.text;
  if (mood >= 4) return C.good;
  if (mood >= 3) return C.ok;
  return C.low;
}

// Draws context pills, wrapping onto new lines. Returns the height used.
function drawPills(doc, tags, x, y, maxW) {
  if (!tags.length) return 0;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  let cx = x;
  let cy = y;
  for (const tag of tags) {
    const label = pillLabel(tag);
    const w = doc.getTextWidth(label) + 3;
    if (cx > x && cx + w > x + maxW) {
      cx = x;
      cy += PILL_H + 1;
    }
    doc.setFillColor(...C.pill);
    doc.roundedRect(cx, cy, w, PILL_H, 1.5, 1.5, 'F');
    doc.setTextColor(...C.text);
    doc.text(label, cx + 1.5, cy + PILL_H - 1.3);
    cx += w + 1.2;
  }
  return cy + PILL_H - y;
}

function drawCell(doc, list, x, y, w, h) {
  doc.setDrawColor(...C.border);
  doc.rect(x, y, w, h);
  if (!list.length) return;

  const innerX = x + 1.8;
  const innerW = w - 3.6;
  const hasMood = list.some((e) => e.mood !== null && e.mood !== undefined);
  const limit = y + h - 1.5 - (hasMood ? MOOD_RESERVE : 0);

  // 1. Context pills at the top of the block.
  const pillsUsed = drawPills(doc, cellTags(list), innerX, y + 2, innerW);
  let cy = y + 2 + pillsUsed + (pillsUsed ? 2 : 0);

  // 2. Detailed activities, starred first. Stop when the next one won't fit.
  const ordered = priorityOrder(list.filter((e) => e.cleanText));
  let shown = 0;
  doc.setFontSize(8);
  for (let i = 0; i < ordered.length; i++) {
    const e = ordered[i];
    const lines = doc.splitTextToSize(e.cleanText, innerW);
    const needed = lines.length * LINE_H + ENTRY_GAP;
    const moreAfter = i < ordered.length - 1 ? MORE_H : 0;
    if (cy + needed + moreAfter > limit) break;

    doc.setFont('helvetica', e.important ? 'bold' : 'normal');
    doc.setTextColor(...moodColour(e.mood));
    // Draw each line piece by piece, shading hobby words behind the text.
    lines.forEach((line, n) => {
      const base = cy + 2.6 + n * LINE_H;
      let x = innerX;
      for (const piece of (e.hobby ? [{ text: line, hobby: true }] : splitHobbies(line, e.hobbies))) {
        const w = doc.getTextWidth(piece.text);
        if (piece.hobby) {
          doc.setFillColor(...C.hobby);
          doc.rect(x, base - 2.4, w, LINE_H, 'F');
        }
        doc.text(piece.text, x, base);
        x += w;
      }
    });
    cy += needed;
    shown++;
  }

  // 3. Count what didn't fit.
  const hidden = ordered.length - shown;
  if (hidden > 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(...C.grey);
    doc.text(`+${hidden} more`, innerX, cy + 2.4);
  }

  // 4. Mood average, bottom right.
  const moods = list.map((e) => e.mood).filter((m) => m !== null && m !== undefined);
  if (moods.length) {
    const avg = moods.reduce((a, b) => a + b, 0) / moods.length;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...moodColour(avg));
    doc.text(avg.toFixed(1), x + w - 2, y + h - 2, { align: 'right' });
  }
}

function drawTitle(doc, days) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...C.orange);
  doc.text('Activity review', PAGE_W / 2, MARGIN + 9, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...C.grey);
  const range = `${rangeFormat.format(days[0])} to ${rangeFormat.format(days[6])}`;
  doc.text(range, PAGE_W / 2, MARGIN + 16, { align: 'center' });
}

function drawTable(doc, grid) {
  doc.setLineWidth(0.2);
  // Header row: corner, then one cell per day
  doc.setDrawColor(...C.border);
  doc.setFillColor(...C.header);
  doc.rect(MARGIN, TABLE_TOP, LABEL_W, HEADER_H, 'FD');
  grid.forEach((day, i) => {
    const x = MARGIN + LABEL_W + i * DAY_W;
    // Set fill and stroke explicitly for every cell, so no earlier colour carries over.
    doc.setFillColor(...C.header);
    doc.setDrawColor(...C.border);
    doc.rect(x, TABLE_TOP, DAY_W, HEADER_H, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.text);
    doc.text(dayHeader.format(day.date), x + 1.8, TABLE_TOP + HEADER_H / 2 + 1.2);
  });

  // Band rows
  BANDS.forEach((band, r) => {
    const y = TABLE_TOP + HEADER_H + r * BAND_H;
    doc.setDrawColor(...C.border);
    doc.rect(MARGIN, y, LABEL_W, BAND_H);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C.text);
    doc.text(BAND_LABELS[band], MARGIN + 1.8, y + 4.5);

    grid.forEach((day, i) => {
      drawCell(doc, day.cells[band], MARGIN + LABEL_W + i * DAY_W, y, DAY_W, BAND_H);
    });
  });
}

/**
 * Builds the weekly PDF and downloads it.
 */
export function exportWeekPdf(entries, now = new Date()) {
  if (!window.jspdf) {
    alert('The PDF library did not load. Check your connection and try again.');
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const { days, grid } = buildGrid(entries, now);
  drawTitle(doc, days);
  drawTable(doc, grid);

  const from = dayKey(days[0]);
  const to = dayKey(days[6]);
  doc.save(`activity-review-${from}-to-${to}.pdf`);
}
