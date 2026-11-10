const HISTORY_KEY = 'quiz-attempts';
const HISTORY_LIMIT = 20;
const COLUMNS = 'topic_id, mode, score, total, taken_at';

function assertAttempt(attempt) {
  if (!attempt || typeof attempt.topicId !== 'string' || attempt.topicId.length < 1 || attempt.topicId.length > 120) {
    throw new TypeError('Quiz topicId must be a non-empty string of at most 120 characters.');
  }
  if (typeof attempt.mode !== 'string' || attempt.mode.length < 1 || attempt.mode.length > 40) {
    throw new TypeError('Quiz mode must be a non-empty string of at most 40 characters.');
  }
  if (!Number.isInteger(attempt.score) || !Number.isInteger(attempt.total) || attempt.total < 1 || attempt.score < 0 || attempt.score > attempt.total) {
    throw new RangeError('Quiz score must be an integer between zero and the positive integer total.');
  }
}

function assertStoredAttempt(attempt) {
  assertAttempt({
    topicId: attempt?.topic_id,
    mode: attempt?.mode,
    score: attempt?.score,
    total: attempt?.total
  });
  if (typeof attempt.taken_at !== 'string' || !Number.isFinite(Date.parse(attempt.taken_at))) {
    throw new TypeError('Saved quiz attempt must have a valid taken_at timestamp.');
  }
  return attempt;
}

function latestFirst(attempts) {
  return attempts.map(assertStoredAttempt)
    .sort((left, right) => Date.parse(right.taken_at) - Date.parse(left.taken_at))
    .slice(0, HISTORY_LIMIT);
}

export async function listQuizAttempts({ localAdapter, client = null, userId = null }) {
  if (userId) {
    if (!client) {
      throw new Error('Cannot load signed-in quiz attempts without a Supabase client.');
    }
    const { data, error } = await client.from('quiz_attempts')
      .select(COLUMNS)
      .eq('user_id', userId)
      .order('taken_at', { ascending: false })
      .limit(HISTORY_LIMIT);
    if (error) {
      throw error;
    }
    if (data === null) {
      return [];
    }
    if (!Array.isArray(data)) {
      throw new TypeError('Supabase returned an invalid quiz history.');
    }
    return latestFirst(data);
  }

  if (!localAdapter) {
    throw new TypeError('A local storage adapter is required for guest quiz history.');
  }
  const attempts = await localAdapter.get(HISTORY_KEY, []);
  if (!Array.isArray(attempts)) {
    throw new TypeError('Saved guest quiz history is invalid.');
  }
  return latestFirst(attempts);
}

export async function saveQuizAttempt({ localAdapter, client = null, userId = null, attempt }) {
  assertAttempt(attempt);

  if (userId) {
    if (!client) {
      throw new Error('Cannot save signed-in quiz attempts without a Supabase client.');
    }
    const { data, error } = await client.from('quiz_attempts')
      .insert({
        user_id: userId,
        topic_id: attempt.topicId,
        mode: attempt.mode,
        score: attempt.score,
        total: attempt.total
      })
      .select(COLUMNS)
      .single();
    if (error) {
      throw error;
    }
    return assertStoredAttempt(data);
  }

  if (!localAdapter) {
    throw new TypeError('A local storage adapter is required for guest quiz history.');
  }
  const attempts = await localAdapter.get(HISTORY_KEY, []);
  if (!Array.isArray(attempts)) {
    throw new TypeError('Saved guest quiz history is invalid.');
  }
  const saved = {
    topic_id: attempt.topicId,
    mode: attempt.mode,
    score: attempt.score,
    total: attempt.total,
    taken_at: new Date().toISOString()
  };
  await localAdapter.set(HISTORY_KEY, latestFirst([saved, ...attempts]));
  return saved;
}
