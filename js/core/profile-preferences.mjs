export const PROFILE_PREFERENCE_DEFAULTS = Object.freeze({
  program: '',
  yearLevel: '',
  weeklyGoal: 3,
  sessionLength: 25,
  preferredTime: 'flexible',
  lessonStyle: 'worked-examples',
  studyReminders: false,
  assessmentUpdates: false,
  reduceMotion: false
});

const programs = ['BS Computer Science', 'BS Information Technology'];
const yearLevels = ['1st year', '2nd year', '3rd year', '4th year'];
const weeklyGoals = [2, 3, 4, 5];
const sessionLengths = [15, 25, 40, 60];
const preferredTimes = ['morning', 'afternoon', 'evening', 'flexible'];
const lessonStyles = ['worked-examples', 'definitions-first', 'practice-first'];

const allowedValue = (value, options, fallback) =>
  options.includes(value) ? value : fallback;

const allowedNumber = (value, options, fallback) =>
  options.find((option) => value === option || value === String(option)) ?? fallback;

export function normalizeProfilePreferences(value) {
  const preferences = value && typeof value === 'object' && !Array.isArray(value) ? value : {};

  return {
    program: allowedValue(preferences.program, programs, PROFILE_PREFERENCE_DEFAULTS.program),
    yearLevel: allowedValue(preferences.yearLevel, yearLevels, PROFILE_PREFERENCE_DEFAULTS.yearLevel),
    weeklyGoal: allowedNumber(preferences.weeklyGoal, weeklyGoals, PROFILE_PREFERENCE_DEFAULTS.weeklyGoal),
    sessionLength: allowedNumber(preferences.sessionLength, sessionLengths, PROFILE_PREFERENCE_DEFAULTS.sessionLength),
    preferredTime: allowedValue(preferences.preferredTime, preferredTimes, PROFILE_PREFERENCE_DEFAULTS.preferredTime),
    lessonStyle: allowedValue(preferences.lessonStyle, lessonStyles, PROFILE_PREFERENCE_DEFAULTS.lessonStyle),
    studyReminders: typeof preferences.studyReminders === 'boolean'
      ? preferences.studyReminders
      : PROFILE_PREFERENCE_DEFAULTS.studyReminders,
    assessmentUpdates: typeof preferences.assessmentUpdates === 'boolean'
      ? preferences.assessmentUpdates
      : PROFILE_PREFERENCE_DEFAULTS.assessmentUpdates,
    reduceMotion: typeof preferences.reduceMotion === 'boolean'
      ? preferences.reduceMotion
      : PROFILE_PREFERENCE_DEFAULTS.reduceMotion
  };
}
