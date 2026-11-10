import { getNextLesson, getTopicProgress, youtubeSearchUrl } from '../core/learning.mjs';
import { lessonUrl, pageUrl } from '../core/router.js';

const escape = (text) => String(text).replace(/[&<>"']/g, (char) => ({
  '&':'&amp;',
  '<':'&lt;',
  '>':'&gt;',
  '"':'&quot;',
  "'":'&#39;'
}[char]));

const themeSvgColors = {
  '#04113a': 'var(--ink)',
  '#eaf0ff': 'var(--surface-soft)',
  '#edfff4': 'var(--surface-soft)',
  '#fff': 'var(--surface)',
  '#fdef03': 'var(--gold)',
  '#01a54e': 'var(--green)'
};

function themeDiagram(svg) {
  return svg.replace(/#(?:04113a|eaf0ff|edfff4|fff|fdef03|01a54e)\b/gi, (color) =>
    themeSvgColors[color.toLowerCase()]);
}

function progressBar(label, { completed, total, percent }) {
  return `<div class="learning-progress"><div class="learning-progress-copy"><span>${escape(label)}</span><strong>${completed} of ${total} lessons · ${percent}%</strong></div><div class="progress" role="progressbar" aria-label="${escape(label)}" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${completed}"><span style="width:${percent}%"></span></div></div>`;
}

function lessonLink(lesson, state, index) {
  const completed = state.completedLessons.includes(lesson.id);
  return `<a class="learning-list-link" href="${lessonUrl(lesson.id)}"><span class="lesson-index">${String(index + 1).padStart(2, '0')}</span><span><strong>${escape(lesson.title)}</strong><small>${completed ? 'Completed' : 'Ready to study'} · ${lesson.xp} XP</small></span><span aria-hidden="true">→</span></a>`;
}

function attemptTitle(attempt, lessons) {
  if (attempt.mode === 'mixed-review') return 'Mixed Logic review';
  return lessons.find((lesson) => lesson.id === attempt.mode)?.title || 'Logic practice';
}

