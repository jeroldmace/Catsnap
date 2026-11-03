/* Cat Snap — prototype app logic (vanilla JS, no build step). */
(function () {
  'use strict';
  const { HABITATS, COATS, EYES, RATING_KEYS, TAGS, RARITY, SEED, rarityOf, catSVG, icon, PAW, ADS, CITIES } = window.CatData;

  const STORE_KEY = 'catsnap.v1';
  const DEMO_CENTER = { lat: 41.0256, lng: 28.9741, label: 'Istanbul (demo)' }; // a famously cat-friendly city
  const FUZZ_DEG = 0.0009; // ~100 m blur on posted locations, same for every tier
  const FREE = { radius: [1, 3], ageH: [1, 24] };
  const AD_EVERY = 5;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  // ---------- Persistent store (per browser) ----------
  function loadStore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return Object.assign(defaultStore(), JSON.parse(raw));
    } catch (e) { /* storage unavailable */ }
    return defaultStore();
  }
  function defaultStore() {
    return { userSnaps: [], interactions: {}, username: 'you', plus: false, plan: 'year', claudePhoto: null };
  }
  function saveStore() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); }
    catch (e) { toast('Storage is full. Your changes show until you reload.'); }
  }

  const store = loadStore();
  const state = {
    center: { ...DEMO_CENTER },
    home: { ...DEMO_CENTER },
    located: false,
    travel: null,
    snaps: [],
    feedSort: 'recent',
    habitatFilter: null,
    radiusKm: 3,
    maxAgeH: 24,
    minRarity: 0,
    focusId: null,
    map: null,
    mapLayer: null,
    markers: {},
    draft: { photo: null, habitat: 'street', ratings: {}, tags: new Set() },
  };
  const isPlus = () => !!store.plus;

  // The featured example: a cat the user named Claude.
  const CLAUDE = {
    id: 'claude', name: 'Claude', coat: 'orange', eyes: 'amber', habitat: 'street',
    spot: 'Our laneway, by the garden gate', dx: 0.08, dy: 0.12, ago: 25, sightings: 2, likes: 64,
    ratings: { charm: 5, fluff: 4, pose: 5, friendly: 4 }, tags: ['Curious', 'Chatty', 'Guardian'],
    notes: 'We named this one Claude. Turns up most evenings to inspect the garden and supervise anyone who stops to say hello.',
    comments: [{ user: 'mira_on_foot', text: 'Claude! Instant favourite.' }, { user: 'snackhunter', text: 'That pose is unreal.' }],
    featured: true,
  };

  // ---------- Helpers ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function timeAgo(ts) {
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} h ago`;
    return `${Math.round(h / 24)} d ago`;
  }
  function distanceKm(a, b) {
    const R = 6371, toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const fmtDist = (km) => (km < 1 ? `${Math.max(10, Math.round(km * 100) * 10)} m` : `${km.toFixed(1)} km`);
  const overall = (r) => RATING_KEYS.reduce((a, k) => a + (r[k.key] || 0), 0) / RATING_KEYS.length;
  const habitatTag = (h) => `<span class="habitat-tag"><i class="dot" style="background:${HABITATS[h].color}"></i>${HABITATS[h].label}</span>`;
  const meter = (n) => `<span class="meter">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;

  function artHTML(s) {
    if (s.photo) return `<img src="${s.photo}" alt="Photo of ${esc(s.name)}" loading="lazy" />`;
    return catSVG({ coat: s.coat, eyes: s.eyes, bg: HABITATS[s.habitat].bg });
  }
  function fillIcons(root = document) {
    $$('[data-icon]', root).forEach((el) => { if (!el.firstChild || el.dataset.filled !== '1') { el.innerHTML = icon(el.dataset.icon); el.dataset.filled = '1'; } });
    $$('[data-paw]', root).forEach((el) => { el.innerHTML = PAW; });
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
  }

  function resizeImage(file, max, cb) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        cb(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => toast("That file couldn't be read as an image. Try a JPEG or PNG.");
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  // ---------- Build the merged list of snaps ----------
  function buildSnaps() {
    const now = Date.now();
    const c = state.center;
    const place = (s) => ({
      ...s,
      lat: c.lat + s.dy / 111,
      lng: c.lng + s.dx / (111 * Math.cos((c.lat * Math.PI) / 180)),
      ts: now - s.ago * 60000,
    });
    const claude = { ...place(CLAUDE), user: store.username, mine: true, photo: store.claudePhoto || null };
    const seed = SEED.map((s) => ({ ...place(s), mine: false }));
    const mine = store.userSnaps.map((s) => ({ ...s, mine: true }));
    state.snaps = [claude, ...mine, ...seed].map((s) => {
      const ix = store.interactions[s.id] || {};
      const snap = {
        ...s,
        liked: !!ix.liked,
        spotted: !!ix.spotted,
        likes: (s.likes || 0) + (ix.liked ? 1 : 0),
        sightings: (s.sightings || 1) + (ix.spotted ? 1 : 0),
        comments: [...(s.comments || []), ...(ix.comments || [])],
      };
      snap.rarity = rarityOf(snap);
      snap.rIdx = RARITY.indexOf(snap.rarity);
      snap.score = overall(snap.ratings);
      snap.dist = distanceKm(c, snap);
      return snap;
    });
  }
  const getSnap = (id) => state.snaps.find((s) => s.id === id);
  const interact = (id) => (store.interactions[id] = store.interactions[id] || {});

  function refreshAll() {
    buildSnaps();
    renderFeatured();
    renderFeed();
    renderRadar();
    renderDex();
    renderPlus();
    renderPoints();
  }

  // ---------- Navigation ----------
  function showView(name) {
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
    $$('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
    if (name === 'radar') {
      ensureMap();
      setTimeout(() => { state.map.invalidateSize(); renderRadar(); }, 50);
    }
    if (name === 'snap') updateSnapLoc();
    window.scrollTo(0, 0);
  }
  function openPlus(feature) {
    closeDetail();
    showView('plus');
    if (feature) toast(`${feature} is part of Plus`);
  }

  // ---------- Feed ----------
  function renderFeatured() {
    const s = getSnap('claude');
    $('#featured').innerHTML = `
      <button class="featured" data-open="claude" aria-label="Open Claude's snap">
        <div class="art">${artHTML(s)}</div>
        <div class="feat-top">
          <span class="feat-label">${icon('sparkle')} Featured find</span>
          <span class="rarity inline ${s.rarity.cls}" style="font-size:.66rem;padding:4px 9px">${s.rarity.name}</span>
        </div>
        <div class="feat-body">
          <h2>${esc(s.name)}</h2>
          <div class="feat-meta">
            <span class="score-chip">${PAW}${s.score.toFixed(1)}</span>
            <span>${esc(s.spot)}</span>
            <span class="mono">${fmtDist(s.dist)} · ${timeAgo(s.ts)}</span>
          </div>
          <p class="feat-quote">${esc(s.notes)}</p>
        </div>
      </button>
      ${s.photo ? '' : `<button class="pill-btn dark" data-claude-photo style="margin:-4px 0 14px">${icon('image')} Add Claude's real photo</button>`}`;
  }

  function renderFeed() {
    let list = state.snaps.filter((s) => !s.featured);
    if (state.habitatFilter) list = list.filter((s) => s.habitat === state.habitatFilter);
    const sorters = {
      recent: (a, b) => b.ts - a.ts,
      nearby: (a, b) => a.dist - b.dist,
      top: (a, b) => b.score - a.score || b.likes - a.likes,
      rare: (a, b) => b.rIdx - a.rIdx || b.ts - a.ts,
    };
    list.sort(sorters[state.feedSort]);

    const parts = [];
    list.forEach((s, i) => {
      parts.push(cardHTML(s));
      if (!isPlus() && (i + 1) % AD_EVERY === 0) parts.push(adHTML(Math.floor(i / AD_EVERY)));
    });
    $('#feed').innerHTML = parts.length ? parts.join('') : '<p class="empty">No cats in this habitat yet. Go exploring.</p>';
  }

  function cardHTML(s) {
    const fresh = Date.now() - s.ts < 3600000;
    return `
      <article class="card ${s.rarity.cls}" data-id="${s.id}">
        <div class="card-art">${artHTML(s)}
          <span class="rarity ${s.rarity.cls}">${s.rarity.name}</span>
          ${fresh ? '<span class="new-flag">NEW</span>' : ''}
          <div class="art-title"><h3>${esc(s.name)}</h3><span class="score-chip">${PAW}${s.score.toFixed(1)}</span></div>
        </div>
        <div class="card-body">
          <div class="spot-line">${icon('pin')}<span>${esc(s.spot)}</span></div>
          <div class="field-line">${habitatTag(s.habitat)}<span class="mono">${fmtDist(s.dist)} · ${timeAgo(s.ts)}</span></div>
          <div class="card-foot">
            <div class="actions">
              <button class="act ${s.liked ? 'liked' : ''}" data-like="${s.id}" aria-label="Like">${icon(s.liked ? 'heartF' : 'heart')}${s.likes}</button>
              <button class="act" data-open="${s.id}" aria-label="Comments">${icon('comment')}${s.comments.length}</button>
              <button class="act" data-open="${s.id}" aria-label="Sightings">${icon('eye')}${s.sightings}</button>
            </div>
            <span class="byline">@${esc(s.user)}</span>
          </div>
        </div>
      </article>`;
  }

  function adHTML(n, extraCls) {
    const ad = ADS[n % ADS.length];
    const glyph = ['globe', 'bell', 'heart'][n % 3];
    return `
      <aside class="ad-card ${extraCls || ''}" aria-label="Advertisement">
        <div class="ad-art" style="background:linear-gradient(135deg, ${ad.hue}, color-mix(in srgb, ${ad.hue} 60%, #000))">${icon(glyph)}</div>
        <div class="ad-body">
          <div class="ad-tag"><span>Sponsored</span><button data-goto-plus="Ad-free browsing">Remove ads</button></div>
          <span class="ad-brand">${esc(ad.brand)}</span>
          <span class="ad-line">${esc(ad.line)}</span>
          <button class="ad-cta" data-ad>${esc(ad.cta)}</button>
        </div>
      </aside>`;
  }

  function toggleLike(id) {
    const ix = interact(id);
    ix.liked = !ix.liked;
    saveStore();
    refreshAll();
    if (!$('#sheet').hidden) openDetail(id, true);
  }

  // ---------- Detail sheet ----------
  function openDetail(id, keepScroll) {
    const s = getSnap(id);
    if (!s) return;
    const coat = COATS[s.coat], eyes = EYES[s.eyes];
    const sheet = $('#sheet');
    const scroll = sheet.scrollTop;
    sheet.innerHTML = `
      <span class="sheet-grip"></span>
      <button class="sheet-close" aria-label="Close">${icon('x')}</button>
      <div class="sheet-art">${artHTML(s)}<span class="rarity ${s.rarity.cls}">${s.rarity.name} · ${s.rarity.points} pts</span></div>
      <div class="sheet-body">
        <div class="sheet-title">
          <div>
            <h2>${esc(s.name)}</h2>
            <div class="field-line" style="margin-top:6px">${habitatTag(s.habitat)}<span class="mono">${fmtDist(s.dist)} · ${timeAgo(s.ts)}</span></div>
          </div>
          <div class="big-score"><span class="score">${s.score.toFixed(1)}</span><span>of 5 paws</span></div>
        </div>
        <div class="spot-line">${icon('pin')}<span>${esc(s.spot)}</span></div>
        <p class="muted small">Snapped by <strong>@${esc(s.user)}</strong></p>

        <div class="traits">
          <div><span>Coat</span><strong>${coat ? coat.label : 'Unknown'}</strong></div>
          <div><span>Eyes</span><strong>${eyes ? eyes.label : 'Unknown'}</strong></div>
          <div><span>Sightings</span><strong>${s.sightings}</strong></div>
        </div>

        <div class="ratings">
          ${RATING_KEYS.map((k) => `<div class="rating-row"><span>${k.label}</span>${meter(s.ratings[k.key] || 0)}<span class="mono">${s.ratings[k.key] || 0}</span></div>`).join('')}
        </div>

        ${s.tags && s.tags.length ? `<div class="tags">${s.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
        ${s.notes ? `<blockquote class="notes">${esc(s.notes)}</blockquote>` : ''}

        <div class="sheet-actions">
          <button class="pill-btn ${s.liked ? 'liked' : ''}" data-like="${s.id}">${icon(s.liked ? 'heartF' : 'heart')}${s.likes}</button>
          ${s.mine
            ? (s.id === 'claude' ? `<button class="pill-btn dark" data-claude-photo>${icon('image')}${s.photo ? 'Change photo' : "Add Claude's photo"}</button>` : '')
            : `<button class="pill-btn ${s.spotted ? 'on' : ''}" data-spot="${s.id}">${icon(s.spotted ? 'check' : 'eye')}${s.spotted ? 'You spotted them' : 'I spotted them too · +5'}</button>`}
          <button class="pill-btn" data-locate="${s.id}">${icon('radar')}Show on radar</button>
        </div>

        <h3>Comments</h3>
        <ul class="comments">
          ${s.comments.length ? s.comments.map((c) => `<li><strong>@${esc(c.user)}</strong>${esc(c.text)}</li>`).join('') : '<li class="muted">No comments yet. Say hi.</li>'}
        </ul>
        <form class="comment-form" data-comment="${s.id}">
          <input name="text" id="commentText" maxlength="200" placeholder="Add a comment…" required />
          <button type="submit">Post</button>
        </form>
      </div>`;
    sheet.hidden = false;
    $('#sheetBackdrop').hidden = false;
    if (keepScroll) sheet.scrollTop = scroll; else sheet.scrollTop = 0;
    requestAnimationFrame(() => sheet.classList.add('open'));
  }
  function closeDetail() {
    const sheet = $('#sheet');
    if (sheet.hidden) return;
    sheet.classList.remove('open');
    $('#sheetBackdrop').hidden = true;
    setTimeout(() => { sheet.hidden = true; }, 250);
  }

  // ---------- Radar ----------
  function ensureMap() {
    if (state.map) return;
    if (!window.L || window.CATSNAP_SCOPE) {
      // No map tiles available (offline or sandboxed): draw a radar scope instead.
      $('#map').classList.add('scope-mode');
      state.map = { invalidateSize() {}, setView() {}, fake: true };
      return;
    }
    const map = L.map('map', { zoomControl: false, attributionControl: true }).setView([state.center.lat, state.center.lng], 14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    state.map = map;
    state.mapLayer = L.layerGroup().addTo(map);
  }

  function radarSnaps() {
    const maxAgeMs = state.maxAgeH * 3600000;
    return state.snaps
      .filter((s) => s.dist <= state.radiusKm && Date.now() - s.ts <= maxAgeMs && s.rIdx >= state.minRarity)
      .sort((a, b) => a.dist - b.dist);
  }

  function renderRadar() {
    const list = radarSnaps();
    const where = state.travel ? state.travel.label : (state.located ? 'you' : DEMO_CENTER.label);
    $('#radarTitle').textContent = state.travel ? `Previewing ${state.travel.label}` : 'Recent sightings near you';
    $('#radarCount').textContent = `${list.length} within ${state.radiusKm} km`;
    $('#radarStatus').textContent = `${state.center.lat.toFixed(3)}°, ${state.center.lng.toFixed(3)}° · ${state.travel ? 'travel mode' : (state.located ? 'live' : 'demo city')}`;
    $('#radarList').innerHTML = list.length ? list.map((s) => `
      <li data-open="${s.id}">
        <div class="mini-art ${s.rarity.cls}">${artHTML(s)}</div>
        <div class="grow">
          <div class="li-name">${esc(s.name)} <span class="rarity inline ${s.rarity.cls}">${s.rarity.name}</span></div>
          <div class="li-sub">${esc(s.spot)}</div>
        </div>
        <div class="right">
          <strong>${fmtDist(s.dist)}</strong>
          <span class="mono muted">${timeAgo(s.ts)}</span>
        </div>
      </li>`).join('') : `<li class="empty">No recent cats in range around ${esc(where)}. ${isPlus() ? 'Try a wider range or longer window.' : 'Plus widens the range to 25 km and 30 days.'}</li>`;
    $('#radarAd').innerHTML = isPlus() ? '' : adHTML(1, 'ad-banner');

    if (!state.map) return;
    if (state.map.fake) { renderScope(list); return; }
    const layer = state.mapLayer;
    layer.clearLayers();
    state.markers = {};
    const c = [state.center.lat, state.center.lng];
    L.circle(c, { radius: state.radiusKm * 1000, color: '#e5862a', weight: 1.5, fillOpacity: 0.05, dashArray: '6 6' }).addTo(layer);
    L.marker(c, { icon: L.divIcon({ className: '', html: '<div class="me-pin"></div>', iconSize: [18, 18] }), interactive: false }).addTo(layer);
    list.forEach((s) => {
      const fresh = Date.now() - s.ts < 3600000;
      const m = L.marker([s.lat, s.lng], {
        icon: L.divIcon({ className: '', html: `<div class="cat-pin ${s.rarity.cls} ${fresh ? 'fresh' : ''}">${artHTML(s)}</div>`, iconSize: [46, 46], iconAnchor: [23, 23] }),
      }).addTo(layer);
      m.bindPopup(`<div class="pop"><strong>${esc(s.name)}</strong> <span class="rarity inline ${s.rarity.cls}">${s.rarity.name}</span><br/>
        <span class="muted small">${esc(s.spot)} · ${timeAgo(s.ts)}</span><br/><button class="pop-btn" data-open="${s.id}">View snap</button></div>`);
      state.markers[s.id] = m;
    });
  }

  function renderScope(list) {
    const c = state.center, R = state.radiusKm;
    const kx = 111 * Math.cos((c.lat * Math.PI) / 180);
    const rings = [0.25, 0.5, 0.75, 1].map((f) => `
      <div class="ring" style="width:${f * 90}%"><span>${fmtDist(R * f)}</span></div>`).join('');
    const ticks = [['N', 50, 2.5], ['E', 97.5, 50], ['S', 50, 97.5], ['W', 2.5, 50]]
      .map(([t, x, y]) => `<span class="tick" style="left:${x}%;top:${y}%">${t}</span>`).join('');
    const pins = list.map((s) => {
      const x = 50 + (((s.lng - c.lng) * kx) / R) * 45;
      const y = 50 - (((s.lat - c.lat) * 111) / R) * 45;
      const fresh = Date.now() - s.ts < 3600000;
      return `<button class="cat-pin scope-pin ${s.rarity.cls} ${fresh ? 'fresh' : ''} ${state.focusId === s.id ? 'focus' : ''}"
        style="left:${x}%;top:${y}%" data-open="${s.id}" aria-label="${esc(s.name)}, ${fmtDist(s.dist)} away">${artHTML(s)}</button>`;
    }).join('');
    $('#map').innerHTML = `<div class="scope">${rings}<div class="axis h"></div><div class="axis v"></div>${ticks}
      <div class="me-pin scope-me"></div>${pins}</div>`;
  }

  function focusOnRadar(id) {
    const s = getSnap(id);
    closeDetail();
    // Widen filters (within what this tier allows) so the cat shows if possible.
    const radii = isPlus() ? [1, 3, 10, 25] : FREE.radius;
    const ages = isPlus() ? [1, 24, 168, 720] : FREE.ageH;
    const ageH = (Date.now() - s.ts) / 3600000;
    state.radiusKm = radii.find((r) => r >= s.dist) || radii[radii.length - 1];
    state.maxAgeH = ages.find((h) => h >= ageH) || ages[ages.length - 1];
    state.minRarity = 0;
    syncSegs();
    state.focusId = id;
    showView('radar');
    if (s.dist > state.radiusKm || ageH > state.maxAgeH) toast(`${s.name} is outside the Free radar. Plus reaches 25 km and 30 days.`);
    setTimeout(() => {
      if (state.map.fake) return;
      state.map.setView([s.lat, s.lng], 16);
      const m = state.markers[id];
      if (m) m.openPopup();
    }, 120);
  }

  function syncSegs() {
    $$('#radiusSeg button').forEach((b) => b.classList.toggle('active', +b.dataset.r === state.radiusKm));
    $$('#ageSeg button').forEach((b) => b.classList.toggle('active', +b.dataset.h === state.maxAgeH));
    $$('#raritySeg button').forEach((b) => b.classList.toggle('active', +b.dataset.min === state.minRarity));
    $$('#travelSeg button').forEach((b) => b.classList.toggle('active', (b.dataset.city || null) === (state.travel ? state.travel.key : null) || (!b.dataset.city && !state.travel)));
    if (state.map && !state.map.fake) state.map.setView([state.center.lat, state.center.lng], state.radiusKm <= 1 ? 15 : state.radiusKm <= 3 ? 14 : state.radiusKm <= 10 ? 12 : 11);
  }

  function renderLocks() {
    $$('[data-plus]').forEach((b) => {
      if (!b.dataset.label) b.dataset.label = b.textContent.trim();
      const locked = !isPlus();
      b.classList.toggle('locked', locked);
      b.innerHTML = (locked ? icon('lock') : '') + esc(b.dataset.label);
    });
  }

  function buildTravelSeg() {
    $('#travelSeg').innerHTML = `<button class="active">Here</button>` +
      CITIES.map((c) => `<button data-city="${c.key}" data-plus>${esc(c.label)}</button>`).join('');
  }

  function setTravel(key) {
    if (!key) {
      state.travel = null;
      state.center = { ...state.home };
    } else {
      const city = CITIES.find((c) => c.key === key);
      state.travel = city;
      state.center = { lat: city.lat, lng: city.lng };
    }
    state.focusId = null;
    refreshAll();
    syncSegs();
  }

  function locate(manual) {
    if (!navigator.geolocation) {
      if (manual) toast('Location is not available here, so the radar uses the demo city.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.home = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        state.located = true;
        if (!state.travel) state.center = { ...state.home };
        refreshAll();
        updateSnapLoc();
        syncSegs();
        if (manual) toast('Radar centred on you');
      },
      () => {
        if (manual) toast('Location was blocked, so the radar uses the demo city.');
        updateSnapLoc();
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }

  // ---------- Snap form ----------
  function buildSnapForm() {
    $('#coat').innerHTML = Object.entries(COATS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
    $('#eyes').innerHTML = Object.entries(EYES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
    $('#habitatPicker').innerHTML = Object.entries(HABITATS).map(([k, v]) =>
      `<button type="button" data-habitat="${k}" class="${k === state.draft.habitat ? 'active' : ''}"><i class="dot" style="background:${v.color}"></i>${v.label}</button>`).join('');
    $('#ratingGrid').innerHTML = RATING_KEYS.map((k) => `
      <div class="rate" data-key="${k.key}">
        <span>${k.label}</span>
        <div class="paw-input">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-val="${n}" aria-label="${k.label} ${n} of 5">${PAW}</button>`).join('')}</div>
      </div>`).join('');
    RATING_KEYS.forEach((k) => setRating(k.key, 3));
    $('#tagPicker').innerHTML = TAGS.map((t) => `<button type="button" data-tag="${esc(t)}">${esc(t)}</button>`).join('');
    updateSketchPreview();
  }
  function setRating(key, val) {
    state.draft.ratings[key] = val;
    $$(`.rate[data-key="${key}"] .paw-input button`).forEach((b) => b.classList.toggle('on', +b.dataset.val <= val));
  }
  function updateSketchPreview() {
    if (state.draft.photo) return;
    $('#photoPreview').innerHTML = `
      <div class="sketch">${catSVG({ coat: $('#coat').value, eyes: $('#eyes').value, bg: HABITATS[state.draft.habitat].bg })}</div>
      <strong>Tap to take or upload a photo</strong>
      <span class="muted small">No photo? We'll post this sketch, drawn from the coat and eyes you pick.</span>`;
  }
  function updateSnapLoc() {
    $('#snapLoc').textContent = state.located
      ? 'Pinned at your current location, blurred about 100 m before posting.'
      : `Your location isn't available, so the snap will be pinned in ${DEMO_CENTER.label}.`;
  }

  function submitSnap(e) {
    e.preventDefault();
    const name = $('#catName').value.trim();
    const spot = $('#spot').value.trim();
    if (!name || !spot) return;
    if (!$('#wildConfirm').checked) { toast('Cat Snap is only for cats met out in the world.'); return; }
    const fuzz = () => (Math.random() * 2 - 1) * FUZZ_DEG;
    const base = state.home;
    const snap = {
      id: 'u' + Date.now(), name, spot,
      coat: $('#coat').value, eyes: $('#eyes').value, habitat: state.draft.habitat,
      ratings: { ...state.draft.ratings }, tags: [...state.draft.tags], notes: $('#notes').value.trim(),
      photo: state.draft.photo,
      lat: base.lat + fuzz(), lng: base.lng + fuzz(), ts: Date.now(),
      user: store.username, likes: 0, sightings: 1, comments: [],
    };
    store.userSnaps.unshift(snap);
    saveStore();
    if (state.travel) setTravel(null); else refreshAll();
    $('#snapForm').reset();
    state.draft = { photo: null, habitat: 'street', ratings: {}, tags: new Set() };
    buildSnapForm();
    const s = getSnap(snap.id);
    toast(`Posted. ${s.rarity.name} find, +${s.rarity.points} pts`);
    showView('feed');
    openDetail(snap.id);
  }

  // ---------- Catdex ----------
  function myPoints() {
    const mine = state.snaps.filter((s) => s.mine);
    return mine.reduce((a, s) => a + s.rarity.points, 0) + state.snaps.filter((s) => s.spotted).length * 5;
  }
  function renderPoints() {
    $('#pointsPill').textContent = `${myPoints()} pts`;
    $('#plusChip').classList.toggle('on', isPlus());
    $('#plusChipText').textContent = isPlus() ? 'Plus' : 'Get Plus';
  }
  function rankFor(p) {
    if (p >= 500) return 'Legendary Cat Whisperer';
    if (p >= 200) return 'Seasoned Tracker';
    if (p >= 50) return 'Alley Explorer';
    return 'Rookie Spotter';
  }
  function renderDex() {
    const mine = state.snaps.filter((s) => s.mine);
    const spotted = state.snaps.filter((s) => s.spotted);
    const habitats = new Set(mine.map((s) => s.habitat));
    const pts = myPoints();
    $('#dexName').textContent = '@' + store.username;
    $('#dexSub').textContent = `${rankFor(pts)}${isPlus() ? ' · Plus member' : ''}`;
    $('#dexStats').innerHTML = `
      <div><strong>${mine.length}</strong><span>Snaps</span></div>
      <div><strong>${spotted.length}</strong><span>Co-sights</span></div>
      <div><strong>${habitats.size}/5</strong><span>Habitats</span></div>
      <div><strong>${pts}</strong><span>Points</span></div>`;
    $('#dexPlus').innerHTML = isPlus() ? '' : `
      <div class="upsell">
        <div><strong>Cat Snap Plus</strong><p>Detailed stats, trip journals and a 25 km radar.</p></div>
        <button data-goto="plus">See Plus</button>
      </div>`;
    const badges = [
      { i: 'camera', name: 'First Snap', got: mine.length >= 1 },
      { i: 'globe', name: 'Trail Blazer', got: habitats.has('wild') },
      { i: 'sparkle', name: 'Culture Cat', got: habitats.has('attraction') },
      { i: 'pin', name: 'Salty Paws', got: habitats.has('harbour') },
      { i: 'radar', name: 'Globetrotter', got: habitats.size >= 5 },
      { i: 'crown', name: 'Legend Hunter', got: mine.some((s) => s.rarity.name === 'Legendary') },
      { i: 'eye', name: 'Witness', got: spotted.length >= 3 },
      { i: 'book', name: 'Collector', got: mine.length >= 10 },
    ];
    $('#dexBadges').innerHTML = badges.map((b) =>
      `<div class="badge ${b.got ? 'got' : ''}" title="${b.name}"><span class="medal">${icon(b.i)}</span>${b.name}</div>`).join('');
    $('#dexGrid').innerHTML = mine.length ? mine.map((s) => `
      <button class="dex-item" data-open="${s.id}">${artHTML(s)}<span class="rarity inline ${s.rarity.cls}">${s.rarity.name}</span><strong>${esc(s.name)}</strong></button>`).join('')
      : '<p class="empty">Your Catdex is empty. Head outside and snap your first cat.</p>';
  }

  // ---------- Plus ----------
  const COMPARE = [
    ['Snapping', 'Unlimited snaps, ratings, notes', 'Plus multi-photo snaps and full-resolution backup'],
    ['Radar range', '1 or 3 km', 'Up to 25 km'],
    ['Radar history', 'Last 24 h', 'Up to 30 days'],
    ['Radar filters', '—', 'Rare+ and Legendary only'],
    ['Travel mode', '—', 'Preview the radar in another city'],
    ['Rare-cat alerts', '—', '"A Rare cat was snapped within 2 km"'],
    ['Catdex', 'Snaps, points, badges', 'Detailed stats, maps, trip journals'],
    ['Ads', 'Shown in feed and radar', 'None'],
  ];
  function renderPlus() {
    $('#compareBody').innerHTML = COMPARE.map(([f, free, plus]) =>
      `<tr><td>${f}</td><td class="${free === '—' ? 'no' : ''}">${esc(free)}</td><td class="col-plus">${esc(plus)}</td></tr>`).join('');
    $$('#billing button').forEach((b) => {
      const on = b.dataset.plan === store.plan;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', on);
    });
    const cta = $('#plusCta');
    cta.textContent = isPlus() ? 'Switch back to Free (mock)' : 'Start 7-day free trial';
    cta.classList.toggle('gold', !isPlus());
    cta.classList.toggle('quiet', isPlus());
    renderLocks();
  }
  function togglePlus() {
    store.plus = !store.plus;
    if (!store.plus) {
      // Clamp radar settings back to the Free limits.
      if (!FREE.radius.includes(state.radiusKm)) state.radiusKm = 3;
      if (!FREE.ageH.includes(state.maxAgeH)) state.maxAgeH = 24;
      state.minRarity = 0;
      if (state.travel) { state.travel = null; state.center = { ...state.home }; }
    }
    saveStore();
    refreshAll();
    syncSegs();
    toast(isPlus() ? 'Plus is on. Mock only, no payment taken.' : 'Back on Free. Ads and radar limits are back.');
    if (isPlus()) showView('radar');
  }

  // ---------- Events ----------
  function bind() {
    $$('.tabbar button').forEach((b) => b.addEventListener('click', () => showView(b.dataset.view)));

    $('#feedTabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-sort]');
      if (!b) return;
      state.feedSort = b.dataset.sort;
      $$('#feedTabs .chip').forEach((c) => c.classList.toggle('active', c === b));
      renderFeed();
    });

    $('#habitatFilter').innerHTML = `<button class="chip active" data-h="">All habitats</button>` +
      Object.entries(HABITATS).map(([k, v]) => `<button class="chip" data-h="${k}"><i class="dot" style="background:${v.color}"></i>${v.label}</button>`).join('');
    $('#habitatFilter').addEventListener('click', (e) => {
      const b = e.target.closest('[data-h]');
      if (!b) return;
      state.habitatFilter = b.dataset.h || null;
      $$('#habitatFilter .chip').forEach((c) => c.classList.toggle('active', c === b));
      renderFeed();
    });

    // Hidden input for Claude's photo
    const claudeInput = document.createElement('input');
    claudeInput.type = 'file'; claudeInput.accept = 'image/*'; claudeInput.hidden = true; claudeInput.id = 'claudePhotoInput';
    document.body.appendChild(claudeInput);
    claudeInput.addEventListener('change', () => {
      const f = claudeInput.files[0];
      if (!f) return;
      resizeImage(f, 900, (url) => {
        store.claudePhoto = url;
        saveStore(); refreshAll();
        if (!$('#sheet').hidden) openDetail('claude', true);
        toast("Claude's photo added");
      });
      claudeInput.value = '';
    });

    // Global delegated clicks
    document.addEventListener('click', (e) => {
      const t = e.target;
      const lockedBtn = t.closest('[data-plus].locked');
      if (lockedBtn) { e.stopPropagation(); openPlus(lockedBtn.closest('#travelSeg') ? 'Travel mode' : lockedBtn.closest('#raritySeg') ? 'Rarity filtering' : 'A wider radar'); return; }
      const goPlus = t.closest('[data-goto-plus]');
      if (goPlus) { e.stopPropagation(); openPlus(goPlus.dataset.gotoPlus); return; }
      const go = t.closest('[data-goto]');
      if (go) { openPlus(); return; }
      if (t.closest('[data-ad]')) { toast('Mock ad. In the real app this opens the advertiser.'); return; }
      if (t.closest('[data-claude-photo]')) { e.stopPropagation(); claudeInput.click(); return; }
      const like = t.closest('[data-like]');
      if (like) { e.stopPropagation(); toggleLike(like.dataset.like); return; }
      const spot = t.closest('[data-spot]');
      if (spot) {
        const ix = interact(spot.dataset.spot);
        ix.spotted = !ix.spotted;
        saveStore(); refreshAll(); openDetail(spot.dataset.spot, true);
        if (ix.spotted) toast('Sighting logged, +5 pts');
        return;
      }
      const loc = t.closest('[data-locate]');
      if (loc) { focusOnRadar(loc.dataset.locate); return; }
      const open = t.closest('[data-open]');
      if (open) { openDetail(open.dataset.open); return; }
      const card = t.closest('.card');
      if (card) { openDetail(card.dataset.id); return; }
      if (t.closest('.sheet-close') || t.id === 'sheetBackdrop') closeDetail();
    }, true);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDetail(); });

    document.addEventListener('submit', (e) => {
      const f = e.target.closest('[data-comment]');
      if (!f) return;
      e.preventDefault();
      const text = f.elements.text.value.trim();
      if (!text) return;
      const ix = interact(f.dataset.comment);
      (ix.comments = ix.comments || []).push({ user: store.username, text });
      saveStore(); refreshAll(); openDetail(f.dataset.comment, true);
    });

    // Radar controls (locked buttons are intercepted above)
    $('#radiusSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (b) { state.radiusKm = +b.dataset.r; syncSegs(); renderRadar(); } });
    $('#ageSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-h]'); if (b) { state.maxAgeH = +b.dataset.h; syncSegs(); renderRadar(); } });
    $('#raritySeg').addEventListener('click', (e) => { const b = e.target.closest('[data-min]'); if (b) { state.minRarity = +b.dataset.min; syncSegs(); renderRadar(); } });
    $('#travelSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setTravel(b.dataset.city || null); });
    $('#locateBtn').addEventListener('click', () => { if (state.travel) setTravel(null); locate(true); });

    // Plus screen
    $('#billing').addEventListener('click', (e) => { const b = e.target.closest('[data-plan]'); if (b) { store.plan = b.dataset.plan; saveStore(); renderPlus(); } });
    $('#plusCta').addEventListener('click', togglePlus);

    // Snap form
    $('#photoInput').addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      resizeImage(f, 900, (url) => {
        state.draft.photo = url;
        $('#photoPreview').innerHTML = `<img src="${url}" alt="Your photo" /><span class="muted small">Tap to change</span>`;
      });
    });
    $('#coat').addEventListener('change', updateSketchPreview);
    $('#eyes').addEventListener('change', updateSketchPreview);
    $('#habitatPicker').addEventListener('click', (e) => {
      const b = e.target.closest('[data-habitat]');
      if (!b) return;
      state.draft.habitat = b.dataset.habitat;
      $$('#habitatPicker button').forEach((x) => x.classList.toggle('active', x === b));
      updateSketchPreview();
    });
    $('#ratingGrid').addEventListener('click', (e) => {
      const b = e.target.closest('[data-val]');
      if (b) setRating(b.closest('.rate').dataset.key, +b.dataset.val);
    });
    $('#tagPicker').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tag]');
      if (!b) return;
      const tag = b.dataset.tag, tags = state.draft.tags;
      tags.has(tag) ? tags.delete(tag) : tags.add(tag);
      b.classList.toggle('active', tags.has(tag));
    });
    $('#snapForm').addEventListener('submit', submitSnap);

    // Two-tap reset (browser confirm() dialogs are blocked in some embeds)
    let resetArmed = null;
    $('#resetBtn').addEventListener('click', (e) => {
      const btn = e.currentTarget;
      if (!resetArmed) {
        btn.textContent = 'Tap again to delete your snaps, likes, comments and Claude\'s photo';
        btn.classList.add('armed');
        resetArmed = setTimeout(() => { resetArmed = null; btn.textContent = 'Reset prototype data'; btn.classList.remove('armed'); }, 4000);
        return;
      }
      clearTimeout(resetArmed); resetArmed = null;
      btn.textContent = 'Reset prototype data'; btn.classList.remove('armed');
      Object.assign(store, defaultStore());
      saveStore(); setTravel(null); toast('Prototype data reset');
    });
  }

  // ---------- Boot ----------
  buildTravelSeg();
  fillIcons();
  bind();
  buildSnapForm();
  refreshAll();
  updateSnapLoc();
  locate(false);
})();
