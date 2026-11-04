import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readPhotoMeta } from '../src/data/photoMeta';

describe('photo metadata', () => {
  it('reads the GPS position from a photo', async () => {
    const meta = await readPhotoMeta(readFileSync('tests/fixtures/gps-cat.jpg'));
    expect(meta.location?.lat).toBeCloseTo(29.012345, 4);
    expect(meta.location?.lng).toBeCloseTo(110.512345, 4);
  });
  it('returns no location when the photo has none', async () => {
    const meta = await readPhotoMeta(readFileSync('tests/fixtures/no-gps.jpg'));
    expect(meta.location).toBeNull();
  });
});
