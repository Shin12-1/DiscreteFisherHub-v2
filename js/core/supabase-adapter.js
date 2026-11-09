export class SupabaseAdapter {
  constructor(client, user, localAdapter) { this.client = client; this.user = user; this.localAdapter = localAdapter; this.kind = 'supabase'; }

  async get(key, fallback = null) {
    if (key !== 'learner-state') return fallback;
    const [{ data: profile, error: profileError }, { data: progress, error: progressError }] = await Promise.all([
      this.client.from('profiles').select('nickname, xp, level, streak, last_active').eq('id', this.user.id).single(),
      this.client.from('lesson_progress').select('lesson_id').eq('user_id', this.user.id)
    ]);
    if (profileError || progressError) throw profileError || progressError;
    const local = await this.localAdapter.get(key, fallback);
    return { ...local, nickname:profile.nickname, xp:profile.xp, level:profile.level, streak:profile.streak, lastActiveDate:profile.last_active, completedLessons:progress.map((item) => item.lesson_id) };
  }

  async set(key, value) {
    if (key !== 'learner-state') return value;
    const current = await this.get(key, value);
    await this.localAdapter.set(key, { ...current, theme:value.theme || current.theme });
    if (value.nickname && value.nickname !== current.nickname) {
      const { error } = await this.client.from('profiles').update({ nickname:value.nickname }).eq('id', this.user.id);
      if (error) throw error;
    }
    const missing = [...new Set(value.completedLessons || [])].filter((id) => !current.completedLessons.includes(id));
    if (missing.length) {
      const { error } = await this.client.from('lesson_progress').upsert(missing.map((lesson_id) => ({ user_id:this.user.id, lesson_id })), { onConflict:'user_id,lesson_id', ignoreDuplicates:true });
      if (error) throw error;
    }
    return this.get(key, value);
  }

  async remove() { return undefined; }
  async list() { return ['learner-state']; }
}
