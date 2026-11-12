import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateQuizBank } from '../js/core/quiz.mjs';
const root = resolve(import.meta.dirname, '..');
const read = async (file) => JSON.parse(await readFile(resolve(root,file),'utf8'));
const readText = async (file) => readFile(resolve(root,file),'utf8');
const fail = (message) => { throw new Error(message); };
const topics = await read('data/topics.json');
if (!Array.isArray(topics) || topics.length !== 9) fail('topics.json must contain exactly 9 topics.');
const ids = new Set();
for (const topic of topics) { if (!topic.id || ids.has(topic.id)) fail('Topic ids must be unique, non-empty strings.'); ids.add(topic.id); if (!topic.title || !topic.summary || !Array.isArray(topic.lessonIds)) fail(`Invalid topic: ${topic.id}`); if (!['CHED-aligned scope','Supplementary'].includes(topic.scopeLabel)) fail(`Invalid scope label: ${topic.id}`); }
const logic = await read('data/lessons/logic.json');
if (logic.topicId !== 'logic' || !Array.isArray(logic.lessons) || logic.lessons.length !== 3) fail('Logic must contain exactly 3 lessons.');
const quizzes = await read('data/quizzes/logic.json');
validateQuizBank(quizzes, logic.lessons);
const lessonIds = new Set();
for (const lesson of logic.lessons) { if (!lesson.id || lessonIds.has(lesson.id) || !lesson.title || !Number.isInteger(lesson.xp) || lesson.xp < 1) fail('Invalid logic lesson.'); lessonIds.add(lesson.id); if (!Array.isArray(lesson.sections) || lesson.sections.length < 5) fail(`Lesson ${lesson.id} needs 5 or more sections.`); const all = lesson.sections.map((s) => s.heading).join(' ').toLowerCase(); for (const word of ['why','definition','worked','common','try']) if (!all.includes(word)) fail(`Lesson ${lesson.id} is missing ${word} section.`); if (!lesson.sections.some((s) => typeof s.diagram === 'string' && s.diagram.includes('<svg'))) fail(`Lesson ${lesson.id} needs an inline SVG.`); if (!lesson.sections.some((s) => s.tryAnswer)) fail(`Lesson ${lesson.id} needs a try-answer.`); for (const section of lesson.sections) if (section.widget !== undefined && !['truth-table'].includes(section.widget)) fail(`Lesson ${lesson.id} uses an unknown widget: ${section.widget}`); }
for (const id of topics.find((topic) => topic.id === 'logic').lessonIds) if (!lessonIds.has(id)) fail(`Logic topic references unknown lesson: ${id}`);
const schema = await readText('supabase/schema.sql');
for (const snippet of ['alter table public.profiles enable row level security;', 'alter table public.lesson_progress enable row level security;', 'alter table public.quiz_attempts enable row level security;', 'grant select, insert (id, nickname), update (nickname) on public.profiles to authenticated;', 'create view public.leaderboard as']) if (!schema.includes(snippet)) fail(`Supabase schema is missing: ${snippet}`);
if (/disable row level security/i.test(schema) || /service_role/i.test(schema)) fail('Supabase schema must not disable RLS or reference a service role.');
console.log(`Data valid: ${topics.length} topics, ${logic.lessons.length} Logic lessons, and ${quizzes.quizzes.length} Logic quizzes.`);
