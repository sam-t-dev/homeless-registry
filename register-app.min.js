/* Register page: country → city → anti-dupe → situation form (localStorage) */
(function () {
  'use strict';
  /* Future server-side save hook (do not invent a fake backend).
   * Another conversation may add a real POST soon. Keep localStorage as offline cache.
   * If window.REGISTRY_SAVE_HOOK is a function, call it after a successful local save:
   *   window.REGISTRY_SAVE_HOOK({ action: 'create'|'update', record, records })
   * Leave unset until a real endpoint exists.
   */
  if (typeof window.REGISTRY_SAVE_HOOK === 'undefined') {
    window.REGISTRY_SAVE_HOOK = null; // placeholder — wire a real POST here later
  }

  const S = window.RegistryShared;
  if (!S || !S.FALLBACK) {
    console.error('RegistryShared missing — cannot init register app');
    return;
  }
  // Soft-fallback if shared-custom-countries.js failed to load
  if (typeof S.mergeCountries !== 'function') {
    S.mergeCountries = (base) => Array.isArray(base) ? base.slice() : (S.FALLBACK.countries || []).slice();
  }
  if (typeof S.countryHasCoords !== 'function') {
    S.countryHasCoords = (c) => !!(c && Number.isFinite(Number(c[2])) && Number.isFinite(Number(c[3])));
  }
  if (typeof S.ensureCustomCountry !== 'function') {
    S.ensureCustomCountry = (country, list) => {
      const code = String((country && (country.code || country[0])) || '').toUpperCase().slice(0, 8);
      const name = String((country && (country.name || country[1])) || code).trim();
      const tuple = [code, name, NaN, NaN, NaN, NaN, NaN, NaN];
      if (Array.isArray(list) && code && !list.some((c) => c[0] === code)) list.push(tuple);
      return tuple;
    };
  }
  const $ = (id) => document.getElementById(id);

  let locationData = {
    countries: S.mergeCountries(S.FALLBACK.countries),
    cities: Object.assign({}, S.FALLBACK.cities)
  };
  let records = S.loadLocalRecords();
  let publishedIds = new Set();
  let markers = [];
  let map;
  let mapReady = false;

  let officialForms = { forms: {} };

  async function refreshRecords() {
    try {
      if (typeof S.loadAllRecords === 'function') {
        const all = await S.loadAllRecords();
        records = Array.isArray(all) ? all : S.loadLocalRecords();
      } else {
        records = S.loadLocalRecords();
      }
    } catch (e) {
      records = S.loadLocalRecords();
    }
    const local = S.loadLocalRecords();
    const localIds = new Set(local.map((r) => r && r.id).filter(Boolean));
    publishedIds = new Set(
      records.filter((r) => r && r.id && !localIds.has(r.id)).map((r) => r.id)
    );
    return records;
  }

  function isLocalRecord(id) {
    return S.loadLocalRecords().some((r) => r && r.id === id);
  }

  const LAST_PLACE_KEY = 'hr-last-place';

  function persistLocalRecords(list) {
    try {
      S.saveLocalRecords(list);
      return true;
    } catch (err) {
      console.warn('localStorage save failed', err && err.message ? err.message : err);
      return false;
    }
  }

  function saveLastPlace(countryCode, city) {
    try {
      localStorage.setItem(LAST_PLACE_KEY, JSON.stringify({
        countryCode: String(countryCode || ''),
        city: String(city || ''),
        savedAt: new Date().toISOString()
      }));
    } catch (e) { /* ignore quota / private mode */ }
  }

  function loadLastPlace() {
    try {
      const raw = JSON.parse(localStorage.getItem(LAST_PLACE_KEY) || 'null');
      if (!raw || typeof raw !== 'object') return null;
      const countryCode = String(raw.countryCode || '').trim();
      const city = String(raw.city || '').trim();
      if (!countryCode) return null;
      return { countryCode, city };
    } catch (e) { return null; }
  }

  async function renderMySubmissions() {
    const panel = $('mySubmissions');
    const list = $('mySubmissionsList');
    if (!panel || !list) return;
    await refreshRecords();
    const all = Array.isArray(records) ? records.slice() : [];
    if (!all.length) {
      panel.hidden = true;
      list.innerHTML = '';
      return;
    }
    panel.hidden = false;
    const sorted = all.slice().sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
    list.innerHTML = sorted.map((r) => {
      const place = [r.city, r.country].filter(Boolean).join(', ');
      const local = isLocalRecord(r.id);
      const where = local ? 'this browser' : 'published';
      const detail = `${S.label(r.category)} · ${S.label(r.duration)} · ${where}`;
      return `<div class="submission-item">` +
        `<div><strong>${S.esc(place || 'Unknown place')}</strong>` +
        `<div class="submission-meta">${S.esc(detail)}</div></div>` +
        `<button type="button" data-jump="${S.esc(r.id)}">Open</button></div>`;
    }).join('');
    list.querySelectorAll('[data-jump]').forEach((btn) => {
      btn.onclick = () => jumpToSubmission(btn.dataset.jump);
    });
  }

  function jumpToSubmission(id) {
    const r = records.find((x) => x.id === id) || S.loadLocalRecords().find((x) => x.id === id);
    if (!r) return;
    const code = r.countryCode;
    if (code && ![...countrySelect.options].some((o) => o.value === code)) {
      S.ensureCustomCountry({ code, name: r.country || code }, locationData.countries);
      if (!locationData.cities[code]) locationData.cities[code] = [];
      renderCountries(code);
    } else if (code) {
      countrySelect.value = code;
    }
    showCountry();
    if (r.city) {
      cityInput.value = r.city;
      showCity();
    }
    editRecord(r.id);
  }

  function restoreLastPlace() {
    renderMySubmissions();
    const last = loadLastPlace();
    if (!last) return;
    const code = last.countryCode;
    if (!code || code === '__other__') return;
    if (![...countrySelect.options].some((o) => o.value === code)) {
      const rec = records.find((r) => r.countryCode === code);
      const name = (rec && rec.country) || code;
      S.ensureCustomCountry({ code, name }, locationData.countries);
      if (!locationData.cities[code]) locationData.cities[code] = [];
      renderCountries(code);
    } else {
      countrySelect.value = code;
    }
    showCountry();
    if (last.city) {
      cityInput.value = last.city;
      showCity();
    }
  }

  function officialKey(code, city) {
    if (!code) return null;
    const c = String(city || '').trim();
    if (c) {
      const exact = code + ':' + c;
      const forms = officialForms.forms || {};
      if (forms[exact]) return exact;
      const lower = c.toLowerCase();
      for (const k of Object.keys(forms)) {
        if (!k.startsWith(code + ':')) continue;
        if (k.slice(code.length + 1).toLowerCase() === lower) return k;
      }
    }
    return code;
  }

  function renderOfficialForm() {
    const panel = $('officialFormPanel');
    if (!panel) return;
    const code = countrySelect.value;
    if (!code) {
      panel.hidden = true;
      return;
    }
    const cityVal = cityInput.value;
    const key = officialKey(code, cityVal);
    let entry = (officialForms.forms || {})[key] || (officialForms.forms || {})[code];
    if (!entry) {
      const country = selectedCountry();
      const oecd = (officialForms.meta && officialForms.meta.oecdUrl) ||
        'https://webfs.oecd.org/Els-com/Affordable_Housing_Database/HC3-1-Population-experiencing-homelessness.pdf';
      entry = {
        title: ((country && country[1]) || code) + ' — official estimate (OECD HC3.1)',
        description: 'No widely published public street-interview form was located for this country. Showing the OECD HC3.1 methodology note used for national estimates on this site.',
        url: oecd,
        urlLabel: 'OECD HC3.1 PDF',
        cues: [
          'OECD HC3.1 / QuASH national estimate',
          'Local definition may differ from ETHOS Light peers',
          'Often admin count or census derivation, not a public interview form',
          'See OECD HC3.1 methodology note for coverage'
        ],
        gap: true,
        collectionFormUrl: oecd,
        collectionFormLabel: 'OECD HC3.1 PDF',
        alreadyCountedBlurb: 'Have I already been counted? This is the form / methodology for the city/place you selected. If you already completed that place’s official count instrument, you were counted in its official statistics.'
      };
    }
    panel.hidden = false;

    const country = selectedCountry();
    const placeName = (cityVal && cityVal.trim())
      ? (cityVal.trim() + (country ? ', ' + country[1] : ''))
      : ((country && country[1]) || code);
    const blurb = entry.alreadyCountedBlurb ||
      ('Have I already been counted? This is the form for the city/place you selected (' + placeName + ').');
    const q = $('alreadyCountedQ');
    if (q) q.textContent = 'Have I already been counted?';
    const blurbEl = $('alreadyCountedBlurb');
    if (blurbEl) {
      blurbEl.textContent = blurb + ' This is the form for the city/place you selected: ' + placeName + '.';
    }
    const linkWrap = $('alreadyCountedLink');
    const formUrl = entry.collectionFormUrl || entry.sampleFormUrl || entry.url;
    const formLabel = entry.collectionFormLabel || entry.sampleFormLabel || entry.urlLabel || 'Official collection form / methodology';
    if (linkWrap) {
      if (formUrl) {
        linkWrap.innerHTML =
          `<a href="${S.esc(formUrl)}" target="_blank" rel="noopener noreferrer">${S.esc(formLabel)}</a>` +
          `<span class="place-label">Official collection form / methodology for ${S.esc(placeName)}</span>`;
      } else {
        linkWrap.innerHTML = '<span class="muted">No public collection-form link found for this place.</span>';
      }
    }

    $('officialFormTitle').textContent = entry.title || '';
    $('officialFormDesc').textContent = entry.description || '';
    const cues = Array.isArray(entry.cues) ? entry.cues.slice(0, 4) : [];
    $('officialFormCues').innerHTML = cues.map((t) => `<li>${S.esc(t)}</li>`).join('');
    const links = [];
    if (entry.url) {
      links.push(`<a href="${S.esc(entry.url)}" target="_blank" rel="noopener noreferrer">${S.esc(entry.urlLabel || 'Official form / methodology')}</a>`);
    }
    if (entry.sampleFormUrl) {
      links.push(`<a href="${S.esc(entry.sampleFormUrl)}" target="_blank" rel="noopener noreferrer">${S.esc(entry.sampleFormLabel || 'Sample form')}</a>`);
    }
    if (entry.relatedUrl) {
      links.push(`<a href="${S.esc(entry.relatedUrl)}" target="_blank" rel="noopener noreferrer">${S.esc(entry.relatedLabel || 'Related')}</a>`);
    }
    if (entry.year) {
      links.push(`<span class="muted">Year: ${S.esc(String(entry.year))}</span>`);
    }
    $('officialFormLinks').innerHTML = links.join('<span class="sep">·</span>');
    const gap = $('officialFormGap');
    if (entry.gap) {
      gap.hidden = false;
      gap.textContent = 'No public street-interview form was found for this place — showing the best official methodology / stats source instead.';
    } else {
      gap.hidden = true;
      gap.textContent = '';
    }
  }

  async function loadOfficialForms() {
    try {
      const res = await fetch('data/official-forms.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('unavailable');
      const d = await res.json();
      if (d && d.forms) officialForms = d;
    } catch (e) { /* optional panel */ }
    renderOfficialForm();
  }

  const countrySelect = $('countrySelect');
  const cityInput = $('cityInput');

  function selectedCountry() {
    return locationData.countries.find((c) => c[0] === countrySelect.value);
  }
  function ensureFallbackCities() {
    const fb = (S.FALLBACK && S.FALLBACK.cities) || {};
    if (!locationData.cities) locationData.cities = {};
    Object.keys(fb).forEach((code) => {
      if (!locationData.cities[code] || !locationData.cities[code].length) {
        locationData.cities[code] = fb[code].slice();
      }
    });
  }
  function citiesFor(code) {
    ensureFallbackCities();
    return S.citiesFor(code, locationData);
  }
  function findCity(name, code = countrySelect.value) {
    return citiesFor(code).find((c) => c.name.toLowerCase() === String(name).trim().toLowerCase());
  }

  function clearMarkers() { markers.forEach((m) => m.remove()); markers = []; }

  function renderCountries(selected) {
    const keep = selected != null ? selected : countrySelect.value;
    const sorted = [...locationData.countries].sort((a, b) => a[1].localeCompare(b[1]));
    countrySelect.innerHTML = '<option value="">Choose a country…</option>' +
      sorted.map((c) => `<option value="${S.esc(c[0])}">${S.esc(c[1])}</option>`).join('') +
      '<option value="__other__">Other country…</option>';
    if (keep && [...countrySelect.options].some((o) => o.value === keep)) {
      countrySelect.value = keep;
    }
    toggleOtherCountryFields();
  }

  function toggleOtherCountryFields() {
    const panel = $('otherCountryFields');
    if (!panel) return;
    const other = countrySelect.value === '__other__';
    panel.hidden = !other;
    const nameEl = $('otherCountryName');
    const codeEl = $('otherCountryCode');
    if (nameEl) nameEl.required = other;
    if (!other) {
      if (nameEl) nameEl.value = '';
      if (codeEl) codeEl.value = '';
    }
  }

  function slugCodeFromName(name) {
    const letters = String(name || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (letters.length >= 2) return letters.slice(0, 3);
    return ('X' + Date.now().toString(36)).toUpperCase().slice(0, 6);
  }

  /** Resolve the active country tuple, creating a custom one when Other is chosen. */
  function resolveCountryForSave() {
    if (countrySelect.value === '__other__') {
      const name = ($('otherCountryName') && $('otherCountryName').value.trim()) || '';
      let code = ($('otherCountryCode') && $('otherCountryCode').value.trim().toUpperCase()) || '';
      if (!name) return null;
      if (!code) code = slugCodeFromName(name);
      if (code === '__OTHER__') code = slugCodeFromName(name);
      // Avoid colliding with an existing code silently — reuse that entry's name if present
      const existing = locationData.countries.find((c) => c[0] === code);
      if (existing) return existing;
      const tuple = S.ensureCustomCountry({ code, name }, locationData.countries);
      if (!locationData.cities[code]) locationData.cities[code] = [];
      renderCountries(code);
      return tuple;
    }
    return selectedCountry();
  }

  function renderCities() {
    const code = countrySelect.value;
    ensureFallbackCities();
    const cities = citiesFor(code);
    const list = $('cityOptions');
    if (list) {
      list.innerHTML = cities.map((c) => `<option value="${S.esc(c.name)}"></option>`).join('');
    }
    cityInput.placeholder = code
      ? (cities.length ? 'Choose or type a city…' : 'Type a city or area…')
      : 'Choose a country first';
    cityInput.value = '';
  }

  function showCountry() {
    toggleOtherCountryFields();
    if (countrySelect.value === '__other__') {
      clearMarkers();
      renderCities();
      $('stats').hidden = true;
      $('existing').hidden = true;
      $('formSection').hidden = true;
      renderOfficialForm();
      return;
    }
    const c = selectedCountry();
    if (!c) return;
    renderCities();
    clearMarkers();
    const cities = citiesFor(c[0]);
    if (mapReady) {
      cities.forEach((city) => {
        if (!Number.isFinite(city.lat) || !Number.isFinite(city.lon)) return;
        const popup = new maplibregl.Popup({ offset: 25 }).setHTML(
          `<strong>${S.esc(city.name)}</strong><br><button type="button" data-city="${S.esc(city.name)}">Use this city</button>`
        );
        popup.on('open', () => {
          const button = popup.getElement()?.querySelector('[data-city]');
          if (button) button.onclick = () => { cityInput.value = city.name; showCity(); popup.remove(); };
        });
        const marker = new maplibregl.Marker({ color: '#147d7e' })
          .setLngLat([city.lon, city.lat])
          .setPopup(popup)
          .addTo(map);
        marker.getElement().addEventListener('click', () => { cityInput.value = city.name; showCity(); });
        markers.push(marker);
      });
      const bounds = [c[5], c[4], c[7], c[6]];
      if (bounds.every(Number.isFinite)) {
        map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: 25, maxZoom: 8, duration: 700 });
      } else if (S.countryHasCoords(c)) {
        map.flyTo({ center: [c[3], c[2]], zoom: 3, duration: 700 });
      }
      // No coords: keep current map view; country still usable in picker/stats sidebar
    }
    showPlace();
    renderOfficialForm();
  }

  function showCity() {
    const city = findCity(cityInput.value);
    if (city && mapReady) map.flyTo({ center: [city.lon, city.lat], zoom: 11, duration: 700 });
    showPlace();
    renderOfficialForm();
  }

  function scopeRecords() {
    const code = countrySelect.value;
    const city = cityInput.value.trim().toLowerCase();
    const country = selectedCountry();
    return records.filter((r) =>
      (r.countryCode === code || r.country === (country && country[1])) &&
      (!city || String(r.city).toLowerCase() === city)
    );
  }

  async function renderScope() {
    const code = countrySelect.value;
    const city = cityInput.value.trim();
    await refreshRecords();
    const scoped = scopeRecords();
    if (!code) {
      $('stats').hidden = true;
      $('existing').hidden = true;
      $('formSection').hidden = true;
      return;
    }
    $('stats').hidden = false;
    $('existing').hidden = false;
    $('formSection').hidden = false;
    const country = selectedCountry();
    $('placeTitle').textContent = (city || country[1]) + (city ? `, ${country[1]}` : '');
    $('placeTotal').textContent = scoped.length;
    $('placeTypes').textContent = new Set(scoped.map((r) => r.category)).size;
    $('placeBreakdown').textContent = scoped.length
      ? Object.entries(scoped.reduce((a, r) => (a[r.category] = (a[r.category] || 0) + 1, a), {}))
          .map(([k, v]) => `${S.label(k)}: ${v}`).join(' · ')
      : 'No registry records for this place yet.';
    $('existingList').innerHTML = scoped.length
      ? scoped.map((r) => {
          const local = isLocalRecord(r.id);
          const badge = local ? '' : ' <span class="muted">(published)</span>';
          const btn = local
            ? `<button type="button" data-edit="${S.esc(r.id)}">Update</button>`
            : '';
          return `<div class="existing-item"><span>${S.esc(S.label(r.category))} · ${S.esc(S.label(r.duration))}${badge}</span>${btn}</div>`;
        }).join('')
      : '<p class="muted">No existing record here. The first save will create one.</p>';
    $('existingList').querySelectorAll('[data-edit]').forEach((b) => {
      b.onclick = () => editRecord(b.dataset.edit);
    });
  }

  function showPlace() { renderScope(); }

  function resetForm() {
    $('recordId').value = '';
    $('category').value = '';
    $('duration').value = '';
    document.querySelectorAll('input[name="need"]').forEach((x) => { x.checked = false; });
    $('formTitle').textContent = 'Register a situation';
    $('saveButton').textContent = 'Save anonymously';
    $('cancelButton').hidden = true;
  }

  function editRecord(id) {
    if (!isLocalRecord(id)) {
      $('message').textContent = 'That record is published-only in this browser — submit a new entry or open a local copy to update.';
      return;
    }
    const r = records.find((x) => x.id === id) || S.loadLocalRecords().find((x) => x.id === id);
    if (!r) return;
    $('recordId').value = r.id;
    $('category').value = r.category;
    $('duration').value = r.duration;
    document.querySelectorAll('input[name="need"]').forEach((x) => {
      x.checked = (r.needs || []).includes(x.value);
    });
    $('formTitle').textContent = 'Update this situation';
    $('saveButton').textContent = 'Update anonymously';
    $('cancelButton').hidden = false;
    $('formSection').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function postToFormspree(record) {
    const endpoint = window.FORMSPREE_ENDPOINT;
    if (!endpoint) throw new Error('Formspree endpoint not configured');
    const body = {
      _subject: 'Homeless registry submission',
      source: 'homeless-registry',
      country: record.country,
      countryCode: record.countryCode || '',
      city: record.city,
      category: record.category,
      duration: record.duration,
      needs: Array.isArray(record.needs) ? record.needs : (record.needs ? [record.needs] : []),
      recordId: record.id,
      token: record.id,
      updatedAt: record.timestamp || new Date().toISOString()
    };
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      let detail = '';
      try { detail = await res.text(); } catch (e) { /* ignore */ }
      throw new Error('Formspree HTTP ' + res.status + (detail ? ': ' + detail.slice(0, 120) : ''));
    }
    return res.json().catch(() => ({}));
  }

  async function save(e) {
    e.preventDefault();
    const country = resolveCountryForSave();
    const city = cityInput.value.trim();
    const category = $('category').value;
    const duration = $('duration').value;
    if (!country || !city || !category || !duration) {
      $('message').textContent = countrySelect.value === '__other__'
        ? 'Enter the country name, city, situation, and duration.'
        : 'Choose a country, city, situation, and duration.';
      return;
    }
    // Persist free-text city under this country for future picks (no invented coords)
    const code = country[0];
    if (!locationData.cities[code]) locationData.cities[code] = [];
    const cityExists = locationData.cities[code].some(
      (c) => String(c[0]).toLowerCase() === city.toLowerCase()
    );
    if (!cityExists) locationData.cities[code].push([city, NaN, NaN]);
    // If this country is not in FALLBACK, keep it in hr-custom-countries
    if (!S.FALLBACK.countries.some((c) => c[0] === code)) {
      S.ensureCustomCountry(country, locationData.countries);
    }
    const needs = [...document.querySelectorAll('input[name="need"]:checked')].map((x) => x.value);
    const existingId = $('recordId').value;
    const data = {
      countryCode: country[0],
      country: country[1],
      city,
      category,
      duration,
      needs,
      timestamp: new Date().toISOString()
    };
    // Mutate localStorage list only (never write published-only rows into local cache)
    let localRecords = S.loadLocalRecords();
    let record;
    if (existingId) {
      const i = localRecords.findIndex((r) => r.id === existingId);
      if (i >= 0) localRecords[i] = { ...localRecords[i], ...data };
      else localRecords.push({ id: existingId, ...data });
      record = localRecords.find((r) => r.id === existingId);
    } else {
      record = { id: S.token(), ...data };
      localRecords.push(record);
    }
    // Offline cache first (backup) — commit localStorage before any network call
    const localOk = persistLocalRecords(localRecords);
    records = localRecords;
    saveLastPlace(code, city);
    renderMySubmissions();

    const btn = $('saveButton');
    const prevLabel = btn.textContent;
    btn.disabled = true;
    const placeLabel = city + ', ' + country[1];
    $('message').textContent = localOk
      ? ('Saving ' + placeLabel + '…')
      : ('Browser storage blocked — still trying server for ' + placeLabel + '…');

    try {
      // Primary: REGISTRY_SAVE_HOOK → Cloudflare Worker → GitHub data/records.json (no Formspree)
      let hookResult = null;
      if (typeof window.REGISTRY_SAVE_HOOK === 'function') {
        hookResult = await window.REGISTRY_SAVE_HOOK({ action: existingId ? 'update' : 'create', record, records: records.slice() });
      } else {
        throw new Error('Registry save not configured. Deploy workers/registry-ingest and set REGISTRY_API_URL in registry-api-config.js.');
      }
      // Re-assert local copy after network (in case another tab mutated storage)
      persistLocalRecords(localRecords);
      saveLastPlace(code, city);
      const verb = existingId ? 'Updated' : 'Saved';
      let msg;
      if (hookResult && (hookResult.githubOk || hookResult.ok)) {
        msg = verb + ' ' + placeLabel + '. Saved to public GitHub registry; local copy kept — hard-refresh to see shared counts.';
      } else {
        msg = verb + ' ' + placeLabel + '. Saved locally; public GitHub sync did not confirm — retry later.';
      }
      $('message').textContent = msg;
      resetForm();
      await renderScope();
      await renderMySubmissions();
    } catch (err) {
      $('message').textContent = localOk
        ? ('Server save failed for ' + placeLabel + '. Your entry is kept in this browser — it will stay after refresh. Try again later.')
        : ('Save failed for ' + placeLabel + ' (server error and browser storage unavailable).');
      console.warn('registry save failed', err && err.message ? err.message : err);
      await renderMySubmissions();
    } finally {
      btn.disabled = false;
      btn.textContent = prevLabel;
    }
  }

  function numberOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function normalizeCountry(raw, cities) {
    const code = String(raw.code ?? raw[0] ?? '').toUpperCase();
    const known = S.FALLBACK.countries.find((c) => c[0] === code);
    const list = cities[code] || [];
    const coords = list.filter((c) => Number.isFinite(Number(c[1])) && Number.isFinite(Number(c[2])));
    const derived = coords.length
      ? [
          Math.min(...coords.map((c) => Number(c[1]))) - 2,
          Math.min(...coords.map((c) => Number(c[2]))) - 2,
          Math.max(...coords.map((c) => Number(c[1]))) + 2,
          Math.max(...coords.map((c) => Number(c[2]))) + 2
        ]
      : null;
    const rawBounds = [raw.south ?? raw[4], raw.west ?? raw[5], raw.north ?? raw[6], raw.east ?? raw[7]].map(Number);
    const fallbackBounds = known ? known.slice(4, 8) : null;
    const bounds = rawBounds.every(Number.isFinite) && rawBounds.some((n) => n !== 0)
      ? rawBounds
      : (fallbackBounds || derived || [-60, -180, 75, 180]);
    const centerLat = numberOr(raw.lat ?? raw.latitude ?? raw[2], known?.[2] ?? ((bounds[0] + bounds[2]) / 2));
    const centerLon = numberOr(raw.lon ?? raw.lng ?? raw.longitude ?? raw[3], known?.[3] ?? ((bounds[1] + bounds[3]) / 2));
    return [code, String(raw.name ?? raw[1] ?? known?.[1] ?? code), centerLat, centerLon, ...bounds];
  }

  async function loadData() {
    try {
      const res = await fetch('data/cities-by-country.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('unavailable');
      const d = await res.json();
      if (d.countries && d.cities) {
        const cities = Object.fromEntries(
          Object.entries(d.cities).map(([k, v]) => [k, v.map((x) => [x[0], Number(x[1]), Number(x[2])])])
        );
        locationData = {
          countries: S.mergeCountries(d.countries.map((c) => normalizeCountry(c, cities))),
          cities
        };
      }
    } catch (e) { /* FALLBACK — keep in-memory countries/cities */ }
    // Always merge persisted custom countries (even when FALLBACK-only)
    try {
      locationData.countries = S.mergeCountries(locationData.countries);
    } catch (e) { /* keep current list */ }
    // JSON 404 must never wipe FALLBACK city lists used by #cityOptions
    ensureFallbackCities();
    renderCountries();
    if (countrySelect.value) renderCities();
    // Re-select last saved place so submissions don't look "gone" after refresh
    restoreLastPlace();
  }

  // Guard map init: createMap/maplibre failure must NOT block country picker
  try {
    if (typeof maplibregl === 'undefined') throw new Error('maplibregl not loaded');
    map = S.createMap('map');
    if (map && typeof map.on === 'function') {
      map.on('load', () => { mapReady = true; if (countrySelect.value) showCountry(); });
    }
  } catch (err) {
    console.warn('Map init failed; country picker still available', err);
    map = null;
    mapReady = false;
  }

  countrySelect.addEventListener('change', showCountry);
  cityInput.addEventListener('change', showCity);
  cityInput.addEventListener('input', () => { if (findCity(cityInput.value)) showCity(); });
  $('registryForm').addEventListener('submit', save);
  $('cancelButton').addEventListener('click', resetForm);

  renderCountries();
  refreshRecords().then(() => renderMySubmissions()).catch(() => renderMySubmissions());
  loadData();
  loadOfficialForms();
})();
