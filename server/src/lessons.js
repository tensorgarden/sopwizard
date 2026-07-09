// Durable lessons learned from review.
//
// When a reviewer corrects a step and marks the fix as applying to future
// workflows, or answers a clarification question, the outcome is kept here and
// loaded into context before the next generation — so each reviewed SOP makes
// the following drafts better.

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
