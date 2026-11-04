import { describe, expect, it } from 'vitest';
import { isCloudId, mapPulled, mergeInteraction, snapInsertRow, snapUpdateRow, type PulledSnapRow } from '../src/data/cloud';
import { exampleSnap, EXAMPLE_ID } from '../src/core/example';

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const SNAP = '33333333-3333-4333-8333-333333333333';

const row = (over: Partial<PulledSnapRow> = {}): PulledSnapRow => ({
  id: SNAP, owner_id: OTHER, name: 'Pier Cat', coat: 'grey', eyes: 'green', habitat: 'harbour', spot: 'Pier', notes: '', tags: ['Curious'],
  charm: 4, fluff: 3, pose: 5, friendly: 2, lat: 49.28, lng: -123.12, photo_path: `${OTHER}/p.jpg`, visibility: 'shared',
  created_at: '2026-11-04T10:00:00Z', updated_at: '2026-11-04T10:05:00Z',
  profiles: { username: 'mira' },
  likes: [{ user_id: ME }, { user_id: OTHER }],
  comments: [
    { id: 'c1', user_id: OTHER, body: 'hi', created_at: '2026-11-04T10:10:00Z', profiles: { username: 'mira' } },
    { id: 'c2', user_id: ME, body: 'cute', created_at: '2026-11-04T10:11:00Z', profiles: { username: 'me' } },
  ],
  sightings: [
    { id: 's1', user_id: OTHER, lat: 49.281, lng: -123.121, seen_at: '2026-11-04T12:00:00Z', delayed: false },
    { id: 's2', user_id: ME, lat: 49.282, lng: -123.122, seen_at: '2026-11-04T11:00:00Z', delayed: true },
  ],
  ...over,
});

describe('cloud mapping', () => {
  it('splits other people\'s activity from mine on a community snap', () => {
    const { community, mineRemote, myInteractions } = mapPulled([row()], ME);
    expect(mineRemote).toHaveLength(0);
    const s = community[0];
    expect(s.source).toBe('community');
    expect(s.author).toBe('mira');
    expect(s.crowd.likes).toBe(1);               // OTHER's like only
    expect(s.crowd.sightings).toBe(2);           // original snap + OTHER's sighting
    expect(s.crowd.comments.map((c) => c.id)).toEqual(['c1']);
    expect(s.crowd.lastSighting?.id).toBe('s1');
    expect(s.photoPath).toBe(`${OTHER}/p.jpg`);
    const ix = myInteractions[SNAP];
    expect(ix.liked).toBe(true);
    expect(ix.comments.map((c) => c.id)).toEqual(['c2']);
    expect(ix.sightings[0]).toMatchObject({ id: 's2', delayed: true, synced: true });
  });

  it('recognises my own snaps for restoring after a reinstall', () => {
    const { community, mineRemote } = mapPulled([row({ owner_id: ME, likes: [], comments: [], sightings: [] })], ME);
    expect(community).toHaveLength(0);
    expect(mineRemote[0]).toMatchObject({ source: 'mine', crowd: { likes: 0, sightings: 0 } });
    expect(mineRemote[0].syncedAt).toBe(mineRemote[0].updatedAt);
  });

  it('never sends owner or server-controlled columns, and keeps location fixed on update', () => {
    const s = { ...exampleSnap({ lat: 1, lng: 2 }, '/', 0), id: SNAP, source: 'mine' as const, visibility: 'delayed' as const };
    const ins = snapInsertRow(s);
    expect(ins).not.toHaveProperty('owner_id');
    expect(ins).not.toHaveProperty('shared_at');
    expect(ins).toMatchObject({ lat: 1, lng: 2, visibility: 'delayed' });
    const upd = snapUpdateRow(s);
    expect(upd).not.toHaveProperty('lat');
    expect(upd).not.toHaveProperty('lng');
    expect(upd).not.toHaveProperty('id');
    expect(upd).not.toHaveProperty('created_at');
  });

  it('keeps the example cat off the cloud', () => {
    expect(isCloudId(EXAMPLE_ID)).toBe(false);
    expect(isCloudId(SNAP)).toBe(true);
  });
});

describe('merging interactions', () => {
  it('keeps unsynced local changes and adds remote ones', () => {
    const local = { snapId: SNAP, liked: true, likeSynced: false, comments: [{ id: 'local', by: 'me', text: 'x', at: 1, synced: false }], sightings: [] };
    const remote = { snapId: SNAP, liked: false, likeSynced: false, comments: [{ id: 'c2', by: 'me', text: 'y', at: 2, synced: true }], sightings: [] };
    const m = mergeInteraction(local, remote);
    expect(m.liked).toBe(true);           // pending local like wins
    expect(m.comments.map((c) => c.id)).toEqual(['local', 'c2']);
    expect(m.comments[0].synced).toBe(false);
  });
});
