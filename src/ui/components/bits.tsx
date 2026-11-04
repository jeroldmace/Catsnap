import { HABITATS } from '../../core/catalog';
import type { HabitatKey } from '../../core/types';
import type { Rarity } from '../../core/rules';
import { Paw } from './Icon';

export const HabitatTag = ({ h }: { h: HabitatKey }) => (
  <span className="habitat-tag"><i className="dot" style={{ background: HABITATS[h].color }} />{HABITATS[h].label}</span>
);

export const RarityBadge = ({ r, inline, points }: { r: Rarity; inline?: boolean; points?: boolean }) => (
  <span className={`rarity r${r.tier} ${inline ? 'inline' : ''}`}>{r.name}{points ? ` · ${r.points} pts` : ''}</span>
);

export const ScoreChip = ({ score }: { score: number }) => (
  <span className="score-chip"><Paw />{score.toFixed(1)}</span>
);

export const Meter = ({ n }: { n: number }) => (
  <span className="meter">{[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= n ? 'on' : ''} />)}</span>
);
