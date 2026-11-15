import { getNextLesson, getTopicProgress, youtubeSearchUrl } from '../core/learning.mjs';
import { lessonUrl, pageUrl } from '../core/router.js';
import { truthWidgetMarkup } from '../components/truth-widget.mjs';
import { escapeHtml as escape } from '../core/html.mjs';
import { localDateKey } from '../core/dates.mjs';



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

function lessonLink(lesson, state, index, isCurrent = false) {
  const completed = state.completedLessons.includes(lesson.id);
  const current = isCurrent ? ' aria-current="page"' : '';
  return `<a class="learning-list-link"${current} href="${lessonUrl(lesson.id)}"><span class="lesson-index">${String(index + 1).padStart(2, '0')}</span><span><strong>${escape(lesson.title)}</strong><small>${completed ? 'Completed' : 'Ready to study'} · ${lesson.xp} XP</small></span><span aria-hidden="true">→</span></a>`;
}

function attemptTitle(attempt, lessons) {
  if (attempt.mode === 'mixed-review') return 'Mixed Logic review';
  return lessons.find((lesson) => lesson.id === attempt.mode)?.title || 'Logic practice';
}

function questionIndex(bank) {
  const questions = new Map();
  for (const quiz of Array.isArray(bank?.quizzes) ? bank.quizzes : []) {
    for (const question of Array.isArray(quiz.questions) ? quiz.questions : []) {
      questions.set(question.id, { ...question, lessonId: quiz.lessonId });
    }
  }
  return questions;
}

function dashboardGoalCard(activity) {
  const goal = activity?.goal === 'flashcards' ? 'flashcards' : 'lesson';
  const lessonCount = Array.isArray(activity?.today?.lessonIds) ? activity.today.lessonIds.length : 0;
  const flashcardCount = Array.isArray(activity?.today?.flashcardIds) ? activity.today.flashcardIds.length : 0;
  const count = goal === 'lesson' ? lessonCount : flashcardCount;
  const target = goal === 'lesson' ? 1 : 10;
  const progress = Math.min(count, target);
  const label = goal === 'lesson' ? 'lesson' : 'cards';
  return `<article class="streak daily-goal clay"><p class="tag">Daily goal</p><label for="dashboard-goal">Choose your goal</label><select id="dashboard-goal" data-dashboard-goal data-saved-goal="${goal}" data-lesson-count="${lessonCount}" data-flashcard-count="${flashcardCount}"><option value="lesson"${goal === 'lesson' ? ' selected' : ''}>One lesson</option><option value="flashcards"${goal === 'flashcards' ? ' selected' : ''}>10 flashcards</option></select><p data-dashboard-goal-progress-copy aria-live="polite">${progress} of ${target} ${label}</p><div class="progress" role="progressbar" data-dashboard-goal-progress aria-label="Daily goal progress" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${progress}"><span style="width:${progress / target * 100}%"></span></div><p data-dashboard-goal-status role="status" hidden></p></article>`;
}

function validDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isCurrentNotice(notice, today) {
  if (!notice || typeof notice !== 'object'
    || typeof notice.id !== 'string' || !notice.id.trim()
    || !['FVC', 'Instructor'].includes(notice.source)
    || typeof notice.title !== 'string' || !notice.title.trim()
    || typeof notice.body !== 'string' || !notice.body.trim()) return false;
  for (const key of ['publishedAt', 'dueAt', 'expiresAt']) {
    if (notice[key] !== undefined && !validDateOnly(notice[key])) return false;
  }
  return (!notice.publishedAt || notice.publishedAt <= today)
    && (!notice.expiresAt || notice.expiresAt >= today);
}

function formatNoticeDate(value) {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString(undefined, { timeZone: 'UTC' });
}

