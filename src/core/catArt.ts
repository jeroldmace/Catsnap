import { COATS, EYES } from './catalog';
import type { CoatKey, EyeKey } from './types';

let svgId = 0;

/** Draws a cartoon cat as an SVG string from coat and eye colour (used when there's no photo). */
export function catSVG(opts: { coat: CoatKey; eyes: EyeKey; bg?: string }): string {
    const coat = COATS[opts.coat] || COATS.orange;
    const eye: { color: string; color2?: string } = EYES[opts.eyes] || EYES.amber;
    const bg = opts.bg || '#eee';
    const id = 'c' + (++svgId);
    const fur = coat.fur, acc = coat.accent;
    const line = fur === '#2b2b2e' || fur === '#26262a' || fur === '#3a2a20' ? '#111' : '#3b3b3b';

    let pattern = '';
    switch (coat.pattern) {
      case 'tabby':
        pattern = `
          <path d="M100 66 L100 90 M86 70 L90 92 M114 70 L110 92" stroke="${acc}" stroke-width="5" stroke-linecap="round" fill="none"/>
          <path d="M42 112 L62 116 M40 124 L60 124 M158 112 L138 116 M160 124 L140 124" stroke="${acc}" stroke-width="4" stroke-linecap="round"/>`;
        break;
      case 'tuxedo':
        pattern = `<ellipse cx="100" cy="142" rx="30" ry="26" fill="${acc}"/>
                   <path d="M100 80 L92 120 L108 120 Z" fill="${acc}"/>`;
        break;
      case 'calico':
        pattern = `<g clip-path="url(#${id})">
            <ellipse cx="60" cy="80" rx="40" ry="34" fill="${acc}"/>
            <ellipse cx="150" cy="100" rx="30" ry="40" fill="#d9822b"/>
            <ellipse cx="135" cy="160" rx="24" ry="14" fill="${acc}"/>
          </g>`;
        break;
      case 'bicolor':
        pattern = `<g clip-path="url(#${id})">
            <rect x="30" y="50" width="140" height="62" fill="${acc}"/>
            <path d="M100 70 L84 112 L116 112 Z" fill="${fur}"/>
          </g>`;
        break;
      case 'pointed':
        pattern = `<ellipse cx="100" cy="132" rx="34" ry="30" fill="${acc}" opacity=".85"/>`;
        break;
    }

    const earInner = coat.pattern === 'pointed' ? acc : '#f2a7b5';
    const earFill = coat.pattern === 'pointed' ? acc : (coat.pattern === 'bicolor' ? acc : fur);
    const leftEye = eye.color, rightEye = eye.color2 || eye.color;

    return `<svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Cat sketch">
      <defs><clipPath id="${id}"><ellipse cx="100" cy="118" rx="64" ry="56"/></clipPath></defs>
      <rect width="200" height="200" fill="${bg}"/>
      <circle cx="160" cy="40" r="22" fill="#fff" opacity=".35"/>
      <path d="M40 98 L52 30 L92 66 Z" fill="${earFill}" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M160 98 L148 30 L108 66 Z" fill="${earFill}" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M54 82 L58 46 L80 66 Z" fill="${earInner}"/>
      <path d="M146 82 L142 46 L120 66 Z" fill="${earInner}"/>
      <ellipse cx="100" cy="118" rx="64" ry="56" fill="${fur}" stroke="${line}" stroke-width="3"/>
      ${pattern}
      <ellipse cx="76" cy="110" rx="11" ry="13" fill="${leftEye}" stroke="${line}" stroke-width="2"/>
      <ellipse cx="124" cy="110" rx="11" ry="13" fill="${rightEye}" stroke="${line}" stroke-width="2"/>
      <ellipse cx="76" cy="111" rx="3.2" ry="9" fill="#111"/>
      <ellipse cx="124" cy="111" rx="3.2" ry="9" fill="#111"/>
      <circle cx="79" cy="105" r="2.4" fill="#fff"/><circle cx="127" cy="105" r="2.4" fill="#fff"/>
      <path d="M93 130 L107 130 L100 138 Z" fill="#e88a9a" stroke="${line}" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M100 138 Q100 146 90 146 M100 138 Q100 146 110 146" stroke="${line}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path d="M70 134 L28 128 M70 140 L30 144 M130 134 L172 128 M130 140 L170 144" stroke="${line}" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>
    </svg>`;
}
