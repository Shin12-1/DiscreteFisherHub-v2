const topicPages = new Set(['dashboard', 'courses', 'progress', 'quizzes']);
const lessonPages = new Set(['dashboard', 'courses', 'lessons', 'progress']);
const quizPages = new Set(['dashboard', 'quizzes', 'practice', 'assessments', 'flashcards']);

export async function loadPageData(page, load) {
  const [topics, lessons, bank, notices] = await Promise.all([
    topicPages.has(page) ? load('data/topics.json') : null,
    lessonPages.has(page) ? load('data/lessons/logic.json') : null,
    quizPages.has(page) ? load('data/quizzes/logic.json') : null,
    page === 'dashboard' ? load('data/dashboard-notices.json') : null
  ]);
  return { topics, lessons, bank, notices };
}