function dashboardReview(activity, lessons, questions) {
  const attempts = Array.isArray(activity?.recentEvents)
    ? activity.recentEvents.filter((event) => event?.type === 'quiz-attempt').slice(0, 3)
    : [];
  let content = '<p class="dashboard-empty">Complete a quiz to build your review list.</p>';
  if (attempts.length) {
    const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
    const groups = new Map();
    for (const attempt of attempts) {
      for (const questionId of new Set(Array.isArray(attempt.missedQuestionIds) ? attempt.missedQuestionIds : [])) {
        const question = questions.get(questionId);
        const lesson = lessonById.get(question?.lessonId);
        if (!question || !lesson) continue;
        const group = groups.get(lesson.id) || { lesson, missedCount: 0, questions: new Map() };
        group.missedCount += 1;
        group.questions.set(question.id, (group.questions.get(question.id) || 0) + 1);
        groups.set(lesson.id, group);
      }
    }
    const orderedGroups = [...groups.values()].sort((left, right) =>
      right.missedCount - left.missedCount || left.lesson.title.localeCompare(right.lesson.title));
    content = orderedGroups.length
      ? `<ol class="dashboard-review-groups">${orderedGroups.map((group) => {
        const questionRows = [...group.questions.entries()]
          .sort((left, right) => right[1] - left[1] || questions.get(left[0]).prompt.localeCompare(questions.get(right[0]).prompt))
          .map(([id, count]) => `<li><a href="${lessonUrl(group.lesson.id)}">${escape(questions.get(id).prompt)}</a>${count > 1 ? `<span>Missed ${count} times</span>` : ''}</li>`)
          .join('');
        return `<li><div class="dashboard-review-group-heading"><a href="${lessonUrl(group.lesson.id)}">${escape(group.lesson.title)}</a><span>${group.missedCount} missed</span></div><ul>${questionRows}</ul></li>`;
      }).join('')}</ol>`
      : '<p class="dashboard-empty">No missed questions from your recent attempts.</p>';
  }
  return `<article class="clay learning-panel dashboard-review"><div class="section-heading"><div><p class="tag">Needs review today</p><h2>Missed questions to revisit</h2></div><a href="${pageUrl('quizzes')}">Practice again</a></div>${content}</article>`;
}

function dashboardNotices(notices) {
  const today = localDateKey();
  const current = Array.isArray(notices) ? notices.filter((notice) => isCurrentNotice(notice, today)) : [];
  const content = current.length
    ? `<ul class="dashboard-notice-list">${current.map((notice) => `<li><div class="dashboard-notice-heading"><span class="tag">${escape(notice.source)}</span>${notice.dueAt ? `<time datetime="${escape(notice.dueAt)}">Due ${escape(formatNoticeDate(notice.dueAt))}</time>` : ''}</div><h3>${escape(notice.title)}</h3><p>${escape(notice.body)}</p></li>`).join('')}</ul>`
    : '<p class="dashboard-empty">No current announcements or deadlines.</p>';
  return `<article class="clay learning-panel dashboard-notices"><div class="section-heading"><div><p class="tag">FVC and instructor updates</p><h2>Announcements and deadlines</h2></div></div>${content}</article>`;
}

function recentActivity(activity, lessons, questions) {
  const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const events = Array.isArray(activity?.recentEvents) ? activity.recentEvents.slice(0, 3) : [];
  const rows = events.map((event) => {
    let label = '';
    if (event.type === 'lesson-completed') {
      label = `Completed ${lessonById.get(event.id)?.title || 'a lesson'}`;
    } else if (event.type === 'flashcard-revealed') {
      label = `Revealed ${questions.get(event.id)?.prompt || 'a flashcard'}`;
    } else if (event.type === 'quiz-attempt') {
      label = `${attemptTitle(event, lessons)} · ${event.score} / ${event.total}`;
    }
    if (!label) return '';
    const date = new Date(event.timestamp);
    const validTimestamp = Number.isFinite(date.getTime());
    const dateLabel = validTimestamp ? date.toLocaleDateString() : 'Recently';
    return `<li><span>${escape(label)}</span><time${validTimestamp ? ` datetime="${escape(event.timestamp)}"` : ''}>${escape(dateLabel)}</time></li>`;
  }).filter(Boolean).join('');
  return `<h3 class="dashboard-activity-heading">Recent activity</h3>${rows ? `<ol class="dashboard-activity-list" data-dashboard-activity>${rows}</ol>` : '<p class="dashboard-empty">Your recent study activity will appear here.</p>'}`;
}

