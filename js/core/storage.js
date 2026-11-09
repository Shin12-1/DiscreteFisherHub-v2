export class LocalStorageAdapter {
  constructor(prefix = 'dfh:') { this.prefix = prefix; this.kind = 'local'; }
  async get(key, fallback = null) { try { const raw = localStorage.getItem(this.prefix + key); return raw === null ? fallback : JSON.parse(raw); } catch { return fallback; } }
  async set(key, value) { localStorage.setItem(this.prefix + key, JSON.stringify(value)); return value; }
  async remove(key) { localStorage.removeItem(this.prefix + key); }
  async list() { return Object.keys(localStorage).filter((key) => key.startsWith(this.prefix)).map((key) => key.slice(this.prefix.length)); }
}
const localAdapter = new LocalStorageAdapter();
let activeAdapter = localAdapter;
export const storage = {
  get: (...args) => activeAdapter.get(...args), set: (...args) => activeAdapter.set(...args), remove: (...args) => activeAdapter.remove(...args), list: (...args) => activeAdapter.list(...args), get kind() { return activeAdapter.kind; }
};
export function useStorageAdapter(adapter) { activeAdapter = adapter; }
export function useLocalStorage() { activeAdapter = localAdapter; }
export function getLocalStorageAdapter() { return localAdapter; }
