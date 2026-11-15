const MAX_DURATION_SECONDS = 14_400;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let localRecordQueue = Promise.resolve();

function createId() {
  if (!globalThis.crypto?.randomUUID) throw new Error('Secure event IDs are not available in this browser.');
  return globalThis.crypto.randomUUID();
}

function validateId(id) {
  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) throw new TypeError('A valid event ID is required.');
}

function validateDuration(durationSeconds) {
  if (!Number.isInteger(durationSeconds) || durationSeconds <= 0 || durationSeconds > MAX_DURATION_SECONDS) {
    throw new RangeError('Duration must be a positive number of seconds no greater than four hours.');
  }
}

function localKey(prefix, userId) {
  return `${prefix}:${userId || 'guest'}`;
}

function saveLocalRecord(localAdapter, key, collection, record, dedupeKey) {
  const save = async () => {
    const saved = await localAdapter.get(key, { events: [], completions: [] });
    const records = Array.isArray(saved[collection]) ? saved[collection] : [];
    const duplicate = records.some((item) => item.id === record.id
      || (dedupeKey && item.dedupeKey === dedupeKey));
    if (duplicate) return { duplicate: true, record };
    await localAdapter.set(key, { ...saved, [collection]: [...records, record] });
    return { duplicate: false, record };
  };
  const pending = localRecordQueue.then(save, save);
  localRecordQueue = pending.then(() => undefined, () => undefined);
  return pending;
}

async function insertSignedIn(client, method, table, record) {
  let result;
  if (typeof client?.[method] === 'function') {
    result = await client[method](record);
  } else if (client?.from) {
    const { error } = await client.from(table).insert(record);
    if (error?.code === '23505') return { duplicate: true };
    if (error) throw error;
    result = { duplicate: false };
  } else {
    throw new TypeError('A signed-in activity adapter is required.');
  }
  return result || { duplicate: false };
}

export async function recordLearnerEvent({ localAdapter, client, userId, event }) {
  if (!event || typeof event.type !== 'string' || !/^[a-z][a-z0-9_-]{0,79}$/.test(event.type)) {
    throw new TypeError('A valid learner event type is required.');
  }
  const data = event.data === undefined ? {} : event.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new TypeError('Learner event data must be an object.');
  const record = {
    id: event.id || createId(),
    type: event.type,
    data,
    occurredAt: event.occurredAt || new Date().toISOString(),
    studySessionId: event.studySessionId || null,
    ...(event.dedupeKey ? { dedupeKey: event.dedupeKey } : {})
  };
  validateId(record.id);

  if (!userId) {
    return saveLocalRecord(localAdapter, localKey('learner-events', null), 'events', record, record.dedupeKey);
  }
  return insertSignedIn(client, 'recordLearnerEvent', 'learning_events', {
    id: record.id,
    type: record.type,
    data: record.data,
    studySessionId: record.studySessionId
  });
}

export async function recordActivityCompletion({ localAdapter, client, userId, completion }) {
  if (!completion || !['lesson', 'quiz', 'checkpoint'].includes(completion.type)) {
    throw new TypeError('A supported activity type is required.');
  }
  if (typeof completion.activityId !== 'string' || !completion.activityId.trim() || completion.activityId.length > 120) {
    throw new TypeError('A valid activity ID is required.');
  }
  validateDuration(completion.durationSeconds);
  const hasScore = completion.score !== undefined && completion.score !== null;
  const hasTotal = completion.total !== undefined && completion.total !== null;
  if (hasScore !== hasTotal || (hasScore && (!Number.isInteger(completion.score) || !Number.isInteger(completion.total)
    || completion.total <= 0 || completion.score < 0 || completion.score > completion.total))) {
    throw new RangeError('Score and total must be valid integers supplied together.');
  }
  const record = {
    id: completion.id || createId(),
    type: completion.type,
    activityId: completion.activityId.trim(),
    durationSeconds: completion.durationSeconds,
    completedAt: completion.completedAt || new Date().toISOString(),
    score: hasScore ? completion.score : null,
    total: hasTotal ? completion.total : null,
    studySessionId: completion.studySessionId || null
  };
  validateId(record.id);
  if (!Number.isFinite(Date.parse(record.completedAt))) throw new TypeError('Completion time must be a valid UTC timestamp.');

  if (!userId) {
    return saveLocalRecord(localAdapter, localKey('learner-events', null), 'completions', record);
  }
  return insertSignedIn(client, 'recordActivityCompletion', 'activity_completions', record);
}

export async function recordStudySession({ localAdapter, client, userId, session }) {
  if (!session) throw new TypeError('A study session is required.');
  const id = session.id || createId();
  validateId(id);
  if (!Number.isInteger(session.durationSeconds) || session.durationSeconds <= 0 || session.durationSeconds > MAX_DURATION_SECONDS) {
    throw new RangeError('Study duration must be a positive number of seconds no greater than four hours.');
  }
  const record = {
    id,
    startedAt: session.startedAt || new Date().toISOString(),
    endedAt: session.endedAt || new Date().toISOString(),
    durationSeconds: session.durationSeconds,
    pending: Boolean(userId)
  };
  const startTime = Date.parse(record.startedAt);
  const endTime = Date.parse(record.endedAt);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) {
    throw new RangeError('Study session timestamps must be valid and ordered.');
  }
  const key = localKey('study-sessions', userId);
  const sessions = await localAdapter.get(key, []);
  const list = Array.isArray(sessions) ? sessions : [];
  const index = list.findIndex((item) => item.id === id);
  if (index < 0) list.push(record);
  else list[index] = record;
  await localAdapter.set(key, list);

  if (!userId) return { duplicate: false, record };
  await sendStudySession(client, userId, record);
  record.pending = false;
  await localAdapter.set(key, list);
  return { duplicate: false, record };
}

async function sendStudySession(client, userId, record) {
  if (typeof client?.recordStudySession === 'function') {
    await client.recordStudySession(record);
    return;
  }
  if (!client?.from) throw new TypeError('A signed-in activity adapter is required.');
  const { error: insertError } = await client.from('study_sessions').insert({
    user_id: userId,
    client_session_id: record.id,
    started_at: record.startedAt
  });
  if (insertError && insertError.code !== '23505') throw insertError;
  const { error } = await client.from('study_sessions')
    .update({ duration_seconds: record.durationSeconds, ended_at: record.endedAt })
    .eq('user_id', userId)
    .eq('client_session_id', record.id);
  if (error) throw error;
}

export async function syncPendingStudySessions({ localAdapter, client, userId }) {
  if (!userId) return 0;
  const sessions = await localAdapter.get(localKey('study-sessions', userId), []);
  if (!Array.isArray(sessions)) return 0;
  let synced = 0;
  for (const session of sessions) {
    if (!session.pending) continue;
    await recordStudySession({ localAdapter, client, userId, session });
    synced += 1;
  }
  return synced;
}
