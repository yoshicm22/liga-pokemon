const m = new Map(); let n = 0;
export const mem = m;
export const getStore = () => ({
  async get(k, o) { const v = m.get(k); return v === undefined ? null : (o?.type === "json" ? JSON.parse(v.d) : v.d); },
  async getWithMetadata(k, o) { const v = m.get(k); return v ? { data: JSON.parse(v.d), etag: v.e } : null; },
  async set(k, d, o) { return this.setJSON(k, d, o, true); },
  async setJSON(k, d, o = {}, raw) { const c = m.get(k); if (o.onlyIfNew && c) return { modified: false }; if (o.onlyIfMatch && (!c || c.e !== o.onlyIfMatch)) return { modified: false }; m.set(k, { d: raw ? d : JSON.stringify(d), e: String(++n) }); return { modified: true }; },
  async delete(k) { m.delete(k); },
  async list({ prefix }) { return { blobs: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }; },
});
