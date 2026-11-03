/* Cat Snap — static data, seed sightings and the cat sketch generator. */
(function () {
  'use strict';

  // Places you can snap a cat. There is deliberately no "home" option:
  // Cat Snap is about cats you meet out in the world, not pets.
  const HABITATS = {
    street:     { label: 'Street & Alley',   icon: '🏙️', color: '#8b7a64', weight: 0, bg: '#e8e2d6' },
    shop:       { label: 'Shop & Market',    icon: '🧺', color: '#c2702a', weight: 0, bg: '#f3e1c7' },
    harbour:    { label: 'Harbour & Coast',  icon: '⚓', color: '#2f78a8', weight: 1, bg: '#d6e6ef' },
    attraction: { label: 'Attraction',       icon: '🏛️', color: '#8a58b0', weight: 1, bg: '#e9dcef' },
    wild:       { label: 'Wild & Trail',     icon: '🌲', color: '#3e8a55', weight: 2, bg: '#d9ead3' },
  };

  const COATS = {
    orange:    { label: 'Orange tabby',   fur: '#e8913a', accent: '#b8601a', pattern: 'tabby' },
    grey:      { label: 'Grey tabby',     fur: '#9aa0a6', accent: '#5f6368', pattern: 'tabby' },
    brown:     { label: 'Brown tabby',    fur: '#a07850', accent: '#5a3e24', pattern: 'tabby' },
    black:     { label: 'Black',          fur: '#2b2b2e', accent: '#2b2b2e', pattern: 'solid' },
    white:     { label: 'White',          fur: '#f6f4ef', accent: '#f6f4ef', pattern: 'solid' },
    tuxedo:    { label: 'Tuxedo',         fur: '#26262a', accent: '#ffffff', pattern: 'tuxedo' },
    calico:    { label: 'Calico',         fur: '#f6f1e7', accent: '#2d2a28', pattern: 'calico' },
    tortie:    { label: 'Tortoiseshell',  fur: '#3a2a20', accent: '#c4672a', pattern: 'calico' },
    bicolor:   { label: 'Black & white',  fur: '#ffffff', accent: '#2b2b2e', pattern: 'bicolor' },
    cream:     { label: 'Cream',          fur: '#ead8b5', accent: '#c9ae80', pattern: 'tabby' },
    siamese:   { label: 'Pointed',        fur: '#efe4d2', accent: '#5b4436', pattern: 'pointed' },
  };

  const EYES = {
    amber: { label: 'Amber', color: '#e0a526' },
    green: { label: 'Green', color: '#7cb342' },
    blue:  { label: 'Blue',  color: '#4f9fe0' },
    copper:{ label: 'Copper',color: '#c26a2c' },
    odd:   { label: 'Odd-eyed', color: '#4f9fe0', color2: '#e0a526' },
  };

  const RATING_KEYS = [
    { key: 'charm',    label: 'Charm' },
    { key: 'fluff',    label: 'Fluff' },
    { key: 'pose',     label: 'Pose' },
    { key: 'friendly', label: 'Friendliness' },
  ];

  const TAGS = ['Chonky', 'Sleepy', 'Curious', 'Shy', 'Chatty', 'Regal', 'Feral-ish',
    'Ear-tipped', 'Missing tooth', 'Battle scars', 'Sunbather', 'Guardian', 'Mischief'];

  const RARITY = [
    { name: 'Common',    points: 10,  cls: 'r0' },
    { name: 'Uncommon',  points: 25,  cls: 'r1' },
    { name: 'Rare',      points: 50,  cls: 'r2' },
    { name: 'Legendary', points: 100, cls: 'r3' },
  ];

  /**
   * Rarity rewards hard-to-find cats: remote habitats score higher,
   * and cats that lots of people have already logged drift toward Common.
   */
  function rarityOf(snap) {
    let score = HABITATS[snap.habitat] ? HABITATS[snap.habitat].weight : 0;
    if (snap.sightings <= 3) score += 1;
    if (snap.sightings > 15) score -= 1;
    if (snap.eyes === 'odd') score += 1;
    return RARITY[Math.max(0, Math.min(3, score))];
  }

  // ---------- Cat sketch generator (SVG) ----------
  let svgId = 0;
  function catSVG(opts) {
    const coat = COATS[opts.coat] || COATS.orange;
    const eye = EYES[opts.eyes] || EYES.amber;
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

  // ---------- Seed sightings ----------
  // Offsets (in km, east/north) from wherever the viewer is, so the radar
  // always has something nearby. `ago` is minutes before page load.
  const SEED = [
    { id: 's1', name: 'Captain Biscuit', coat: 'orange', eyes: 'amber', habitat: 'harbour', spot: 'Old ferry pier, bollard #4',
      dx: 0.4, dy: -0.3, ago: 18, user: 'mira_on_foot', sightings: 6, likes: 42,
      ratings: { charm: 5, fluff: 4, pose: 5, friendly: 4 }, tags: ['Chonky', 'Sunbather', 'Guardian'],
      notes: 'Supervises every ferry docking. Accepts head scratches from fishermen only.',
      comments: [{ user: 'deckhand_lu', text: 'He was here at 6am too, judging the catch.' }] },
    { id: 's2', name: 'The Abbess', coat: 'calico', eyes: 'green', habitat: 'attraction', spot: 'Cathedral cloister garden',
      dx: -0.8, dy: 0.5, ago: 55, user: 'pilgrim_pete', sightings: 3, likes: 87,
      ratings: { charm: 5, fluff: 3, pose: 5, friendly: 2 }, tags: ['Regal', 'Shy'],
      notes: 'Sits exactly on the sundial at noon. The guides say she has lived here 9 years.',
      comments: [{ user: 'mira_on_foot', text: 'Legend. Saw her last spring too.' }] },
    { id: 's3', name: 'Moss', coat: 'brown', eyes: 'green', habitat: 'wild', spot: 'Ridge trail, km 3 marker',
      dx: 2.1, dy: 1.4, ago: 140, user: 'trailcat_tom', sightings: 1, likes: 61,
      ratings: { charm: 4, fluff: 4, pose: 3, friendly: 1 }, tags: ['Feral-ish', 'Ear-tipped'],
      notes: 'Watched from a boulder for a full minute then vanished into the ferns. TNR ear tip.',
      comments: [] },
    { id: 's4', name: 'Señor Bigotes', coat: 'tuxedo', eyes: 'amber', habitat: 'shop', spot: 'Night market, spice stall',
      dx: -0.2, dy: -0.6, ago: 35, user: 'snackhunter', sightings: 22, likes: 120,
      ratings: { charm: 5, fluff: 3, pose: 4, friendly: 5 }, tags: ['Chatty', 'Chonky'],
      notes: 'Stall owner says he is "head of security". Meows at anyone who lingers.',
      comments: [{ user: 'pilgrim_pete', text: 'Everybody has a Bigotes snap but I still love him.' }] },
    { id: 's5', name: 'Ghost', coat: 'white', eyes: 'odd', habitat: 'attraction', spot: 'Castle ruins, west tower',
      dx: 1.2, dy: -1.6, ago: 300, user: 'ruin_rambler', sightings: 2, likes: 203,
      ratings: { charm: 5, fluff: 5, pose: 5, friendly: 2 }, tags: ['Regal', 'Shy', 'Guardian'],
      notes: 'One blue eye, one gold. Only appears near closing time.',
      comments: [{ user: 'trailcat_tom', text: 'Odd-eyed?! Heading there this weekend.' }, { user: 'snackhunter', text: 'Unreal find.' }] },
    { id: 's6', name: 'Pistachio', coat: 'grey', eyes: 'green', habitat: 'street', spot: 'Stairway alley behind the bakery',
      dx: 0.15, dy: 0.25, ago: 8, user: 'mira_on_foot', sightings: 11, likes: 18,
      ratings: { charm: 4, fluff: 3, pose: 4, friendly: 4 }, tags: ['Curious', 'Mischief'],
      notes: 'Stole half a croissant and looked extremely proud.',
      comments: [] },
    { id: 's7', name: 'Lady Marmalade', coat: 'tortie', eyes: 'copper', habitat: 'harbour', spot: 'Lighthouse steps',
      dx: 3.4, dy: -0.4, ago: 900, user: 'saltwater_sam', sightings: 4, likes: 54,
      ratings: { charm: 4, fluff: 4, pose: 5, friendly: 3 }, tags: ['Sunbather', 'Sleepy'],
      notes: 'Curled up on the warm stone at the base of the lighthouse.',
      comments: [] },
    { id: 's8', name: 'Professor Paws', coat: 'siamese', eyes: 'blue', habitat: 'attraction', spot: 'Botanical garden glasshouse',
      dx: -1.6, dy: -1.1, ago: 75, user: 'fern_fanatic', sightings: 5, likes: 77,
      ratings: { charm: 5, fluff: 3, pose: 4, friendly: 4 }, tags: ['Chatty', 'Curious'],
      notes: 'Follows the 2pm tour group and yells at the orchids.',
      comments: [{ user: 'ruin_rambler', text: 'The garden staff call him "the Director".' }] },
    { id: 's9', name: 'Shadow of the Pines', coat: 'black', eyes: 'amber', habitat: 'wild', spot: 'Pine forest campground',
      dx: -4.5, dy: 3.2, ago: 1500, user: 'trailcat_tom', sightings: 1, likes: 39,
      ratings: { charm: 4, fluff: 4, pose: 2, friendly: 1 }, tags: ['Feral-ish', 'Battle scars'],
      notes: 'Only visible as two glowing eyes until the campfire lit up.',
      comments: [] },
    { id: 's10', name: 'Domino', coat: 'bicolor', eyes: 'green', habitat: 'street', spot: 'Clock tower square bench',
      dx: 0.7, dy: 0.9, ago: 210, user: 'snackhunter', sightings: 17, likes: 25,
      ratings: { charm: 3, fluff: 3, pose: 4, friendly: 5 }, tags: ['Sleepy', 'Chonky'],
      notes: 'Has claimed the bench. Pigeons give him a wide berth.',
      comments: [] },
    { id: 's11', name: 'Clementine', coat: 'cream', eyes: 'copper', habitat: 'shop', spot: 'Used bookshop window',
      dx: -0.5, dy: 1.3, ago: 3000, user: 'fern_fanatic', sightings: 8, likes: 33,
      ratings: { charm: 4, fluff: 5, pose: 3, friendly: 3 }, tags: ['Sleepy', 'Sunbather'],
      notes: 'Sleeping on the poetry section. Visible from the street.',
      comments: [] },
    { id: 's12', name: 'Vineyard Vic', coat: 'orange', eyes: 'green', habitat: 'wild', spot: 'Hillside vineyard lane',
      dx: 6.8, dy: 4.1, ago: 6000, user: 'saltwater_sam', sightings: 2, likes: 46,
      ratings: { charm: 5, fluff: 4, pose: 4, friendly: 3 }, tags: ['Battle scars', 'Guardian'],
      notes: 'Patrols the rows at dusk. Probably the reason there are no mice.',
      comments: [] },
  ];


  // ---------- Line icons (24px grid, stroke = currentColor) ----------
  const ICON_PATHS = {
    home:    '<path d="M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z"/>',
    radar:   '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12l6.5-6.5"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>',
    camera:  '<path d="M4 7.5h3.2l1.8-2.5h6l1.8 2.5H20a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.2" r="3.8"/>',
    book:    '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/><path d="M9 7.5h6"/>',
    heart:   '<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
    comment: '<path d="M4.5 5h15a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1H10l-4.5 3.5v-3.5h-1a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>',
    eye:     '<path d="M2.5 12S6 6 12 6s9.5 6 9.5 6S18 18 12 18 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    pin:     '<path d="M12 21s-6.5-5.8-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15.2 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.3"/>',
    lock:    '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    crown:   '<path d="M3.5 8.5 8 12l4-6.5 4 6.5 4.5-3.5-1.8 10H5.3z"/>',
    globe:   '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 3.2 2.8 14.8 0 18M12 3c-2.8 3.2-2.8 14.8 0 18"/>',
    bell:    '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5h4"/>',
    check:   '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x:       '<path d="M6 6l12 12M18 6 6 18"/>',
    locate:  '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
    filter:  '<path d="M4 6h16M7 12h10M10 18h4"/>',
    sparkle: '<path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z"/>',
    image:   '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-5-5-8.5 8"/>',
    ad:      '<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M7.5 15l2-6 2 6M8.2 13h2.6M14 9v6h1.4a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2z"/>',
    heartF:  '<path fill="currentColor" d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
  };
  const PAW = '<svg class="paw" viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="15.5" rx="5" ry="4.3"/><ellipse cx="5.6" cy="10" rx="2.1" ry="2.6"/><ellipse cx="9.4" cy="6.3" rx="2.1" ry="2.7"/><ellipse cx="14.6" cy="6.3" rx="2.1" ry="2.7"/><ellipse cx="18.4" cy="10" rx="2.1" ry="2.6"/></svg>';
  function icon(name, cls) {
    return `<svg class="i ${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;
  }

  // Mock advertisers shown to Free users (house-style native cards).
  const ADS = [
    { brand: 'Ridgeline Outfitters', line: 'Trail-ready daypacks for weekend wanderers.', cta: 'Shop daypacks', hue: '#2f6b4f' },
    { brand: 'Harbour Lights Ferries', line: 'Island hopping all summer. Cat-spotting optional.', cta: 'See timetable', hue: '#1f5d8a' },
    { brand: 'Paws Across Borders', line: 'Fund TNR programs that keep street cats healthy.', cta: 'Donate', hue: '#8a4b1f' },
  ];

  // Plus "travel mode": preview the radar in another city.
  const CITIES = [
    { key: 'istanbul', label: 'Istanbul', lat: 41.0256, lng: 28.9741 },
    { key: 'kyoto',    label: 'Kyoto',    lat: 35.0037, lng: 135.7788 },
    { key: 'valletta', label: 'Valletta', lat: 35.8989, lng: 14.5146 },
    { key: 'lisbon',   label: 'Lisbon',   lat: 38.7139, lng: -9.1334 },
    { key: 'hydra',    label: 'Hydra',    lat: 37.3496, lng: 23.4664 },
  ];

  window.CatData = { HABITATS, COATS, EYES, RATING_KEYS, TAGS, RARITY, SEED, rarityOf, catSVG, icon, PAW, ADS, CITIES };
})();
