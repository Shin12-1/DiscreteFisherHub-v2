export function getNextLesson(lessons, completedIds) {
  if (!Array.isArray(lessons) || lessons.length === 0) {
    return null;
  }
  const completed = new Set(Array.isArray(completedIds) ? completedIds : []);
  return lessons.find((lesson) => lesson && typeof lesson.id === 'string' && !completed.has(lesson.id)) || null;
}

export function getTopicProgress(topic, completedIds) {
  const lessonIds = Array.isArray(topic?.lessonIds)
    ? [...new Set(topic.lessonIds.filter((id) => typeof id === 'string' && id))]
    : [];
  const completed = new Set(Array.isArray(completedIds) ? completedIds : []);
  const completedCount = lessonIds.filter((id) => completed.has(id)).length;
  return {
    completed: completedCount,
    total: lessonIds.length,
    percent: lessonIds.length ? Math.round((completedCount / lessonIds.length) * 100) : 0
  };
}

export function youtubeSearchUrl(query) {
  if (typeof query !== 'string' || !query.trim()) {
    throw new TypeError('A non-empty YouTube search query is required.');
  }
  const url = new URL('https://www.youtube.com/results');
  url.searchParams.set('search_query', query.trim());
  return url.href;
}
