import type { CoatKey, EyeKey, HabitatKey, RatingKey } from './types';

// There is deliberately no "home" habitat: Cat Snap is for cats met out in the world.
export const HABITATS: Record<HabitatKey, { label: string; color: string; weight: number; bg: string }> = {
  street:     { label: 'Street & Alley',  color: '#8b7a64', weight: 0, bg: '#e8e2d6' },
  shop:       { label: 'Shop & Market',   color: '#c2702a', weight: 0, bg: '#f3e1c7' },
  harbour:    { label: 'Harbour & Coast', color: '#2f78a8', weight: 1, bg: '#d6e6ef' },
  attraction: { label: 'Attraction',      color: '#8a58b0', weight: 1, bg: '#e9dcef' },
  wild:       { label: 'Wild & Trail',    color: '#3e8a55', weight: 2, bg: '#d9ead3' },
};

export const COATS: Record<CoatKey, { label: string; fur: string; accent: string; pattern: 'tabby' | 'solid' | 'tuxedo' | 'calico' | 'bicolor' | 'pointed' }> = {
  orange:  { label: 'Orange tabby',  fur: '#e8913a', accent: '#b8601a', pattern: 'tabby' },
  grey:    { label: 'Grey tabby',    fur: '#9aa0a6', accent: '#5f6368', pattern: 'tabby' },
  brown:   { label: 'Brown tabby',   fur: '#a07850', accent: '#5a3e24', pattern: 'tabby' },
  black:   { label: 'Black',         fur: '#2b2b2e', accent: '#2b2b2e', pattern: 'solid' },
  white:   { label: 'White',         fur: '#f6f4ef', accent: '#f6f4ef', pattern: 'solid' },
  tuxedo:  { label: 'Tuxedo',        fur: '#26262a', accent: '#ffffff', pattern: 'tuxedo' },
  calico:  { label: 'Calico',        fur: '#f6f1e7', accent: '#2d2a28', pattern: 'calico' },
  tortie:  { label: 'Tortoiseshell', fur: '#3a2a20', accent: '#c4672a', pattern: 'calico' },
  bicolor: { label: 'Black & white', fur: '#ffffff', accent: '#2b2b2e', pattern: 'bicolor' },
  cream:   { label: 'Cream',         fur: '#ead8b5', accent: '#c9ae80', pattern: 'tabby' },
  siamese: { label: 'Pointed',       fur: '#efe4d2', accent: '#5b4436', pattern: 'pointed' },
};

export const EYES: Record<EyeKey, { label: string; color: string; color2?: string }> = {
  amber:  { label: 'Amber',    color: '#e0a526' },
  green:  { label: 'Green',    color: '#7cb342' },
  blue:   { label: 'Blue',     color: '#4f9fe0' },
  copper: { label: 'Copper',   color: '#c26a2c' },
  odd:    { label: 'Odd-eyed', color: '#4f9fe0', color2: '#e0a526' },
};

export const RATING_KEYS: { key: RatingKey; label: string }[] = [
  { key: 'charm', label: 'Charm' },
  { key: 'fluff', label: 'Fluff' },
  { key: 'pose', label: 'Pose' },
  { key: 'friendly', label: 'Friendliness' },
];

export const TAGS = ['Chonky', 'Sleepy', 'Curious', 'Shy', 'Chatty', 'Regal', 'Feral-ish',
  'Ear-tipped', 'Missing tooth', 'Battle scars', 'Sunbather', 'Guardian', 'Mischief'];
