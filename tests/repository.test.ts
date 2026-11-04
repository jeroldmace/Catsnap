import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createIdbRepository } from '../src/data/idbRepository';
import { demoSnaps } from '../src/core/demo';
import { DEFAULT_SETTINGS } from '../src/core/types';

describe('IndexedDB repository', () => {
  it('saves, loads and deletes snaps, photos, interactions and settings', async () => {
    const repo = createIdbRepository('test-' + Math.random());
    const snap = { ...demoSnaps({ lat: 0, lng: 0 }, 'you', '/')[1], id: 'a', source: 'mine' as const, photoId: 'p1' };
    await repo.putSnap(snap);
    await repo.putPhoto('p1', new Blob(['jpeg-bytes'], { type: 'image/jpeg' }));
    await repo.putInteraction({ snapId: 'a', liked: true, comments: [], sightings: [] });
    await repo.putSettings({ ...DEFAULT_SETTINGS, username: 'mira' });

    let all = await repo.loadAll();
    expect(all.snaps.map((s) => s.id)).toEqual(['a']);
    expect(all.interactions.a.liked).toBe(true);
    expect(all.settings?.username).toBe('mira');
    expect(await repo.getPhoto('p1')).toBeTruthy();

    await repo.deleteSnap('a');
    all = await repo.loadAll();
    expect(all.snaps).toEqual([]);
    expect(all.interactions.a).toBeUndefined();

    await repo.clearAll();
    expect((await repo.loadAll()).settings).toBeNull();
  });
});
