import { icon } from './icons.js';
import { pageUrl } from '../core/router.js';
const items = [['dashboard','Dashboard'],['courses','Courses'],['lessons','Lessons'],['flashcards','Flashcards'],['practice','Practice'],['quizzes','Quizzes'],['assessments','Assessments'],['progress','Progress'],['achievements','Achievements'],['profile','Profile']];
const primaryMobileItems = ['dashboard','courses','lessons','practice'];
const moreMobileItems = ['quizzes','assessments','flashcards','progress','achievements','profile'];

export function shell(page, content, theme, unreadCount = 0) {
  const nav = items.map(([id,label]) => `<li><a class="nav-link" href="${pageUrl(id)}" ${page === id ? 'aria-current="page"' : ''}>${icon(id)}<span>${label}</span></a></li>`).join('');
  const mobile = primaryMobileItems.map((id) => {
    const [, label] = items.find(([itemId]) => itemId === id);
    return `<a href="${pageUrl(id)}" ${page === id ? 'aria-current="page"' : ''}>${icon(id)}<span>${label}</span></a>`;
  }).join('');
  const moreCurrent = moreMobileItems.includes(page);
  const moreItems = moreMobileItems.map((id) => {
    const [, label] = items.find(([itemId]) => itemId === id);
    return `<a href="${pageUrl(id)}" ${page === id ? 'aria-current="page"' : ''}>${icon(id)}<span>${label}</span></a>`;
  }).join('');
  const base = location.pathname.includes('/pages/') ? '../' : '';
  const count = Number.isInteger(unreadCount) && unreadCount > 0 ? unreadCount : 0;
  return `<aside class="sidebar"><a class="brand" href="${pageUrl('dashboard')}"><img src="${base}assets/TFVC%20UNIVERSAL%20LOGO.png" alt="The Fisher Valley College logo"><span>DiscreteFisher<br><small>Hub · FVC</small></span></a><nav aria-label="Main navigation"><ul class="nav-list">${nav}</ul></nav><div class="side-note inset">Independent study support for BSCS &amp; BSIT students.<br><br><strong>Not an official FVC syllabus.</strong></div></aside><main id="main-content" class="main"><header class="topbar"><p class="screen-reader">DiscreteFisher Hub</p><p class="page-title">${page === 'dashboard' ? 'Dashboard' : items.find(([id]) => id === page)?.[1] || page}</p><div class="top-actions"><div class="notification-control"><button class="button button-secondary icon-button notification-toggle" data-notifications-toggle type="button" aria-haspopup="true" aria-expanded="false" aria-controls="notification-panel" aria-label="Notifications${count ? `, ${count} unread` : ''}">${icon('notifications')}<span class="notification-count" data-notification-count ${count ? '' : 'hidden'}>${count}</span></button><section class="notification-panel clay" id="notification-panel" aria-label="Notifications" hidden><div class="notification-panel-heading"><h2>Notifications</h2><button class="notification-close" data-notifications-close type="button" aria-label="Close notifications">×</button></div><div class="notification-list" data-notification-list aria-live="polite" aria-busy="true"><p>Loading notifications…</p></div></section></div><button class="button button-secondary icon-button" data-theme-toggle aria-label="Switch to ${theme === 'light' ? 'dark' : 'light'} theme">${icon(theme === 'light' ? 'moon':'sun')}</button></div></header>${content}</main><nav class="mobile-nav" aria-label="Quick navigation">${mobile}<button class="mobile-more-toggle ${moreCurrent ? 'mobile-more-current' : ''}" data-mobile-more-toggle type="button" aria-expanded="false" aria-controls="mobile-more-menu" aria-label="More navigation options" ${moreCurrent ? 'aria-current="page"' : ''}>${icon('more')}<span>More</span></button><div id="mobile-more-menu" class="mobile-more-menu" hidden>${moreItems}</div></nav>`;
}
