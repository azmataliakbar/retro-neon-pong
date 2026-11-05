/**
 * High-score persistence in localStorage. Every access is guarded, because storage can
 * be unavailable (private mode, disabled cookies) or hold corrupt data.
 */

export const STORAGE_KEY = 'retro-neon-pong:highscores';
export const SCHEMA_VERSION = 1;
export const MAX_ENTRIES = 10;
export const NAME_MAX = 12;

/** Keeps only well-formed entries, sorted high to low, with ties kept in insertion order. */
export function sanitizeEntries(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e) => e && typeof e.name === 'string' && Number.isFinite(e.score) && e.score >= 0)
    .map((e) => ({
      name: e.name.slice(0, NAME_MAX),
      score: Math.floor(e.score),
      difficulty: typeof e.difficulty === 'string' ? e.difficulty : 'normal',
      at: Number.isFinite(e.at) ? e.at : 0,
    }))
    .sort((a, b) => b.score - a.score || a.at - b.at)
    .slice(0, MAX_ENTRIES);
}

/** Returns localStorage, or null when the browser refuses access to it. */
export function safeLocalStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function createHighScores(storage = null) {
  function read() {
    if (!storage) return [];
    try {
      const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null');
      if (!parsed || parsed.v !== SCHEMA_VERSION) return [];
      return sanitizeEntries(parsed.entries);
    } catch {
      return [];
    }
  }

  return {
    list: read,

    /** Returns {rank, persisted}. rank is 0 when the score misses the top list. */
    add(entry, now = Date.now()) {
      const existing = read();
      const score = Math.floor(entry.score);
      // Ties rank below existing entries, which matches the sort order above.
      const rank = existing.filter((e) => e.score >= score).length + 1;
      if (rank > MAX_ENTRIES) return { rank: 0, persisted: false };

      const entries = sanitizeEntries([
        ...existing,
        { name: entry.name, score, difficulty: entry.difficulty, at: now },
      ]);

      let persisted = false;
      if (storage) {
        try {
          storage.setItem(STORAGE_KEY, JSON.stringify({ v: SCHEMA_VERSION, entries }));
          persisted = true;
        } catch {
          persisted = false;
        }
      }
      return { rank, persisted };
    },

    clear() {
      if (!storage) return;
      try {
        storage.removeItem(STORAGE_KEY);
      } catch {
        // Nothing to clear if storage refuses access.
      }
    },
  };
}
