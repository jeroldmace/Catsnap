import { memo, useMemo } from 'react';
import { catSVG } from '../../core/catArt';
import { HABITATS } from '../../core/catalog';
import type { CoatKey, EyeKey, HabitatKey } from '../../core/types';

interface Props { photoSrc?: string | null; name: string; coat: CoatKey; eyes: EyeKey; habitat: HabitatKey; lazy?: boolean }

/** A snap's photo, or a drawn sketch when there is no photo. */
export const CatArt = memo(function CatArt({ photoSrc, name, coat, eyes, habitat, lazy = true }: Props) {
  const svg = useMemo(() => (photoSrc ? '' : catSVG({ coat, eyes, bg: HABITATS[habitat].bg })), [photoSrc, coat, eyes, habitat]);
  if (photoSrc) return <img src={photoSrc} alt={`Photo of ${name}`} loading={lazy ? 'lazy' : 'eager'} decoding="async" />;
  return <span className="sketch-fill" role="img" aria-label={`Sketch of ${name}`} dangerouslySetInnerHTML={{ __html: svg }} />;
});
