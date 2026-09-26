/* Minimal map-first registry. Map style: OpenFreeMap, no key. */
const FALLBACK = {
  countries: [
    ['AU','Australia',-25,134,112,-44,154],['NZ','New Zealand',-41,174,-48,167],['US','United States',38,-97,24,-125, -66],['CA','Canada',57,-106,42,-141,-52],['GB','United Kingdom',54,-3,49,-8,2],['FR','France',46,2,42,-5,8],['DE','Germany',51,10,47,5,15],['IN','India',22,79,8,68,90],['JP','Japan',36,138,31,129,146],['BR','Brazil',-10,-52,-34,-74,-34],['ZA','South Africa',-30,24,-35,16,-22],['KE','Kenya',0,38,-5,34,42],['NG','Nigeria',9,8,4,3,15],['MX','Mexico',23,-102,14,-118,-86],['AR','Argentina',-34,-64,-55,-73,-53],['CL','Chile',-33,-71,-56,-76,-66],['CN','China',35,104,18,74,135],['ID','Indonesia',-3,117,-11,95,141],['PH','Philippines',12,122,5,117,127],['SG','Singapore',1,104,1,103,104]
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
    KE:[['Nairobi',-1.28,36.82],['Mombasa',-4.05,39.66]], NG:[['Lagos',6.45,3.39],['Abuja',9.06,7.50],['Kano',12.00,8.52]],
    MX:[['Mexico City',19.43,-99.13],['Guadalajara',20.67,-103.39],['Monterrey',25.68,-100.32]],
    AR:[['Buenos Aires',-34.61,-58.38],['Córdoba',-31.41,-64.18],['Rosario',-32.95,-60.64]],
    CL:[['Santiago',-33.46,-70.65],['Valparaíso',-33.04,-71.63]], CN:[['Shanghai',31.22,121.46],['Beijing',39.91,116.40],['Guangzhou',23.12,113.25]],
    ID:[['Jakarta',-6.21,106.85],['Surabaya',-7.25,112.75],['Bandung',-6.92,107.61]], PH:[['Manila',14.60,120.98],['Cebu City',10.32,123.89],['Davao',7.07,125.61]], SG:[['Singapore',1.29,103.85]]
  }
};

let locationData = FALLBACK;
let records = [];
let markers = [];
let map;
const $ = id => document.getElementById(id);
const countrySelect = $('countrySelect'), cityInput = $('cityInput');

function esc(value){ return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function label(value){ return String(value || '').replaceAll('_',' '); }
function token(){ return 'token-' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2)); }
function selectedCountry(){ return locationData.countries.find(c => c[0] === countrySelect.value); }
function citiesFor(code){ return (locationData.cities[code] || []).map(c => ({name:c[0],lat:c[1],lon:c[2]})); }
function findCity(name, code=countrySelect.value){ return citiesFor(code).find(c => c.name.toLowerCase() === String(name).trim().toLowerCase()); }