export function dashboardView(topics, lessons, state, attempts = [], attemptsError = '') {
  const completed = Array.isArray(state.completedLessons) ? state.completedLessons : [];
  const next = getNextLesson(lessons, completed);
  const logicTopic = topics.find((topic) => topic.id === 'logic') || { lessonIds: [] };
  const logicProgress = getTopicProgress(logicTopic, completed);
  const xpInLevel = state.xp % 150;
  const xpToLevel = xpInLevel ? 150 - xpInLevel : 150;
  const nextStep = next
    ? `<article class="continue-card clay"><div class="lesson-index">${String(lessons.indexOf(next) + 1).padStart(2, '0')}</div><div><span class="tag">${completed.length ? 'Keep your momentum' : 'Your first lesson is ready'}</span><h2>${escape(next.title)}</h2><p>Read a worked example, try a short self-check, and mark the lesson complete when you’re ready.</p><a class="button button-primary" href="${lessonUrl(next.id)}">Continue learning</a></div></article>`
    : '<article class="learning-complete clay"><span class="tag">Logic pathway</span><h2>All Logic lessons complete</h2><p>Nice work. Revisit a lesson or check your understanding with a quiz.</p><a class="button button-primary" href="../pages/quizzes.html">Explore Logic quizzes</a></article>';
  const topicCards = topics.map((topic) => {
    const topicProgress = getTopicProgress(topic, completed);
    const available = topic.id === 'logic';
    const body = available
      ? `<a class="button button-secondary" href="${pageUrl('courses')}">Explore course</a>`
      : '<span class="tag">Coming soon</span>';
    return `<article class="mini-topic clay"><h3>${escape(topic.title)}</h3><p>${available ? `${topicProgress.completed} of ${topicProgress.total} lessons · ${topicProgress.percent}%` : 'Lessons are being prepared.'}</p>${available ? `<div class="progress" role="progressbar" aria-label="${escape(topic.title)} progress" aria-valuemin="0" aria-valuemax="${topicProgress.total}" aria-valuenow="${topicProgress.completed}"><span style="width:${topicProgress.percent}%"></span></div>` : ''}${body}</article>`;
  }).join('');
  const recentAttempts = attemptsError
    ? `<p class="quiz-error" role="alert">${escape(attemptsError)}</p>`
    : Array.isArray(attempts) && attempts.length
    ? `<ol class="dashboard-attempts">${attempts.slice(0, 3).map((attempt) => `<li><span>${escape(attemptTitle(attempt, lessons))}</span><strong>${attempt.score} / ${attempt.total}</strong></li>`).join('')}</ol>`
    : '<p>No quiz attempts yet. Start with a short, untimed Logic quiz whenever you’re ready.</p>';

  return `<section class="learning-hero dashboard-welcome clay"><p class="tag">Your study space</p><h1>Welcome back, ${escape(state.nickname || 'Fisher learner')}.</h1><p>Take one small step through discrete mathematics at your own pace. Your progress stays on this device unless you sign in to sync it.</p><div class="learning-actions"><a class="button button-primary" href="${next ? lessonUrl(next.id) : pageUrl('quizzes')}">${next ? 'Continue learning' : 'Choose a quiz'}</a><a class="button button-secondary" href="${pageUrl('courses')}">Explore courses</a></div></section><section class="dashboard-overview" aria-label="Your learning at a glance"><article class="stat-card clay"><div class="ring" style="--p:${xpInLevel / 1.5}"><div><strong class="num">${state.xp}</strong><small>XP</small></div></div><div><h2>Level ${state.level}</h2><p>${xpToLevel} XP until your next level</p></div></article><article class="streak clay"><p class="tag">Study streak</p><p class="streak-value num">${state.streak} day${state.streak === 1 ? '' : 's'}</p><p>Build a steady habit one lesson at a time.</p></article><article class="streak clay">${progressBar('Logic course', logicProgress)}<a class="button button-secondary" href="${pageUrl('progress')}">View all progress</a></article></section><section class="learning-section" aria-labelledby="dashboard-next-heading"><div class="section-heading"><div><h2 id="dashboard-next-heading">Your next step</h2><p>A clear place to pick up or begin.</p></div></div>${nextStep}</section><section class="learning-section" aria-labelledby="dashboard-topics-heading"><div class="section-heading"><div><h2 id="dashboard-topics-heading">Course map</h2><p>Only published lessons count toward progress.</p></div></div><div class="topic-progress">${topicCards}</div></section><section class="learning-section dashboard-lower"><article class="clay learning-panel"><div class="section-heading"><div><h2>Recent quiz practice</h2><p>Practice scores do not change XP or course completion.</p></div><a href="${pageUrl('quizzes')}">Open quizzes</a></div>${recentAttempts}</article><article class="clay learning-panel"><p class="tag">Study tools</p><h2>Choose how to learn today</h2><div class="learning-tool-links"><a href="${pageUrl('practice')}">Practice with feedback</a><a href="${pageUrl('assessments')}">Try a Logic checkpoint</a><a href="${pageUrl('profile')}">View your profile</a></div></article></section>`;
}

export function coursesView(topics, lessons, state) {
  const completed = Array.isArray(state.completedLessons) ? state.completedLessons : [];
  const cards = topics.map((topic) => {
    const topicLessons = topic.id === 'logic'
      ? lessons.filter((lesson) => topic.lessonIds.includes(lesson.id))
      : [];
    if (!topicLessons.length) {
      return `<article class="course-card course-card-unavailable clay"><span class="tag">${escape(topic.scopeLabel)}</span><h2>${escape(topic.title)}</h2><p>${escape(topic.summary)}</p><p>Lesson content is being prepared. This course is not available to study yet.</p><span class="course-status">Coming soon · no lessons published</span></article>`;
    }

    const courseProgress = getTopicProgress(topic, completed);
    const lessonRows = topicLessons.map((lesson, index) => lessonLink(lesson, state, index)).join('');
    const resource = youtubeSearchUrl('discrete mathematics logic propositions connectives truth tables quantifiers');
    return `<article class="course-card course-card-available clay"><div class="course-card-heading"><span class="tag">${escape(topic.scopeLabel)}</span><span class="course-status">Available now</span></div><h2>${escape(topic.title)}</h2><p>${escape(topic.summary)} Follow the sequence, revisit any lesson, and use the worked examples to check each idea.</p>${progressBar('Course progress', courseProgress)}<div class="course-lesson-list" aria-label="Logic lessons">${lessonRows}</div><div class="course-card-actions"><a class="button button-primary" href="${lessonUrl(getNextLesson(topicLessons, completed)?.id || topicLessons[0].id)}">${courseProgress.completed === courseProgress.total ? 'Review lessons' : 'Start or continue'}</a><a class="text-link" href="${resource}" target="_blank" rel="noopener noreferrer">Watch Logic lessons on YouTube <span aria-hidden="true">↗</span></a></div></article>`;
  }).join('');

  return `<section class="learning-page-intro"><p class="tag">Course catalogue</p><h1>Learn one idea at a time.</h1><p>Start with the complete Logic pathway. Other topics are clearly marked until their lessons are ready.</p></section><section class="course-grid course-grid-rich" aria-label="Courses">${cards}</section><aside class="learning-note inset"><h2>How course progress works</h2><p>Only completed lessons in published courses count. Quiz and practice scores are for learning and do not award XP.</p></aside>`;
}

