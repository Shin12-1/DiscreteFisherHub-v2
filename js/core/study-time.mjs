export function createStudyTimer({ now = () => performance.now(), idleTimeoutMs = 60_000 } = {}) {
  if (typeof now !== 'function') throw new TypeError('A clock function is required.');
  if (!Number.isFinite(idleTimeoutMs) || idleTimeoutMs <= 0) throw new RangeError('Idle timeout must be positive.');

  let elapsedMs = 0;
  let activeSince = null;
  let lastActivity = null;
  let visible = true;

  function accrue(at) {
    if (activeSince === null) return;
    const cutoff = Math.min(at, lastActivity + idleTimeoutMs);
    elapsedMs += Math.max(0, cutoff - activeSince);
    activeSince = at < lastActivity + idleTimeoutMs ? at : null;
  }

  return {
    start() {
      const at = now();
      if (lastActivity === null) lastActivity = at;
      if (visible && activeSince === null && at < lastActivity + idleTimeoutMs) activeSince = at;
    },
    activity() {
      const at = now();
      accrue(at);
      lastActivity = at;
      if (visible && activeSince === null) activeSince = at;
    },
    setVisible(isVisible) {
      const at = now();
      const next = Boolean(isVisible);
      if (next === visible) return;
      accrue(at);
      visible = next;
      if (visible) {
        lastActivity = at;
        activeSince = at;
      } else {
        lastActivity = at;
        activeSince = null;
      }
    },
    stop() {
      accrue(now());
      activeSince = null;
      return Math.ceil(elapsedMs / 1000);
    }
  };
}
