const topicPages = new Set(['dashboard', 'courses', 'progress', 'quizzes']);
const lessonPages = new Set(['dashboard', 'courses', 'lessons', 'progress']);
const quizPages = new Set(['quizzes', 'practice', 'assessments', 'flashcards']);

export async function loadPageData(page, load) {
  const [topics, lessons, bank] = await Promise.all([
    topicPages.has(page) ? load('data/topics.json') : null,
    lessonPages.has(page) ? load('data/lessons/logic.json') : null,
    quizPages.has(page) ? load('data/quizzes/logic.json') : null
  ]);
  return { topics, lessons, bank };
}
