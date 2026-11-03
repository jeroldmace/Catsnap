/* Cat Snap — prototype app logic (vanilla JS, no build step). */
(function () {
  'use strict';
  const { HABITATS, COATS, EYES, RATING_KEYS, TAGS, RARITY, SEED, rarityOf, catSVG } = window.CatData;

  const STORE_KEY = 'catsnap.v1';
  const DEMO_CENTER = { lat: 41.0256, lng: 28.9741, label: 'Istanbul (demo)' }; // a famously cat-friendly city
  const FUZZ_DEG = 0.0009; // ~100 m blur on posted locations

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  // ---------- Persistent store ----------
  function loadStore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* storage unavailable */ }
    return { userSnaps: [], interactions: {}, username: 'you' };
  }
  function saveStore() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); }
    catch (e) { toast('Storage is full — your snap is visible until you reload.'); }
  }

  const store = loadStore();
  const state = {
    center: { ...DEMO_CENTER },
    located: false,
    snaps: [],
    feedSort: 'recent',
    habitatFilter: null,
    radiusKm: 3,
    maxAgeH: 24,
    map: null,
    mapLayer: null,
    markers: {},
    draft: { photo: null, habitat: 'street', ratings: {}, tags: new Set() },
  };

  // ---------- Helpers ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function timeAgo(ts) {
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} h ago`;
    const d = Math.round(h / 24);
    return `${d} d ago`;
  }

  function distanceKm(a, b) {
    const R = 6371, toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const fmtDist = (km) => (km < 1 ? `${Math.round(km * 1000 / 10) * 10} m` : `${km.toFixed(1)} km`);

  function overall(r) {
    const vals = RATING_KEYS.map((k) => r[k.key] || 0);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  const paws = (n) => '🐾'.repeat(Math.round(n)) + '<span class="paw-off">' + '🐾'.repeat(5 - Math.round(n)) + '</span>';

  function artHTML(s) {
    if (s.photo) return `<img src="${s.photo}" alt="Photo of ${esc(s.name)}" />`;
    return catSVG({ coat: s.coat, eyes: s.eyes, bg: HABITATS[s.habitat].bg });
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ---------- Build the merged list of snaps ----------
  function buildSnaps() {
    const now = Date.now();
    const c = state.center;
    const seed = SEED.map((s) => ({
      ...s,
      lat: c.lat + s.dy / 111,
      lng: c.lng + s.dx / (111 * Math.cos((c.lat * Math.PI) / 180)),
      ts: now - s.ago * 60000,
      mine: false,
    }));
    const mine = store.userSnaps.map((s) => ({ ...s, mine: true }));
    state.snaps = [...mine, ...seed].map((s) => {
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
      snap.score = overall(snap.ratings);
      snap.dist = distanceKm(c, snap);
      return snap;
    });
  }
  const getSnap = (id) => state.snaps.find((s) => s.id === id);

  function interact(id) {
    return (store.interactions[id] = store.interactions[id] || {});
  }

  function refreshAll() {
    buildSnaps();
    renderFeed();
    renderRadar();
    renderDex();
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

  // ---------- Feed ----------
  function renderFeed() {
    let list = state.snaps.slice();
    if (state.habitatFilter) list = list.filter((s) => s.habitat === state.habitatFilter);
    const sorters = {
      recent: (a, b) => b.ts - a.ts,
      nearby: (a, b) => a.dist - b.dist,
      top: (a, b) => b.score - a.score || b.likes - a.likes,
      rare: (a, b) => RARITY.indexOf(b.rarity) - RARITY.indexOf(a.rarity) || b.ts - a.ts,
    };
    list.sort(sorters[state.feedSort]);

    $('#feed').innerHTML = list.length ? list.map(cardHTML).join('') :
      '<p class="empty">No cats here yet. Go explore! 🧭</p>';
  }

  function cardHTML(s) {
    const h = HABITATS[s.habitat];
    return `
      <article class="card" data-id="${s.id}">
        <div class="card-art">${artHTML(s)}
          <span class="rarity ${s.rarity.cls}">${s.rarity.name}</span>
        </div>
        <div class="card-body">
          <div class="card-title">
            <h3>${esc(s.name)}</h3>
            <span class="score">${s.score.toFixed(1)}<small>/5</small></span>
          </div>
          <div class="meta">
            <span class="habitat-chip">${h.icon} ${h.label}</span>
            <span>📍 ${esc(s.spot)}</span>
          </div>
          <div class="meta muted small">
            <span>${fmtDist(s.dist)} away</span> · <span>${timeAgo(s.ts)}</span> · <span>@${esc(s.user)}</span>
          </div>
          <div class="card-actions">
            <button class="like ${s.liked ? 'on' : ''}" data-like="${s.id}">${s.liked ? '❤️' : '🤍'} ${s.likes}</button>
            <button data-open="${s.id}">💬 ${s.comments.length}</button>
            <button data-open="${s.id}">👀 ${s.sightings} sighting${s.sightings === 1 ? '' : 's'}</button>
          </div>
        </div>
      </article>`;
  }

  function toggleLike(id) {
    const ix = interact(id);
    ix.liked = !ix.liked;
    saveStore();
    refreshAll();
    if (!$('#sheet').hidden) openDetail(id);
  }

  // ---------- Detail sheet ----------
  function openDetail(id) {
    const s = getSnap(id);
    if (!s) return;
    const h = HABITATS[s.habitat];
    const coat = COATS[s.coat], eyes = EYES[s.eyes];
    const sheet = $('#sheet');
    sheet.innerHTML = `
      <button class="sheet-close" aria-label="Close">✕</button>
      <div class="sheet-art">${artHTML(s)}<span class="rarity ${s.rarity.cls}">${s.rarity.name} · ${s.rarity.points} pts</span></div>
      <div class="sheet-body">
        <div class="card-title"><h2>${esc(s.name)}</h2><span class="score big">${s.score.toFixed(1)}<small>/5</small></span></div>
        <div class="meta">
          <span class="habitat-chip">${h.icon} ${h.label}</span>
          <span>📍 ${esc(s.spot)}</span>
        </div>
        <p class="muted small">Snapped by <strong>@${esc(s.user)}</strong> · ${timeAgo(s.ts)} · ${fmtDist(s.dist)} away</p>

        <div class="traits">
          <div><span class="muted small">Coat</span><strong>${coat ? coat.label : '—'}</strong></div>
          <div><span class="muted small">Eyes</span><strong>${eyes ? eyes.label : '—'}</strong></div>
          <div><span class="muted small">Sightings</span><strong>${s.sightings}</strong></div>
        </div>

        <div class="ratings">
          ${RATING_KEYS.map((k) => `
            <div class="rating-row">
              <span>${k.label}</span>
              <span class="paws">${paws(s.ratings[k.key] || 0)}</span>
            </div>`).join('')}
        </div>

        ${s.tags && s.tags.length ? `<div class="tags">${s.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
        ${s.notes ? `<blockquote class="notes">${esc(s.notes)}</blockquote>` : ''}

        <div class="sheet-actions">
          <button class="like ${s.liked ? 'on' : ''}" data-like="${s.id}">${s.liked ? '❤️' : '🤍'} ${s.likes}</button>
          ${s.mine ? '<span class="muted small">Your snap</span>' :
            `<button class="spot-btn ${s.spotted ? 'on' : ''}" data-spot="${s.id}">${s.spotted ? '✅ You spotted them' : '👀 I spotted them too (+5)'}</button>`}
          <button data-locate="${s.id}">📡 Show on radar</button>
        </div>

        <h3>Comments</h3>
        <ul class="comments">
          ${s.comments.length ? s.comments.map((c) => `<li><strong>@${esc(c.user)}</strong> ${esc(c.text)}</li>`).join('') : '<li class="muted">No comments yet — say hi.</li>'}
        </ul>
        <form class="comment-form" data-comment="${s.id}">
          <input name="text" maxlength="200" placeholder="Add a comment…" required />
          <button type="submit">Post</button>
        </form>
      </div>`;
    sheet.hidden = false;
    $('#sheetBackdrop').hidden = false;
    requestAnimationFrame(() => sheet.classList.add('open'));
  }

  function closeDetail() {
    const sheet = $('#sheet');
    sheet.classList.remove('open');
    $('#sheetBackdrop').hidden = true;
    setTimeout(() => { sheet.hidden = true; }, 200);
  }

  // ---------- Radar ----------
  function ensureMap() {
    if (state.map) return;
    if (!window.L) {
      $('#map').innerHTML = '<p class="empty">Map library could not load (offline?). The nearby list still works.</p>';
      state.map = { invalidateSize() {}, setView() {} , fake: true };
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
      .filter((s) => s.dist <= state.radiusKm && Date.now() - s.ts <= maxAgeMs)
      .sort((a, b) => a.dist - b.dist);
  }

  function renderRadar() {
    const list = radarSnaps();
    $('#radarCount').textContent = `${list.length} cat${list.length === 1 ? '' : 's'} within ${state.radiusKm} km`;
    $('#radarStatus').textContent = state.located ? '📍 Around you' : `📍 ${DEMO_CENTER.label}`;
    $('#radarList').innerHTML = list.length ? list.map((s) => `
      <li data-open="${s.id}">
        <div class="mini-art">${artHTML(s)}</div>
        <div class="grow">
          <strong>${esc(s.name)}</strong> <span class="rarity inline ${s.rarity.cls}">${s.rarity.name}</span>
          <div class="muted small">${HABITATS[s.habitat].icon} ${esc(s.spot)}</div>
        </div>
        <div class="right">
          <strong>${fmtDist(s.dist)}</strong>
          <div class="muted small">${timeAgo(s.ts)}</div>
        </div>
      </li>`).join('') : '<li class="empty">No recent cats in range. Try a wider radius or longer time window.</li>';

    if (!state.map || state.map.fake) return;
    const map = state.map, layer = state.mapLayer;
    layer.clearLayers();
    state.markers = {};
    const c = [state.center.lat, state.center.lng];
    L.circle(c, { radius: state.radiusKm * 1000, color: '#ff7a45', weight: 1.5, fillOpacity: 0.05, dashArray: '6 6' }).addTo(layer);
    L.marker(c, { icon: L.divIcon({ className: '', html: '<div class="me-pin"></div>', iconSize: [18, 18] }), interactive: false }).addTo(layer);

    list.forEach((s) => {
      const fresh = Date.now() - s.ts < 3600000;
      const icon = L.divIcon({
        className: '',
        html: `<div class="cat-pin ${s.rarity.cls} ${fresh ? 'fresh' : ''}">${artHTML(s)}</div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });
      const m = L.marker([s.lat, s.lng], { icon }).addTo(layer);
      m.bindPopup(`
        <div class="pop">
          <strong>${esc(s.name)}</strong> <span class="rarity inline ${s.rarity.cls}">${s.rarity.name}</span><br/>
          <span class="muted small">${esc(s.spot)} · ${timeAgo(s.ts)}</span><br/>
          <button class="pop-btn" data-open="${s.id}">View snap</button>
        </div>`);
      state.markers[s.id] = m;
    });
  }

  function focusOnRadar(id) {
    const s = getSnap(id);
    closeDetail();
    // widen filters so the cat is guaranteed to show
    if (s.dist > state.radiusKm) setRadius(s.dist > 3 ? 10 : 3);
    const ageH = (Date.now() - s.ts) / 3600000;
    if (ageH > state.maxAgeH) setAge(ageH > 24 ? 168 : 24);
    showView('radar');
    setTimeout(() => {
      if (state.map.fake) return;
      state.map.setView([s.lat, s.lng], 16);
      const m = state.markers[id];
      if (m) m.openPopup();
    }, 120);
  }

  function setRadius(r) {
    state.radiusKm = r;
    $$('#radiusSeg button').forEach((b) => b.classList.toggle('active', +b.dataset.r === r));
    if (state.map && !state.map.fake) state.map.setView([state.center.lat, state.center.lng], r <= 1 ? 15 : r <= 3 ? 14 : 12);
    renderRadar();
  }
  function setAge(h) {
    state.maxAgeH = h;
    $$('#ageSeg button').forEach((b) => b.classList.toggle('active', +b.dataset.h === h));
    renderRadar();
  }

  function locate(manual) {
    if (!navigator.geolocation) {
      if (manual) toast('Location not available — using the demo city.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.center = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        state.located = true;
        refreshAll();
        updateSnapLoc();
        if (state.map && !state.map.fake) setRadius(state.radiusKm);
        if (manual) toast('Radar centred on you 📡');
      },
      () => {
        if (manual) toast('Location denied — showing the demo city.');
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
      `<button type="button" data-habitat="${k}" class="${k === state.draft.habitat ? 'active' : ''}">
         <span>${v.icon}</span>${v.label}</button>`).join('');

    $('#ratingGrid').innerHTML = RATING_KEYS.map((k) => `
      <div class="rate" data-key="${k.key}">
        <span>${k.label}</span>
        <div class="paw-input">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-val="${n}" aria-label="${k.label} ${n}">🐾</button>`).join('')}</div>
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
      <span>📷 Tap to add a real photo</span>
      <span class="muted small">Sketch preview from coat &amp; eyes</span>`;
  }

  function updateSnapLoc() {
    $('#snapLoc').textContent = state.located
      ? '📍 Using your current location (blurred ~100 m before posting)'
      : `📍 Location unavailable — the snap will be pinned in ${DEMO_CENTER.label}`;
  }

  function readPhoto(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 640;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        state.draft.photo = canvas.toDataURL('image/jpeg', 0.75);
        $('#photoPreview').innerHTML = `<img src="${state.draft.photo}" alt="Your photo" /><span class="muted small">Tap to change</span>`;
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function submitSnap(e) {
    e.preventDefault();
    const name = $('#catName').value.trim();
    const spot = $('#spot').value.trim();
    if (!name || !spot) return;
    if (!$('#wildConfirm').checked) { toast('Cat Snap is for cats met out in the world only.'); return; }

    const fuzz = () => (Math.random() * 2 - 1) * FUZZ_DEG;
    const snap = {
      id: 'u' + Date.now(),
      name,
      spot,
      coat: $('#coat').value,
      eyes: $('#eyes').value,
      habitat: state.draft.habitat,
      ratings: { ...state.draft.ratings },
      tags: [...state.draft.tags],
      notes: $('#notes').value.trim(),
      photo: state.draft.photo,
      lat: state.center.lat + fuzz(),
      lng: state.center.lng + fuzz(),
      ts: Date.now(),
      user: store.username,
      likes: 0,
      sightings: 1,
      comments: [],
    };
    store.userSnaps.unshift(snap);
    saveStore();
    refreshAll();

    // reset form
    $('#snapForm').reset();
    state.draft = { photo: null, habitat: 'street', ratings: {}, tags: new Set() };
    buildSnapForm();

    const s = getSnap(snap.id);
    toast(`Snapped! ${s.rarity.name} find · +${s.rarity.points} pts`);
    showView('feed');
    openDetail(snap.id);
  }

  // ---------- Catdex ----------
  function myPoints() {
    const mine = state.snaps.filter((s) => s.mine);
    const spotted = state.snaps.filter((s) => s.spotted).length;
    return mine.reduce((a, s) => a + s.rarity.points, 0) + spotted * 5;
  }
  function renderPoints() { $('#pointsPill').textContent = `${myPoints()} pts`; }

  function renderDex() {
    const mine = state.snaps.filter((s) => s.mine);
    const spotted = state.snaps.filter((s) => s.spotted);
    const habitats = new Set(mine.map((s) => s.habitat));
    const best = mine.reduce((b, s) => (!b || RARITY.indexOf(s.rarity) > RARITY.indexOf(b.rarity) ? s : b), null);

    $('#dexName').textContent = '@' + store.username;
    $('#dexSub').textContent = rankFor(myPoints());
    $('#dexStats').innerHTML = `
      <div><strong>${mine.length}</strong><span>Snaps</span></div>
      <div><strong>${spotted.length}</strong><span>Co-sightings</span></div>
      <div><strong>${habitats.size}/5</strong><span>Habitats</span></div>
      <div><strong>${myPoints()}</strong><span>Points</span></div>`;

    const badges = [
      { icon: '📸', name: 'First Snap', got: mine.length >= 1 },
      { icon: '🌲', name: 'Trail Blazer', got: habitats.has('wild') },
      { icon: '🏛️', name: 'Culture Cat', got: habitats.has('attraction') },
      { icon: '⚓', name: 'Salty Paws', got: habitats.has('harbour') },
      { icon: '🗺️', name: 'Globetrotter', got: habitats.size >= 5 },
      { icon: '👑', name: 'Legend Hunter', got: best && best.rarity.name === 'Legendary' },
      { icon: '🤝', name: 'Witness', got: spotted.length >= 3 },
      { icon: '📚', name: 'Collector', got: mine.length >= 10 },
    ];
    $('#dexBadges').innerHTML = badges.map((b) =>
      `<div class="badge ${b.got ? 'got' : ''}" title="${b.name}"><span>${b.icon}</span>${b.name}</div>`).join('');

    $('#dexGrid').innerHTML = mine.length ? mine.map((s) => `
      <button class="dex-item" data-open="${s.id}">
        ${artHTML(s)}
        <span class="rarity inline ${s.rarity.cls}">${s.rarity.name}</span>
        <strong>${esc(s.name)}</strong>
      </button>`).join('') :
      '<p class="empty">Your Catdex is empty. Head outside and snap your first cat! 🐈</p>';
  }

  function rankFor(p) {
    if (p >= 500) return 'Legendary Cat Whisperer';
    if (p >= 200) return 'Seasoned Tracker';
    if (p >= 50) return 'Alley Explorer';
    return 'Rookie Spotter';
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

    $('#habitatFilter').innerHTML = `<button class="chip active" data-h="">All</button>` +
      Object.entries(HABITATS).map(([k, v]) => `<button class="chip" data-h="${k}">${v.icon} ${v.label}</button>`).join('');
    $('#habitatFilter').addEventListener('click', (e) => {
      const b = e.target.closest('[data-h]');
      if (!b) return;
      state.habitatFilter = b.dataset.h || null;
      $$('#habitatFilter .chip').forEach((c) => c.classList.toggle('active', c === b));
      renderFeed();
    });

    // Global delegated clicks (feed cards, sheet, radar list, map popups, dex)
    document.addEventListener('click', (e) => {
      const like = e.target.closest('[data-like]');
      if (like) { e.stopPropagation(); toggleLike(like.dataset.like); return; }
      const spot = e.target.closest('[data-spot]');
      if (spot) {
        const ix = interact(spot.dataset.spot);
        ix.spotted = !ix.spotted;
        saveStore(); refreshAll(); openDetail(spot.dataset.spot);
        if (ix.spotted) toast('Sighting logged · +5 pts');
        return;
      }
      const loc = e.target.closest('[data-locate]');
      if (loc) { focusOnRadar(loc.dataset.locate); return; }
      const open = e.target.closest('[data-open]');
      if (open) { openDetail(open.dataset.open); return; }
      const card = e.target.closest('.card');
      if (card) { openDetail(card.dataset.id); return; }
      if (e.target.closest('.sheet-close') || e.target.id === 'sheetBackdrop') closeDetail();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDetail(); });

    document.addEventListener('submit', (e) => {
      const f = e.target.closest('[data-comment]');
      if (!f) return;
      e.preventDefault();
      const text = f.elements.text.value.trim();
      if (!text) return;
      const ix = interact(f.dataset.comment);
      (ix.comments = ix.comments || []).push({ user: store.username, text });
      saveStore(); refreshAll(); openDetail(f.dataset.comment);
    });

    // Radar controls
    $('#radiusSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (b) setRadius(+b.dataset.r); });
    $('#ageSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-h]'); if (b) setAge(+b.dataset.h); });
    $('#locateBtn').addEventListener('click', () => locate(true));

    // Snap form
    $('#photoInput').addEventListener('change', (e) => { if (e.target.files[0]) readPhoto(e.target.files[0]); });
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
      const t = b.dataset.tag, tags = state.draft.tags;
      tags.has(t) ? tags.delete(t) : tags.add(t);
      b.classList.toggle('active', tags.has(t));
    });
    $('#snapForm').addEventListener('submit', submitSnap);

    $('#resetBtn').addEventListener('click', () => {
      if (!confirm('Clear your snaps, likes and comments from this browser?')) return;
      store.userSnaps = []; store.interactions = {};
      saveStore(); refreshAll(); toast('Prototype data reset');
    });
  }

  // ---------- Boot ----------
  bind();
  buildSnapForm();
  refreshAll();
  updateSnapLoc();
  locate(false);
})();
