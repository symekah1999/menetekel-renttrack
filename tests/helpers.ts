/** A tiny in-memory localStorage so store.ts can run under Node. */
export function installBrowserStub() {
  const mem = new Map<string, string>();
  const ls = {
    get length() { return mem.size; },
    key: (i: number) => [...mem.keys()][i] ?? null,
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => { mem.set(k, String(v)); },
    removeItem: (k: string) => { mem.delete(k); },
    clear: () => mem.clear(),
  };
  (globalThis as unknown as Record<string, unknown>).window = {
    localStorage: ls,
    dispatchEvent: () => true,
  };
  (globalThis as unknown as Record<string, unknown>).localStorage = ls;
  return ls;
}