export function dashboardView(topics, lessons, state, attempts = [], attemptsError = '', dashboardData = {}) {
  const completed = Array.isArray(state.completedLessons) ? state.completedLessons : [];
  const activity = dashboardData.activity || { goal: 'lesson', today: {}, recentEvents: [] };
  const questions = questionIndex(dashboardData.questions);
  const next = getNextLesson(lessons, completed);
  const logicTopic = topics.find((topic) => topic.id === 'logic') || { lessonIds: [] };
  const logicProgress = getTopicProgress(logicTopic, completed);
  const logicLessons = lessons.filter((lesson) => logicTopic.lessonIds.includes(lesson.id));
  const pathwayRows = logicLessons.map((lesson, index) => lessonLink(lesson, state, index)).join('');
  const xpInLevel = state.xp % 150;
  const xpToLevel = xpInLevel ? 150 - xpInLevel : 150;
  const nextStep = next
    ? `<article class="continue-card clay"><div class="lesson-index">${String(lessons.indexOf(next) + 1).padStart(2, '0')}</div><div><span class="tag">${completed.length ? 'Keep your momentum' : 'Your first lesson is ready'}</span><h2>${escape(next.title)}</h2><p>Read a worked example, try a short self-check, and mark the lesson complete when you’re ready.</p><a class="button button-primary" href="${lessonUrl(next.id)}">Continue learning</a></div></article>`
    : `<article class="learning-complete clay"><span class="tag">Logic pathway</span><h2>All Logic lessons complete</h2><p>Nice work. Revisit a lesson or check your understanding with a quiz.</p><a class="button button-primary" href="${pageUrl('quizzes')}">Explore Logic quizzes</a></article>`;
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
  const review = dashboardReview(activity, lessons, questions);
  const notices = dashboardNotices(dashboardData.notices);
  const activityList = recentActivity(activity, lessons, questions);

  return `<section class="learning-hero dashboard-welcome clay"><p class="tag">Your study space</p><h1>Welcome back, ${escape(state.nickname || 'Fisher learner')}.</h1><p>Take one small step through discrete mathematics at your own pace. Your progress stays on this device unless you sign in to sync it.</p><div class="learning-actions"><a class="button button-primary" href="${next ? lessonUrl(next.id) : pageUrl('quizzes')}">${next ? 'Continue learning' : 'Choose a quiz'}</a><a class="button button-secondary" href="${pageUrl('courses')}">Explore courses</a></div></section>
  <section class="learning-section dashboard-next-step" aria-labelledby="dashboard-next-heading"><div class="section-heading"><div><h2 id="dashboard-next-heading">Your next step</h2><p>A clear place to pick up or begin.</p></div></div>${nextStep}</section>
  <section class="dashboard-overview" aria-label="Your learning at a glance">
    <article class="stat-card clay"><div class="ring" style="--p:${xpInLevel / 1.5}"><div><strong class="num">${state.xp}</strong><small>XP</small></div></div><div><h2>Level ${state.level}</h2><p>${xpToLevel} XP until your next level</p></div></article>
    <article class="streak clay"><p class="tag">Study streak</p><p class="streak-value num">${state.streak} day${state.streak === 1 ? '' : 's'}</p><p>Build a steady habit one lesson at a time.</p></article>
    <article class="streak clay">${progressBar('Logic course', logicProgress)}<a class="button button-secondary" href="${pageUrl('progress')}">View all progress</a></article>
  </section>
  <section class="dashboard-primary-grid" aria-label="Logic pathway and study tools">
    <article class="clay learning-panel dashboard-pathway"><div class="section-heading"><div><h2>Logic pathway</h2><p>Your published learning path.</p></div><a href="${pageUrl('courses')}">View course</a></div>${progressBar('Lessons completed', logicProgress)}<nav class="dashboard-pathway-links" aria-label="Logic lesson pathway">${pathwayRows}</nav></article>
    <article class="clay learning-panel dashboard-study-tools"><div class="section-heading"><div><h2>Study tools</h2><p>Choose the kind of practice you need.</p></div></div><div class="learning-tool-links"><a href="${pageUrl('flashcards')}">Review flashcards</a><a href="${pageUrl('practice')}">Practice with feedback</a><a href="${pageUrl('quizzes')}">Try a quiz</a><a href="${pageUrl('assessments')}">Take a Logic checkpoint</a><a href="${pageUrl('profile')}">View your profile</a></div></article>
  </section>
  <section class="learning-section dashboard-supporting dashboard-lower" aria-label="Daily study details">
    ${dashboardGoalCard(activity)}
    ${review}
    ${notices}
    <article class="clay learning-panel"><div class="section-heading"><div><h2>Recent quiz practice</h2><p>Practice scores do not change XP or course completion.</p></div><a href="${pageUrl('quizzes')}">Open quizzes</a></div>${recentAttempts}</article>
    <article class="clay learning-panel">${activityList}</article>
  </section>
  <section class="learning-section dashboard-course-map" aria-labelledby="dashboard-course-map-heading">
    <div class="section-heading"><div><h2 id="dashboard-course-map-heading">Explore all topics</h2><p>Your full course map, including topics still in preparation.</p></div><a href="${pageUrl('courses')}">Open courses</a></div>
    <div class="topic-progress">${topicCards}</div>
  </section>`;
}