function initMap(){
  map = L.map('map', {zoomControl:true}).setView([20,0],2);
  L.maplibreGL({style:'https://tiles.openfreemap.org/styles/liberty'}).addTo(map);
  map.attributionControl.addAttribution('© OpenFreeMap · © OpenStreetMap contributors');
}
function renderCountries(){
  const sorted = [...locationData.countries].sort((a,b)=>a[1].localeCompare(b[1]));
  countrySelect.innerHTML = '<option value="">Choose a country…</option>' + sorted.map(c => `<option value="${esc(c[0])}">${esc(c[1])}</option>`).join('');
}
function renderCities(){
  const code = countrySelect.value;
  const cities = citiesFor(code);
  $('cityOptions').innerHTML = cities.map(c => `<option value="${esc(c.name)}">`).join('');
  cityInput.placeholder = code ? 'Choose or type a city…' : 'Choose a country first';
  cityInput.value = '';
}
function clearMarkers(){ markers.forEach(m => map.removeLayer(m)); markers=[]; }
function showCountry(){
  const c = selectedCountry(); if (!c) return;
  renderCities(); clearMarkers();
  const cities = citiesFor(c[0]);
  cities.forEach(city => {
    const marker = L.marker([city.lat,city.lon]).addTo(map).bindPopup(`<strong>${esc(city.name)}</strong><br><button type="button" data-city="${esc(city.name)}">Use this city</button>`);
    marker.on('click', () => { cityInput.value=city.name; showPlace(); });
    marker.on('popupopen', e => { const b=e.popup.getElement().querySelector('button'); if(b) b.onclick=()=>{cityInput.value=city.name; showPlace(); e.popup._close();}; });
    markers.push(marker);
  });
  if(Number.isFinite(c[7])) map.flyToBounds([[c[4],c[5]],[c[6],c[7]]],{padding:[25,25],duration:.7}); else if(cities[0]) map.flyTo([cities[0].lat,cities[0].lon],4); else map.flyTo([c[2],c[3]],3);
  showPlace();
}
function showCity(){
  const city=findCity(cityInput.value);
  if(city) map.flyTo([city.lat,city.lon],11,{duration:.7});
  showPlace();
}
function scopeRecords(){
  const code=countrySelect.value, city=cityInput.value.trim().toLowerCase();
  return records.filter(r => r.countryCode === code && (!city || String(r.city).toLowerCase() === city));
}
function renderScope(){
  const code=countrySelect.value, city=cityInput.value.trim(),scoped=scopeRecords();
  if(!code){ $('stats').hidden=true; $('existing').hidden=true; $('formSection').hidden=true; return; }
  $('stats').hidden=false; $('existing').hidden=false; $('formSection').hidden=false;
  const country=selectedCountry(); $('placeTitle').textContent=(city || country[1]) + (city ? `, ${country[1]}` : '');
  $('placeTotal').textContent=scoped.length;
  $('placeTypes').textContent=new Set(scoped.map(r=>r.category)).size;
  $('placeBreakdown').textContent=scoped.length ? Object.entries(scoped.reduce((a,r)=>(a[r.category]=(a[r.category]||0)+1,a),{})).map(([k,v])=>`${label(k)}: ${v}`).join(' · ') : 'No local records for this place yet.';
  $('existingList').innerHTML=scoped.length ? scoped.map(r=>`<div class="existing-item"><span>${esc(label(r.category))} · ${esc(label(r.duration))}</span><button type="button" data-edit="${esc(r.id)}">Update</button></div>`).join('') : '<p class="muted">No existing local record. The first save will create one.</p>';
  $('existingList').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editRecord(b.dataset.edit));
}
function showPlace(){ renderScope(); }
function resetForm(){ $('recordId').value=''; $('category').value=''; $('duration').value=''; document.querySelectorAll('input[name="need"]').forEach(x=>x.checked=false); $('formTitle').textContent='Register a situation'; $('saveButton').textContent='Save anonymously'; $('cancelButton').hidden=true; }
function editRecord(id){ const r=records.find(x=>x.id===id); if(!r)return; $('recordId').value=r.id; $('category').value=r.category; $('duration').value=r.duration; document.querySelectorAll('input[name="need"]').forEach(x=>x.checked=(r.needs||[]).includes(x.value)); $('formTitle').textContent='Update this situation'; $('saveButton').textContent='Update anonymously'; $('cancelButton').hidden=false; $('formSection').scrollIntoView({behavior:'smooth',block:'nearest'}); }
function save(e){
  e.preventDefault();
  const country=selectedCountry(), city=cityInput.value.trim(), category=$('category').value, duration=$('duration').value;
  if(!country || !city || !category || !duration){ $('message').textContent='Choose a country, city, situation, and duration.'; return; }
  const needs=[...document.querySelectorAll('input[name="need"]:checked')].map(x=>x.value), id=$('recordId').value;
  const data={countryCode:country[0],country:country[1],city,category,duration,needs,timestamp:new Date().toISOString()};
  if(id){ const i=records.findIndex(r=>r.id===id); if(i>=0) records[i]={...records[i],...data}; $('message').textContent='Updated this local record.'; }
  else { const record={id:token(),...data}; records.push(record); $('message').textContent='Saved locally in this browser.'; }
  localStorage.setItem('registryRecords',JSON.stringify(records)); resetForm(); renderScope();
}
async function loadData(){
  try { const res=await fetch('data/cities-by-country.json',{cache:'no-store'}); if(!res.ok)throw Error(); const d=await res.json();
    if(d.countries && d.cities){ locationData={countries:d.countries.map(c=>[c.code,c.name,0,0,0,0,0,0]),cities:Object.fromEntries(Object.entries(d.cities).map(([k,v])=>[k,v.map(x=>[x[0],x[1],x[2]])]))};
      // Keep fallback bounds for reliable country zoom; unknown countries use city extent.
      const bounds={AU:[-44,112,-10,154],US:[24,-125,50,-66],GB:[49,-8,59,2],CA:[42,-141,70,-52],IN:[8,68,35,90],JP:[31,129,46,146],BR:[-34,-74,5,-34],DE:[47,5,55,15],FR:[42,-5,51,8],NZ:[-48,166,-34,179],ZA:[-35,16,-22,33],CN:[18,74,54,135]}; locationData.countries.forEach(c=>{if(bounds[c[0]]){const b=bounds[c[0]];c[4]=b[0];c[5]=b[1];c[6]=b[2];c[7]=b[3];}});
    }
  } catch(e) { /* small embedded fallback keeps the map usable */ }
  renderCountries();
}
countrySelect.addEventListener('change',showCountry); cityInput.addEventListener('change',showCity); cityInput.addEventListener('input',()=>{ if(findCity(cityInput.value)) showCity(); }); $('registryForm').addEventListener('submit',save); $('cancelButton').addEventListener('click',resetForm);
try{records=JSON.parse(localStorage.getItem('registryRecords')||'[]');if(!Array.isArray(records))records=[];}catch(e){records=[];}
initMap(); loadData();
