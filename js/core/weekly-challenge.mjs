const MANILA_TIME_ZONE = 'Asia/Manila';
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const MANILA_WEEKDAY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: MANILA_TIME_ZONE,
  calendar: 'gregory',
  numberingSystem: 'latn',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

function manilaDateParts(date) {
  const parts = Object.fromEntries(
    MANILA_WEEKDAY_FORMATTER.formatToParts(date)
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, Number(value)])
  );
  return { year: parts.year, month: parts.month, day: parts.day };
}

function mondayOfWeek(date) {
  const { year, month, day } = manilaDateParts(date);
  const localDay = new Date(Date.UTC(year, month - 1, day));
  const daysSinceMonday = (localDay.getUTCDay() + 6) % 7;
  localDay.setUTCDate(localDay.getUTCDate() - daysSinceMonday);
  return localDay;
}

function formatWeekStart(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}T00:00:00+08:00`;
}

function getIsoWeekKey(monday) {
  const thursday = new Date(monday);
  thursday.setUTCDate(thursday.getUTCDate() + 3);
  const weekYear = thursday.getUTCFullYear();
  const januaryFourth = new Date(Date.UTC(weekYear, 0, 4));
  const firstMonday = new Date(januaryFourth);
  firstMonday.setUTCDate(firstMonday.getUTCDate() - ((firstMonday.getUTCDay() + 6) % 7));
  const weekNumber = 1 + Math.round((monday.getTime() - firstMonday.getTime()) / WEEK_MS);
  return `${weekYear}-W${String(weekNumber).padStart(2, '0')}`;
}

export function getWeeklyChallenge({ now = new Date(), challengeCatalog } = {}) {
  if (!Array.isArray(challengeCatalog) || challengeCatalog.length === 0) {
    throw new TypeError('A non-empty weekly challenge catalog is required.');
  }

  const instant = now instanceof Date ? new Date(now.getTime()) : new Date(now);
  if (!Number.isFinite(instant.getTime())) throw new TypeError('A valid date is required.');

  const monday = mondayOfWeek(instant);
  const weeksSinceAnchor = Math.floor((monday.getTime() - Date.UTC(1970, 0, 5)) / WEEK_MS);
  const index = ((weeksSinceAnchor % challengeCatalog.length) + challengeCatalog.length) % challengeCatalog.length;
  const challenge = challengeCatalog[index];
  if (!challenge || typeof challenge.id !== 'string' || !challenge.id) {
    throw new TypeError('The selected weekly challenge is invalid.');
  }
  const nextMonday = new Date(monday);
  nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);

  return {
    ...challenge,
    periodKey: getIsoWeekKey(monday),
    startsAt: formatWeekStart(monday),
    endsAt: formatWeekStart(nextMonday)
  };
}
