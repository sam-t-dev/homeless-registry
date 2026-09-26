/* Custom countries extender — loads after shared.js */
(function (global) {
  'use strict';
  const S = global.RegistryShared;
  if (!S) return;
  const FALLBACK = S.FALLBACK;
  const CUSTOM_COUNTRIES_KEY = 'hr-custom-countries';

  function loadCustomCountries() {
    try {
      const stored = JSON.parse(localStorage.getItem(CUSTOM_COUNTRIES_KEY) || '[]');
      if (!Array.isArray(stored)) return [];
      return stored.filter((c) => Array.isArray(c) && c[0] && c[1]).map((c) => {
        const code = String(c[0]).toUpperCase().slice(0, 8);
        const name = String(c[1]).trim() || code;
        const nums = c.slice(2, 8).map((n) => {
          const v = Number(n);
          return Number.isFinite(v) ? v : NaN;
        });
        while (nums.length < 6) nums.push(NaN);
        return [code, name, ...nums];
      });
    } catch (e) { return []; }
  }

  function saveCustomCountries(list) {
    const cleaned = (list || []).filter((c) => Array.isArray(c) && c[0] && c[1]).map((c) => {
      const code = String(c[0]).toUpperCase().slice(0, 8);
      const name = String(c[1]).trim() || code;
      const nums = c.slice(2, 8).map((n) => {
        const v = Number(n);
        return Number.isFinite(v) ? v : null;
      });
      while (nums.length < 6) nums.push(null);
      return [code, name, ...nums];
    });
    localStorage.setItem(CUSTOM_COUNTRIES_KEY, JSON.stringify(cleaned));
    return cleaned;
  }

  function mergeCountries(baseCountries) {
    const base = Array.isArray(baseCountries) ? baseCountries : FALLBACK.countries;
    const byCode = new Map();
    base.forEach((c) => { if (c && c[0]) byCode.set(String(c[0]).toUpperCase(), c); });
    loadCustomCountries().forEach((c) => {
      if (!byCode.has(c[0])) byCode.set(c[0], c);
    });
    return Array.from(byCode.values());
  }

  function ensureCustomCountry(country, countriesList) {
    let code, name, lat, lon, south, west, north, east;
    if (Array.isArray(country)) {
      code = String(country[0] || '').toUpperCase().slice(0, 8);
      name = String(country[1] || code).trim();
      lat = Number(country[2]); lon = Number(country[3]);
      south = Number(country[4]); west = Number(country[5]);
      north = Number(country[6]); east = Number(country[7]);
    } else {
      code = String(country.code || country.countryCode || '').toUpperCase().slice(0, 8);
      name = String(country.name || country.country || code).trim();
      lat = Number(country.lat ?? country.latitude); lon = Number(country.lon ?? country.lng ?? country.longitude);
      south = Number(country.south); west = Number(country.west);
      north = Number(country.north); east = Number(country.east);
    }
    if (!code) throw new Error('Country code required');
    if (!name) name = code;
    const tuple = [
      code, name,
      Number.isFinite(lat) ? lat : NaN,
      Number.isFinite(lon) ? lon : NaN,
      Number.isFinite(south) ? south : NaN,
      Number.isFinite(west) ? west : NaN,
      Number.isFinite(north) ? north : NaN,
      Number.isFinite(east) ? east : NaN
    ];
    const list = Array.isArray(countriesList) ? countriesList : null;
    const inFallback = FALLBACK.countries.some((c) => c[0] === code);
    if (list) {
      const idx = list.findIndex((c) => c[0] === code);
      if (idx < 0) list.push(tuple);
      else {
        const prev = list[idx];
        list[idx] = [
          code, name || prev[1],
          Number.isFinite(tuple[2]) ? tuple[2] : prev[2],
          Number.isFinite(tuple[3]) ? tuple[3] : prev[3],
          Number.isFinite(tuple[4]) ? tuple[4] : prev[4],
          Number.isFinite(tuple[5]) ? tuple[5] : prev[5],
          Number.isFinite(tuple[6]) ? tuple[6] : prev[6],
          Number.isFinite(tuple[7]) ? tuple[7] : prev[7]
        ];
        return list[idx];
      }
    }
    if (!inFallback) {
      const custom = loadCustomCountries();
      const ci = custom.findIndex((c) => c[0] === code);
      if (ci < 0) custom.push(tuple);
      else {
        const prev = custom[ci];
        custom[ci] = [
          code, name || prev[1],
          Number.isFinite(tuple[2]) ? tuple[2] : prev[2],
          Number.isFinite(tuple[3]) ? tuple[3] : prev[3],
          Number.isFinite(tuple[4]) ? tuple[4] : prev[4],
          Number.isFinite(tuple[5]) ? tuple[5] : prev[5],
          Number.isFinite(tuple[6]) ? tuple[6] : prev[6],
          Number.isFinite(tuple[7]) ? tuple[7] : prev[7]
        ];
      }
      saveCustomCountries(custom);
    }
    return tuple;
  }

  function countryHasCoords(country) {
    if (!country) return false;
    return Number.isFinite(Number(country[2])) && Number.isFinite(Number(country[3]));
  }

  S.CUSTOM_COUNTRIES_KEY = CUSTOM_COUNTRIES_KEY;
  S.loadCustomCountries = loadCustomCountries;
  S.saveCustomCountries = saveCustomCountries;
  S.mergeCountries = mergeCountries;
  S.ensureCustomCountry = ensureCustomCountry;
  S.countryHasCoords = countryHasCoords;
})(window);