export function coursesView(topics, lessons, state) {
  const completed = Array.isArray(state.completedLessons) ? state.completedLessons : [];
  const courseEntries = topics.map((topic) => ({
    topic,
    topicLessons: lessons.filter((lesson) => topic.lessonIds.includes(lesson.id))
  }));
  const availableCourses = courseEntries.filter(({ topicLessons }) => topicLessons.length);
  const upcomingCourses = courseEntries.filter(({ topicLessons }) => !topicLessons.length);
  const availableCards = availableCourses.map(({ topic, topicLessons }) => {
    const courseProgress = getTopicProgress(topic, completed);
    const lessonRows = topicLessons.map((lesson, index) => lessonLink(lesson, state, index)).join('');
    const resource = youtubeSearchUrl('discrete mathematics logic propositions connectives truth tables quantifiers');
    const startLesson = getNextLesson(topicLessons, completed)?.id || topicLessons[0].id;
    return `<article class="course-card course-card-available clay"><div class="course-card-heading"><span class="tag">${escape(topic.scopeLabel)}</span><span class="course-status">Available now · ${topicLessons.length} lessons</span></div><h2>${escape(topic.title)}</h2><p>${escape(topic.summary)} Follow the sequence, revisit any lesson, and use the worked examples to check each idea.</p>${progressBar('Course progress', courseProgress)}<div class="course-lesson-list" aria-label="${escape(topic.title)} lessons">${lessonRows}</div><div class="course-card-actions"><a class="button button-primary" href="${lessonUrl(startLesson)}">${courseProgress.completed === courseProgress.total ? 'Review lessons' : 'Start or continue'}</a><a class="text-link" href="${resource}" target="_blank" rel="noopener noreferrer">Watch Logic lessons on YouTube <span aria-hidden="true">↗</span></a></div></article>`;
  }).join('');
  const upcomingCards = upcomingCourses.map(({ topic }) => (
    `<article class="course-card course-card-unavailable clay"><span class="tag">${escape(topic.scopeLabel)}</span><h3>${escape(topic.title)}</h3><p>${escape(topic.summary)}</p><p>Lesson content is being prepared. This course is not available to study yet.</p><span class="course-status">Coming soon · no lessons published</span></article>`
  )).join('');

  return `<div class="courses-page">
    <section class="learning-page-intro courses-page-intro"><p class="tag">Course catalogue</p><h1>Learn one idea at a time.</h1><p>See what is ready now and what is still in preparation.</p></section>
    <div class="courses-catalogue-summary" aria-label="Course availability"><p><strong data-course-count="available">${availableCourses.length}</strong> available now</p><p><strong data-course-count="upcoming">${upcomingCourses.length}</strong> being prepared</p></div>
    <section class="courses-available" aria-labelledby="courses-available-heading"><div class="section-heading"><div><h2 id="courses-available-heading">Available courses</h2><p>Start or continue a published learning path.</p></div></div><div class="course-grid course-grid-rich">${availableCards || '<p class="course-catalogue-empty">No courses are available to study yet.</p>'}</div></section>
    <section class="courses-upcoming" aria-labelledby="courses-upcoming-heading"><div class="section-heading"><div><h2 id="courses-upcoming-heading">More topics</h2><p>These topics will appear when lesson content is ready.</p></div></div><div class="course-grid course-grid-rich">${upcomingCards || '<p class="course-catalogue-empty">All available topics are ready to study.</p>'}</div></section>
    <aside class="learning-note inset"><h2>How course progress works</h2><p>Only completed lessons in published courses count. Quiz and practice scores are for learning and do not award XP.</p></aside>
  </div>`;
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
      ? `<aside class="try-card inset" aria-labelledby="${sectionId}-practice"><span class="tag">Pause and think</span><h3 id="${sectionId}-practice">Try it yourself</h3><p>${escape(section.body)}</p><button class="button button-secondary" type="button" data-reveal="${sectionId}" aria-controls="answer-${sectionId}">Reveal explanation</button><div id="answer-${sectionId}" class="answer" hidden><p><strong>Explanation:</strong> ${escape(section.tryAnswer)}</p></div></aside>`
      : '';
    const diagram = section.diagram
      ? `<figure class="diagram inset">${themeDiagram(section.diagram)}</figure>`
      : '';
    const widget = section.widget === 'truth-table' ? truthWidgetMarkup() : '';
    return `<section class="lesson-section" id="${sectionId}"><h2>${escape(section.heading)}</h2><p>${escape(section.body)}</p>${widget}${diagram}${practice}</section>`;
  }).join('');
  const video = youtubeSearchUrl(`${lesson.title} discrete mathematics lecture`);
  const lessonProgress = getTopicProgress({ lessonIds: safeLessons.map((item) => item.id) }, state.completedLessons);
  const lessonNav = safeLessons.map((item, lessonIndex) => lessonLink(item, state, lessonIndex, item.id === lesson.id)).join('');
  const previous = safeLessons[index - 1];
  const next = safeLessons[index + 1];

  return `<div class="lesson-reader-layout"><article class="lesson-content lesson-content-rich lesson-reader-content clay"><div class="lesson-heading"><p class="lesson-meta">Logic · ${escape(lesson.xp)} XP · Lesson ${index + 1} of ${safeLessons.length}</p><h1>${escape(lesson.title)}</h1><p>Take your time. Work through each idea, then pause at the self-check to explain it in your own words.</p>${progressBar('Logic lesson progress', lessonProgress)}</div><nav class="lesson-pathway inset" aria-label="Logic lesson list"><strong>Logic pathway</strong><div>${lessonNav}</div></nav><nav class="lesson-outline inset" aria-label="On this page"><strong>In this lesson</strong><div>${lesson.sections.map((section, sectionIndex) => `<a href="#lesson-section-${sectionIndex + 1}">${escape(section.heading)}</a>`).join('')}</div></nav>${sections}<aside class="lesson-resources inset"><h2>Want another explanation?</h2><p>Explore optional videos from other educators. These open YouTube search results in a new tab; choose the explanation that works for you.</p><a class="button button-secondary" href="${video}" target="_blank" rel="noopener noreferrer">Search YouTube for this lesson <span aria-hidden="true">↗</span></a></aside><div class="lesson-actions">${previous ? `<a class="button button-secondary" href="${lessonUrl(previous.id)}">← Previous lesson</a>` : `<a class="button button-secondary" href="${pageUrl('courses')}">← Courses</a>`}<button class="button ${completed ? 'button-secondary' : 'button-primary'}" data-complete="${lesson.id}" ${completed ? 'disabled' : ''}>${completed ? 'Lesson completed' : `Mark lesson complete · +${lesson.xp} XP`}</button>${next ? `<a class="button button-secondary" href="${lessonUrl(next.id)}">Next lesson →</a>` : `<a class="button button-secondary" href="${pageUrl('quizzes')}">Practice with a quiz →</a>`}</div><a class="button button-primary lesson-practice-link" href="${pageUrl('practice')}">Try practice</a></article></div>`;
}
