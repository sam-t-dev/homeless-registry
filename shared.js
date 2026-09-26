/* Shared map helpers, FALLBACK geo, localStorage records API */
(function (global) {
  'use strict';

  const FALLBACK = {
    countries: [
      ['AU','Australia',-25,134,-44,112,-10,154],
      ['NZ','New Zealand',-41,174,-48,166,-34,179],
      ['US','United States',38,-97,24,-125,50,-66],
      ['CA','Canada',57,-106,42,-141,70,-52],
      ['GB','United Kingdom',54,-3,49,-8,59,2],
      ['FR','France',46,2,42,-5,51,8],
      ['DE','Germany',51,10,47,5,55,15],
      ['IN','India',22,79,8,68,35,90],
      ['JP','Japan',36,138,31,129,46,146],
      ['BR','Brazil',-10,-52,-34,-74,5,-34],
      ['ZA','South Africa',-30,24,-35,16,-22,33],
      ['KE','Kenya',0,38,-5,34,5,42],
      ['NG','Nigeria',9,8,4,3,15,15],
      ['MX','Mexico',23,-102,14,-118,33,-86],
      ['AR','Argentina',-34,-64,-55,-73,-21,-53],
      ['CL','Chile',-33,-71,-56,-76,-17,-66],
      ['CN','China',35,104,18,74,54,135],
      ['ID','Indonesia',-3,117,-11,95,6,141],
      ['PH','Philippines',12,122,5,117,21,127],
      ['SG','Singapore',1,104,1,103,2,104],
      ['BE','Belgium',50.5,4.5,49.5,2.5,51.5,6.4],
      ['NL','Netherlands',52.1,5.3,50.7,3.3,53.6,7.2],
      ['IE','Ireland',53.4,-8,51.4,-10.5,55.4,-6],
      ['ES','Spain',40.2,-3.7,35.9,-9.3,43.8,4.3],
      ['IT','Italy',42.5,12.5,36.6,6.6,47.1,18.5],
      ['SE','Sweden',62,15,55.3,11,69.1,24.2],
      ['NO','Norway',64,10,57.9,4.5,71.2,31.1],
      ['FI','Finland',64,26,59.7,20.5,70.1,31.6],
      ['PL','Poland',52.1,19.4,49,14.1,54.9,24.2],
      ['AT','Austria',47.5,14.5,46.3,9.5,49.1,17.2],
      ['PT','Portugal',39.6,-8.2,36.9,-9.6,42.2,-6.2],
      ['CZ','Czechia',49.8,15.5,48.5,12.1,51.1,18.9],
      ['KR','Korea',36.5,127.8,33.1,125.8,38.6,129.6],
      ['TR','Türkiye',39,35,36,26,42.1,45]
    ],
    cities: {
      AU:[['Sydney',-33.87,151.21],['Melbourne',-37.81,144.96],['Brisbane',-27.47,153.03],['Perth',-31.95,115.86],['Adelaide',-34.93,138.60],['Canberra',-35.28,149.13]],
      NZ:[['Auckland',-36.85,174.76],['Wellington',-41.29,174.78],['Christchurch',-43.53,172.63]],
      US:[['New York City',40.71,-74.01],['Los Angeles',34.05,-118.24],['Chicago',41.85,-87.65],['Seattle',47.61,-122.33],['Miami',25.77,-80.19]],
      CA:[['Toronto',43.70,-79.42],['Montréal',45.51,-73.59],['Vancouver',49.25,-123.12],['Ottawa',45.41,-75.70]],
      GB:[['London',51.51,-0.13],['Birmingham',52.48,-1.90],['Manchester',53.48,-2.24],['Glasgow',55.86,-4.26]],
      FR:[['Paris',48.85,2.35],['Marseille',43.30,5.38],['Lyon',45.75,4.85]],
      DE:[['Berlin',52.52,13.41],['Hamburg',53.55,9.99],['Munich',48.14,11.58]],
      IN:[['Mumbai',19.08,72.88],['Delhi',28.65,77.23],['Bengaluru',12.97,77.59],['Kolkata',22.57,88.36]],
      JP:[['Tokyo',35.69,139.69],['Osaka',34.69,135.50],['Kyoto',35.02,135.75]],
      BR:[['São Paulo',-23.55,-46.64],['Rio de Janeiro',-22.91,-43.18],['Brasília',-15.78,-47.93]],
      ZA:[['Cape Town',-33.93,18.42],['Johannesburg',-26.20,28.04],['Durban',-29.86,31.03]],
      KE:[['Nairobi',-1.28,36.82],['Mombasa',-4.05,39.66]],
      NG:[['Lagos',6.45,3.39],['Abuja',9.06,7.50],['Kano',12.00,8.52]],
      MX:[['Mexico City',19.43,-99.13],['Guadalajara',20.67,-103.39],['Monterrey',25.68,-100.32]],
      AR:[['Buenos Aires',-34.61,-58.38],['Córdoba',-31.41,-64.18],['Rosario',-32.95,-60.64]],
      CL:[['Santiago',-33.46,-70.65],['Valparaíso',-33.04,-71.63]],
      CN:[['Shanghai',31.22,121.46],['Beijing',39.91,116.40],['Guangzhou',23.12,113.25]],
      ID:[['Jakarta',-6.21,106.85],['Surabaya',-7.25,112.75],['Bandung',-6.92,107.61]],
      PH:[['Manila',14.60,120.98],['Cebu City',10.32,123.89],['Davao',7.07,125.61]],
      SG:[['Singapore',1.29,103.85]],
      BE:[['Brussels',50.85,4.35],['Antwerp',51.22,4.40],['Ghent',51.05,3.73]],
      NL:[['Amsterdam',52.37,4.90],['Rotterdam',51.92,4.48],['The Hague',52.07,4.30]],
      IE:[['Dublin',53.35,-6.26],['Cork',51.90,-8.47]],
      ES:[['Madrid',40.42,-3.70],['Barcelona',41.39,2.17],['Valencia',39.47,-0.38]],
      IT:[['Rome',41.90,12.50],['Milan',45.46,9.19],['Naples',40.85,14.27]],
      SE:[['Stockholm',59.33,18.07],['Gothenburg',57.71,11.97]],
      NO:[['Oslo',59.91,10.75],['Bergen',60.39,5.32]],
      FI:[['Helsinki',60.17,24.94]],
      PL:[['Warsaw',52.23,21.01],['Kraków',50.06,19.94]],
      AT:[['Vienna',48.21,16.37],['Salzburg',47.81,13.04]],
      PT:[['Lisbon',38.72,-9.14],['Porto',41.15,-8.61]],
      CZ:[['Prague',50.08,14.44]],
      KR:[['Seoul',37.57,126.98],['Busan',35.18,129.08]],
      TR:[['Istanbul',41.01,28.98],['Ankara',39.93,32.86]]
    }
  };

  const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
  const STORAGE_KEY = 'registryRecords';

  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[c]));
  }
  function label(value) { return String(value || '').replaceAll('_', ' '); }
  function token() {
    return 'token-' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2));
  }
  function fmt(n) {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    return Number(n).toLocaleString('en-US');
  }

  function loadLocalRecords() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(stored) ? stored : [];
    } catch (e) { return []; }
  }
  function saveLocalRecords(records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  async function loadPublishedRecords() {
    try {
      const res = await fetch('data/records.json', { cache: 'no-store' });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
  }

  async function loadAllRecords() {
    const local = loadLocalRecords();
    const published = await loadPublishedRecords();
    const byId = new Map();
    published.forEach((r) => { if (r && r.id) byId.set(r.id, r); });
    local.forEach((r) => { if (r && r.id) byId.set(r.id, r); });
    return Array.from(byId.values());
  }

  function aggregateRecords(records, { countryCode, countryName, city } = {}) {
    const cityNorm = city ? String(city).trim().toLowerCase() : null;
    const scoped = records.filter((r) => {
      const codeOk = !countryCode || r.countryCode === countryCode || r.country === countryName;
      const cityOk = !cityNorm || String(r.city || '').toLowerCase() === cityNorm;
      return codeOk && cityOk;
    });
    const bySituation = {};
    const byDuration = {};
    const byCity = {};
    scoped.forEach((r) => {
      bySituation[r.category] = (bySituation[r.category] || 0) + 1;
      byDuration[r.duration] = (byDuration[r.duration] || 0) + 1;
      const key = r.city || 'Unknown';
      byCity[key] = (byCity[key] || 0) + 1;
    });
    return { total: scoped.length, bySituation, byDuration, byCity, records: scoped };
  }

  function citiesFor(code, locationData) {
    const data = locationData || { cities: FALLBACK.cities };
    return (data.cities[code] || []).map((c) => ({ name: c[0], lat: Number(c[1]), lon: Number(c[2]) }));
  }

  function createMap(containerId) {
    const map = new maplibregl.Map({
      container: containerId,
      style: MAP_STYLE,
      center: [0, 20],
      zoom: 1.6,
      attributionControl: false
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.AttributionControl({
      customAttribution: '© OpenFreeMap · © OpenStreetMap contributors'
    }));
    const resize = () => map.resize();
    map.on('load', resize);
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 100));
    setTimeout(resize, 0);
    return map;
  }

  function fitCountry(map, country) {
    if (!map || !country) return;
    const b = country.bounds;
    if (Array.isArray(b) && b.length === 4 && b.every(Number.isFinite)) {
      map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 40, maxZoom: 7, duration: 700 });
    } else if (country.center) {
      map.flyTo({ center: country.center, zoom: 3.5, duration: 700 });
    }
  }

  function circleRadius(count) {
    const n = Number(count) || 0;
    if (n <= 0) return 8;
    return Math.max(8, Math.min(48, 6 + Math.sqrt(n) / 8));
  }

  global.RegistryShared = {
    FALLBACK, MAP_STYLE, STORAGE_KEY,
    esc, label, token, fmt,
    loadLocalRecords, saveLocalRecords, loadPublishedRecords, loadAllRecords, aggregateRecords,
    citiesFor, createMap, fitCountry, circleRadius
  };
})(window);
