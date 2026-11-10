const PAGE_LABELS = {
  dashboard: 'Dashboard',
  courses: 'Courses',
  lessons: 'Lessons',
  quizzes: 'Quizzes',
  flashcards: 'Flashcards',
  login: 'sign-in form',
  profile: 'Profile',
  progress: 'Progress',
  practice: 'Practice',
  assessments: 'Assessments'
};

const skeletonShapes = {
  dashboard: '<div class="skeleton-grid"><div class="skeleton-block skeleton-hero"></div><div class="skeleton-block skeleton-side"></div></div><div class="skeleton-grid skeleton-grid-cards"><div class="skeleton-block skeleton-card"></div><div class="skeleton-block skeleton-card"></div><div class="skeleton-block skeleton-card"></div></div>',
  courses: '<div class="skeleton-block skeleton-hero"></div><div class="skeleton-grid skeleton-grid-cards"><div class="skeleton-block skeleton-card"></div><div class="skeleton-block skeleton-card"></div><div class="skeleton-block skeleton-card"></div></div>',
  lessons: '<div class="skeleton-grid skeleton-grid-lesson"><div class="skeleton-block skeleton-reading"></div><div class="skeleton-block skeleton-rail"></div></div>',
  quizzes: '<div class="skeleton-block skeleton-hero"></div><div class="skeleton-grid skeleton-grid-cards"><div class="skeleton-block skeleton-card"></div><div class="skeleton-block skeleton-card"></div></div>',
  profile: '<div class="skeleton-grid skeleton-grid-profile"><div class="skeleton-block skeleton-profile-card"></div><div class="skeleton-block skeleton-profile-form"></div></div>',
  progress: '<div class="skeleton-grid skeleton-grid-cards"><div class="skeleton-block skeleton-stat"></div><div class="skeleton-block skeleton-stat"></div><div class="skeleton-block skeleton-stat"></div></div><div class="skeleton-block skeleton-reading"></div>',
  practice: '<div class="skeleton-block skeleton-hero"></div><div class="skeleton-grid skeleton-grid-cards"><div class="skeleton-block skeleton-card"></div><div class="skeleton-block skeleton-card"></div></div>',
  assessments: '<div class="skeleton-block skeleton-hero"></div><div class="skeleton-block skeleton-reading"></div>',
  flashcards: '<div class="skeleton-block skeleton-hero"></div><div class="skeleton-block skeleton-card"></div>',
  login: '<div class="skeleton-block skeleton-auth-brand"></div><div class="skeleton-block skeleton-auth-title"></div><div class="skeleton-block skeleton-auth-copy"></div><div class="skeleton-auth-field"><div class="skeleton-block skeleton-auth-label"></div><div class="skeleton-block skeleton-auth"></div></div><div class="skeleton-auth-field"><div class="skeleton-block skeleton-auth-label"></div><div class="skeleton-block skeleton-auth"></div></div><div class="skeleton-block skeleton-auth-button"></div>'
};

export function renderPageSkeleton(page) {
  const label = PAGE_LABELS[page] || 'content';
  return `<section class="page-skeleton" role="status" aria-label="Loading ${label}" aria-busy="true">${skeletonShapes[page] || '<div class="skeleton-block skeleton-hero"></div><div class="skeleton-block skeleton-reading"></div>'}<span class="screen-reader">Loading ${label}…</span></section>`;
}
