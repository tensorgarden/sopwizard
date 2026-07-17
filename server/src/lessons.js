// Corrections marked as applying to future workflows are kept here and loaded
// into context before the next generation.

import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { redactText } from './redact.js';
import { DATA_ROOT } from './paths.js';

const FILE = join(DATA_ROOT, 'lessons.json');

export async function loadLessons() {
  let text;
  try {
    text = await readFile(FILE, 'utf8');
  } catch {
    return []; // no file yet
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    // A truncated or corrupt file is preserved, not overwritten — these are
    // hand-made corrections that shape future drafts. Set it aside so the next
    // write starts fresh.
    console.warn(`lessons.json is unreadable (${err.message}); preserving it as lessons.corrupt.json`);
    try {
      await rename(FILE, `${FILE.replace(/\.json$/, '')}.corrupt.json`);
    } catch {
      // If we can't move it, better to keep the corrupt file than to clobber it.
    }
    return [];
  }
}

export async function addLesson(lesson) {
  const lessons = await loadLessons();
  lessons.push({
    ...lesson,
    rule: redactText(lesson.rule),
    at: Date.now(),
  });
  await mkdir(DATA_ROOT, { recursive: true });
  const tmp = `${FILE}.tmp-${process.pid}`;
  await writeFile(tmp, JSON.stringify(lessons, null, 2));
  await rename(tmp, FILE);
  return lessons;
}
