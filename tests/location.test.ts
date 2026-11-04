import { describe, expect, it } from 'vitest';
import { classify } from '../src/data/location';

describe('location error classification', () => {
  it('recognises the common Android plugin errors', () => {
    expect(classify(new Error('Location services are not enabled'))).toBe('off');
    expect(classify(new Error('Location permission was denied'))).toBe('denied');
    expect(classify(new Error('Google Play Services not available'))).toBe('fallback');
    expect(classify(new Error('Timeout expired'))).toBe('searching');
    expect(classify('location unavailable')).toBe('searching');
  });
});
