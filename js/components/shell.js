import { icon } from './icons.js';
import { pageUrl } from '../core/router.js';
const items = [['dashboard','Dashboard'],['courses','Courses'],['lessons','Lessons'],['flashcards','Flashcards'],['practice','Practice'],['quizzes','Quizzes'],['assessments','Assessments'],['progress','Progress'],['profile','Profile']];
const primaryMobileItems = ['dashboard','courses','lessons','practice'];
const moreMobileItems = ['quizzes','assessments','flashcards','progress','profile'];

export function shell(page, content, theme) {
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
  return `<aside class="sidebar"><a class="brand" href="${pageUrl('dashboard')}"><img src="${base}assets/TFVC%20UNIVERSAL%20LOGO.png" alt="The Fisher Valley College logo"><span>DiscreteFisher<br><small>Hub · FVC</small></span></a><nav aria-label="Main navigation"><ul class="nav-list">${nav}</ul></nav><div class="side-note inset">Independent study support for BSCS &amp; BSIT students.<br><br><strong>Not an official FVC syllabus.</strong></div></aside><main id="main-content" class="main"><header class="topbar"><p class="screen-reader">DiscreteFisher Hub</p><p class="page-title">${page === 'dashboard' ? 'Dashboard' : items.find(([id]) => id === page)?.[1] || page}</p><div class="top-actions"><button class="button button-secondary icon-button" data-theme-toggle aria-label="Switch to ${theme === 'light' ? 'dark' : 'light'} theme">${icon(theme === 'light' ? 'moon':'sun')}</button></div></header>${content}</main><nav class="mobile-nav" aria-label="Quick navigation">${mobile}<button class="mobile-more-toggle ${moreCurrent ? 'mobile-more-current' : ''}" data-mobile-more-toggle type="button" aria-expanded="false" aria-controls="mobile-more-menu" aria-label="More navigation options" ${moreCurrent ? 'aria-current="page"' : ''}>${icon('more')}<span>More</span></button><div id="mobile-more-menu" class="mobile-more-menu" hidden>${moreItems}</div></nav>`;
}
