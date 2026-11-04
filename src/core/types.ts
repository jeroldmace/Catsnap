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
  id?: string;
  at: number; // epoch ms
  by: string;
  /** Opt-in: others only see this sighting an hour after it was recorded. */
  delayed?: boolean;
  /** Uploaded to the cloud. */
  synced?: boolean;
}

export interface Comment { id: string; by: string; text: string; at: number; synced?: boolean }

/** Who can see a snap in the cloud. Default is shared in real time. */
export type Visibility = 'shared' | 'delayed' | 'private';

/** A cat entry. `location` is always the blurred (~100 m) point, never the exact one. */
export interface Snap {
  id: string;
  /** mine = yours; community = another spotter's (from the cloud); example = the built-in starter cat. */
  source: 'mine' | 'community' | 'example';
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
  /** Static photo URL (example content). */
  photoUrl?: string | null;
  /** Object path in cloud photo storage, once uploaded. */
  photoPath?: string | null;
  /** Other people's likes, sightings and comments (your own live in Interaction). */
  crowd: { likes: number; sightings: number; comments: Comment[]; lastSighting?: Sighting | null };
  featured?: boolean;
  visibility?: Visibility;
  /** updatedAt value that was last uploaded; differs from updatedAt when there are unsynced edits. */
  syncedAt?: number | null;
}

/** What this user did to a snap: likes, comments, extra sightings. */
export interface Interaction {
  snapId: string;
  liked: boolean;
  /** Like state last confirmed by the cloud. */
  likeSynced?: boolean;
  comments: Comment[];
  sightings: Sighting[];
}

export interface Settings {
  username: string;
  /** Show the built-in example cat (Not-Claude). */
  showExample: boolean;
  /** Default share level for new snaps. */
  defaultVisibility: Visibility;
  /** Opt-in: delay your repeat sightings by an hour for others. */
  delaySightings: boolean;
  plus: boolean; // mock subscription flag for field testing
  plan: 'year' | 'month';
  onboarded: boolean;
  radarView: 'map' | 'scope';
}

export const DEFAULT_SETTINGS: Settings = {
  username: 'you',
  showExample: true,
  defaultVisibility: 'shared',
  delaySightings: false,
  plus: false,
  plan: 'year',
  onboarded: false,
  radarView: 'map',
};
