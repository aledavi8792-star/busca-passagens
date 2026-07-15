import { prisma } from "@/lib/db";

// Caches raw search results per exact (origin, destination, dates, pax) combo
// so repeated/overlapping flexible-date searches don't re-hit the flight API
// within the TTL window. Backed by the SearchCache table; falls back to an
// in-process Map if the DB is unreachable so a search never hard-fails on
// cache infra alone.
const memoryFallback = new Map<string, { payload: unknown; expiresAt: number }>();

const DEFAULT_TTL_SECONDS = 6 * 60 * 60; // 6h — flight prices don't swing enough intra-day to justify shorter for a prototype

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const row = await prisma.searchCache.findUnique({ where: { key } });
    if (!row) return null;
    if (row.expiresAt.getTime() < Date.now()) {
      await prisma.searchCache.delete({ where: { key } }).catch(() => {});
      return null;
    }
    return JSON.parse(row.payload) as T;
  } catch {
    const entry = memoryFallback.get(key);
    if (!entry || entry.expiresAt < Date.now()) return null;
    return entry.payload as T;
  }
}

export async function setCached(key: string, payload: unknown, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  try {
    await prisma.searchCache.upsert({
      where: { key },
      create: { key, payload: JSON.stringify(payload), expiresAt },
      update: { payload: JSON.stringify(payload), expiresAt },
    });
  } catch {
    memoryFallback.set(key, { payload, expiresAt: expiresAt.getTime() });
  }
}

export function cacheKey(parts: Record<string, string | number | boolean | undefined>): string {
  const normalized = Object.entries(parts)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return normalized;
}
