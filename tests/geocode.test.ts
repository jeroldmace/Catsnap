import { describe, expect, it } from 'vitest';
import { parseCoordinates } from '../src/data/geocode';

describe('typed coordinates', () => {
  it('reads common formats', () => {
    expect(parseCoordinates('29.5603, 106.5776')).toEqual({ lat: 29.5603, lng: 106.5776 });
    expect(parseCoordinates('29.56 106.57')).toEqual({ lat: 29.56, lng: 106.57 });
    expect(parseCoordinates('41.0256N 28.9741E')).toEqual({ lat: 41.0256, lng: 28.9741 });
    expect(parseCoordinates('38.71 S, 9.13 W')).toEqual({ lat: -38.71, lng: -9.13 });
    expect(parseCoordinates('-33.86;151.21')).toEqual({ lat: -33.86, lng: 151.21 });
  });
  it('rejects non-coordinates and out-of-range values', () => {
    expect(parseCoordinates('Galata tower')).toBeNull();
    expect(parseCoordinates('95, 10')).toBeNull();
    expect(parseCoordinates('10, 190')).toBeNull();
    expect(parseCoordinates('')).toBeNull();
  });
});
