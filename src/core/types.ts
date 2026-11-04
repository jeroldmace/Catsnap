// Core domain types. Pure data: no browser APIs, so this folder can be shared
// with a future native (React Native / Expo) app or a server.

export type HabitatKey = 'street' | 'shop' | 'harbour' | 'attraction' | 'wild';
export type CoatKey =
  | 'orange' | 'grey' | 'brown' | 'black' | 'white' | 'tuxedo'
  | 'calico' | 'tortie' | 'bicolor' | 'cream' | 'siamese';
export type EyeKey = 'amber' | 'green' | 'blue' | 'copper' | 'odd';
export type RatingKey = 'charm' | 'fluff' | 'pose' | 'friendly';
export type Ratings = Record<RatingKey, number>;

export interface GeoPoint { lat: number; lng: number }

/** One time someone saw a cat. The first sighting is the original snap. */
export interface Sighting extends GeoPoint {
  at: number; // epoch ms
  by: string;
}

export interface Comment { id: string; by: string; text: string; at: number }

/** A cat entry. `location` is always the blurred (~100 m) point, never the exact one. */
export interface Snap {
  id: string;
  source: 'mine' | 'demo';
  name: string;
  coat: CoatKey;
  eyes: EyeKey;
  habitat: HabitatKey;
  spot: string;
  notes: string;
  tags: string[];
  ratings: Ratings;
  author: string;
  createdAt: number;
  updatedAt: number;
  location: GeoPoint;
  /** Key of a stored photo blob (own snaps). */
  photoId?: string | null;
  /** Static photo URL (demo content). */
  photoUrl?: string | null;
  /** Community numbers baked into demo content. Zero for own snaps. */
  crowd: { likes: number; sightings: number; comments: Comment[] };
  featured?: boolean;
}

/** What this user did to a snap: likes, comments, extra sightings. */
export interface Interaction {
  snapId: string;
  liked: boolean;
  comments: Comment[];
  sightings: Sighting[];
}

export interface Settings {
  username: string;
  showDemo: boolean;
  plus: boolean; // mock subscription flag for field testing
  plan: 'year' | 'month';
  onboarded: boolean;
  radarView: 'map' | 'scope';
}

export const DEFAULT_SETTINGS: Settings = {
  username: 'you',
  showDemo: true,
  plus: false,
  plan: 'year',
  onboarded: false,
  radarView: 'map',
};
