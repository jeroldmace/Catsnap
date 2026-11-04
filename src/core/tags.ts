import { TAGS } from './catalog';

export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 24;

/** Tidy a user-typed tag: trim, collapse spaces, strip odd characters, capitalise. Returns '' if unusable. */
export function normalizeTag(raw: string): string {
  const t = raw
    .replace(/^#+/, '')
    .replace(/[^\p{L}\p{N} '&-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TAG_LENGTH)
    .trim();
  if (!t) return '';
  return t.charAt(0).toLocaleUpperCase() + t.slice(1);
}

export const tagKey = (t: string) => t.toLocaleLowerCase();

export interface TagCount { tag: string; count: number }

/**
 * Tags ranked by how many snaps use them (case-insensitive), most popular first.
 * Built-in suggestions are always included so a new user has something to pick.
 * The spelling shown is the one used most often.
 */
export function tagPopularity(snaps: { tags: string[] }[], builtIn: string[] = TAGS): TagCount[] {
  const counts = new Map<string, number>();
  const spellings = new Map<string, Map<string, number>>();
  for (const s of snaps) {
    const seen = new Set<string>();
    for (const raw of s.tags) {
      const t = normalizeTag(raw);
      const k = tagKey(t);
      if (!t || seen.has(k)) continue;
      seen.add(k);
      counts.set(k, (counts.get(k) ?? 0) + 1);
      const sp = spellings.get(k) ?? new Map<string, number>();
      sp.set(t, (sp.get(t) ?? 0) + 1);
      spellings.set(k, sp);
    }
  }
  for (const b of builtIn) {
    const k = tagKey(b);
    if (!counts.has(k)) counts.set(k, 0);
    if (!spellings.has(k)) spellings.set(k, new Map([[b, 0]]));
  }
  return [...counts.entries()]
    .map(([k, count]) => {
      const sp = [...spellings.get(k)!.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      return { tag: sp[0][0], count };
    })
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** Add a tag to a list unless it's there already (any case) or the list is full. */
export function addTag(list: string[], raw: string): string[] {
  const t = normalizeTag(raw);
  if (!t || list.length >= MAX_TAGS || list.some((x) => tagKey(x) === tagKey(t))) return list;
  return [...list, t];
}
