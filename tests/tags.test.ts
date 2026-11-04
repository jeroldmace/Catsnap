import { describe, expect, it } from 'vitest';
import { addTag, MAX_TAGS, normalizeTag, tagPopularity } from '../src/core/tags';

describe('tags', () => {
  it('normalises what people type', () => {
    expect(normalizeTag('  #loves   boxes!! ')).toBe('Loves boxes');
    expect(normalizeTag('三毛猫')).toBe('三毛猫');
    expect(normalizeTag('<script>')).toBe('Script');
    expect(normalizeTag('   ')).toBe('');
    expect(normalizeTag('x'.repeat(40))).toHaveLength(24);
  });
  it('ranks by popularity, case-insensitively, with built-ins included', () => {
    const r = tagPopularity([{ tags: ['Chonky', 'loves boxes'] }, { tags: ['chonky', 'Loves boxes'] }, { tags: ['Loves boxes', 'loves boxes'] }], ['Sleepy', 'Chonky']);
    expect(r[0]).toEqual({ tag: 'Loves boxes', count: 3 });
    expect(r[1]).toEqual({ tag: 'Chonky', count: 2 });
    expect(r[2]).toEqual({ tag: 'Sleepy', count: 0 });
  });
  it('adds tags without duplicates and up to the limit', () => {
    expect(addTag(['Chonky'], 'chonky')).toEqual(['Chonky']);
    expect(addTag(['Chonky'], ' sleepy ')).toEqual(['Chonky', 'Sleepy']);
    const full = Array.from({ length: MAX_TAGS }, (_, i) => `T${i}`);
    expect(addTag(full, 'More')).toBe(full);
  });
});