export function lessonsView(lessons, state, lessonId) {
  const safeLessons = Array.isArray(lessons) ? lessons : [];
  const lesson = safeLessons.find((item) => item.id === lessonId) || safeLessons[0];
  if (!lesson) {
    return '<section class="empty clay"><h1>Lessons are not available yet.</h1><p>Check back when lesson content is published.</p></section>';
  }
  const completed = Array.isArray(state.completedLessons) && state.completedLessons.includes(lesson.id);
  const index = safeLessons.findIndex((item) => item.id === lesson.id);
  const sections = lesson.sections.map((section, sectionIndex) => {
    const sectionId = `lesson-section-${sectionIndex + 1}`;
    const practice = section.tryAnswer
      ? `<aside class="try-card inset" aria-labelledby="${sectionId}-practice"><span class="tag">Pause and think</span><h3 id="${sectionId}-practice">Try it yourself</h3><p>${escape(section.body)}</p><button class="button button-secondary" type="button" data-reveal="${lesson.id}" aria-controls="answer-${lesson.id}">Reveal explanation</button><div id="answer-${lesson.id}" class="answer" hidden><p><strong>Explanation:</strong> ${escape(section.tryAnswer)}</p></div></aside>`
      : '';
    const diagram = section.diagram
      ? `<figure class="diagram inset">${themeDiagram(section.diagram)}</figure>`
      : '';
    return `<section class="lesson-section" id="${sectionId}"><h2>${escape(section.heading)}</h2><p>${escape(section.body)}</p>${diagram}${practice}</section>`;
  }).join('');
  const video = youtubeSearchUrl(`${lesson.title} discrete mathematics lecture`);
  const lessonProgress = getTopicProgress({ lessonIds: safeLessons.map((item) => item.id) }, state.completedLessons);
  const lessonNav = safeLessons.map((item, lessonIndex) => lessonLink(item, state, lessonIndex)).join('');
  const previous = safeLessons[index - 1];
  const next = safeLessons[index + 1];

  return `<div class="lesson-layout lesson-layout-rich"><article class="lesson-content lesson-content-rich clay"><div class="lesson-heading"><p class="lesson-meta">Logic · ${escape(lesson.xp)} XP · Lesson ${index + 1} of ${safeLessons.length}</p><h1>${escape(lesson.title)}</h1><p>Take your time. Work through each idea, then pause at the self-check to explain it in your own words.</p>${progressBar('Logic lesson progress', lessonProgress)}</div><nav class="lesson-outline inset" aria-label="On this page"><strong>In this lesson</strong><div>${lesson.sections.map((section, sectionIndex) => `<a href="#lesson-section-${sectionIndex + 1}">${escape(section.heading)}</a>`).join('')}</div></nav>${sections}<aside class="lesson-resources inset"><h2>Want another explanation?</h2><p>Explore optional videos from other educators. These open YouTube search results in a new tab; choose the explanation that works for you.</p><a class="button button-secondary" href="${video}" target="_blank" rel="noopener noreferrer">Search YouTube for this lesson <span aria-hidden="true">↗</span></a></aside><div class="lesson-actions">${previous ? `<a class="button button-secondary" href="${lessonUrl(previous.id)}">← Previous lesson</a>` : `<a class="button button-secondary" href="${pageUrl('courses')}">← Courses</a>`}<button class="button ${completed ? 'button-secondary' : 'button-primary'}" data-complete="${lesson.id}" ${completed ? 'disabled' : ''}>${completed ? 'Lesson completed' : `Mark lesson complete · +${lesson.xp} XP`}</button>${next ? `<a class="button button-secondary" href="${lessonUrl(next.id)}">Next lesson →</a>` : `<a class="button button-secondary" href="${pageUrl('quizzes')}">Practice with a quiz →</a>`}</div></article><aside class="lesson-rail lesson-rail-rich clay"><h2>Logic pathway</h2>${progressBar('Lessons completed', lessonProgress)}<nav aria-label="Logic lesson list">${lessonNav}</nav><a class="button button-primary" href="${pageUrl('practice')}">Try practice</a></aside></div>`;
}
