// Corrections marked as applying to future workflows are kept here and
// loaded into context before the next generation.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { redactText } from './redact.js';

const FILE = join(process.cwd(), 'data', 'lessons.json');

export async function loadLessons() {
  try {
    return JSON.parse(await readFile(FILE, 'utf8'));
  } catch {
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
  await mkdir(join(process.cwd(), 'data'), { recursive: true });
  await writeFile(FILE, JSON.stringify(lessons, null, 2));
  return lessons;
}
