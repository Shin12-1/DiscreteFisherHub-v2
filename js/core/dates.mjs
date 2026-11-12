// Calendar-day keys in the learner's own time zone (not UTC), so a streak day
// changes at local midnight. "2026-11-12" style keys sort and compare as strings.
const pad = (value) => String(value).padStart(2, '0');

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function previousDateKey(date = new Date()) {
  const earlier = new Date(date);
  earlier.setDate(earlier.getDate() - 1);
  return localDateKey(earlier);
}
