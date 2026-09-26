// Anonymous Homeless Registry - Application Logic

const submissionForm = document.getElementById('submissionForm');
const aggregateView = document.getElementById('aggregateView');
const submissionFormSection = document.querySelector('.submission-form');
const successMessage = document.querySelector('.success-message');
const totalCount = document.getElementById('totalCount');
const byCity = document.getElementById('byCity');
const bySituation = document.getElementById('bySituation');
const cityBreakdown = document.getElementById('cityBreakdown');
const situationBreakdown = document.getElementById('situationBreakdown');
const durationBreakdown = document.getElementById('durationBreakdown');
const countryFilter = document.getElementById('countryFilter');
const cityFilter = document.getElementById('cityFilter');
const worldList = document.getElementById('worldList');

let records = [];

function loadRecords() {
  try {
    const stored = localStorage.getItem('registryRecords');
    if (stored) records = JSON.parse(stored);
  } catch (e) {
    records = [];
  }
  renderAggregates();
  handleTokenDelete();
}

function saveRecords() {
  localStorage.setItem('registryRecords', JSON.stringify(records));
}

function generateToken() {
  if (window.crypto && crypto.randomUUID) return 'token-' + crypto.randomUUID();
  return 'token-' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

function labelize(key) {
  return String(key).replace(/_/g, ' ');
}

function handleTokenDelete() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (!token) return;
  const before = records.length;
  records = records.filter(r => r.id !== token);
  if (records.length !== before) {
    saveRecords();
    if (successMessage) {
      successMessage.style.display = 'block';
      successMessage.textContent = 'Record deleted for token ' + token;
    }
    history.replaceState({}, '', window.location.pathname);
  }
  renderAggregates();
}

if (submissionForm) {
  submissionForm.addEventListener('submit', function (e) {
    e.preventDefault();

    const city = document.getElementById('city').value.trim();
    const category = document.getElementById('category').value;
    const duration = document.getElementById('duration').value;
    const needs = [];
    document.querySelectorAll('input[name="need"]:checked').forEach(cb => needs.push(cb.value));

    if (!city) { alert('Please enter a city'); return; }
    if (!category) { alert('Please select a sleeping situation'); return; }
    if (!duration) { alert('Please select a duration'); return; }

    const record = {
      id: generateToken(),
      city: city,
      category: category,
      duration: duration,
      needs: needs.length > 0 ? needs : null,
      timestamp: new Date().toISOString()
    };

    records.push(record);
    saveRecords();

    if (successMessage) {
      successMessage.style.display = 'block';
      successMessage.innerHTML =
        '<strong>Your anonymous token:</strong> <code>' + record.id + '</code><br>' +
        '<strong>Keep this token safe.</strong><br>' +
        'You can use it to <a href="?token=' + encodeURIComponent(record.id) + '">delete your record</a> later.';
    }

    submissionForm.reset();
    renderAggregates();
  });
}

function renderAggregates() {
  if (!aggregateView || !totalCount) return;

  const byCityMap = {};
  const byCategoryMap = { rough_sleeping: 0, vehicle: 0, couch: 0, other: 0 };
  const durationMap = { less_than_week: 0, '1_4_weeks': 0, '1_3_months': 0, '3_plus_months': 0 };
  const cityData = {};

  records.forEach(record => {
    const cityKey = record.city.toLowerCase().trim();
    if (!byCityMap[cityKey]) {
      byCityMap[cityKey] = 0;
      cityData[cityKey] = { count: 0, categories: {} };
    }
    byCityMap[cityKey]++;
    cityData[cityKey].count++;
    byCategoryMap[record.category] = (byCategoryMap[record.category] || 0) + 1;
    durationMap[record.duration] = (durationMap[record.duration] || 0) + 1;
    if (!cityData[cityKey].categories[record.category]) {
      cityData[cityKey].categories[record.category] = 0;
    }
    cityData[cityKey].categories[record.category]++;
  });

  // Keep form visible; show aggregates alongside (was: hide form when any records)
  if (submissionFormSection) submissionFormSection.style.display = 'block';
  aggregateView.style.display = 'block';

  totalCount.textContent = records.length;
  byCity.textContent = Object.keys(byCityMap).length;
  bySituation.textContent = Object.values(byCategoryMap).reduce((a, b) => a + b, 0);

  if (cityBreakdown) {
    const sortedCities = Object.entries(cityData).sort((a, b) => b[1].count - a[1].count);
    let breakdownHTML = '';
    sortedCities.slice(0, 10).forEach(([city, data]) => {
      const cats = Object.entries(data.categories)
        .map(([cat, count]) => labelize(cat) + ': ' + count)
        .join(', ');
      breakdownHTML += '<li><strong>' + city + '</strong>: ' + data.count +
        (cats ? ' (' + cats + ')' : '') + '</li>';
    });
    if (sortedCities.length > 10) {
      breakdownHTML += '<li><em>... and ' + (sortedCities.length - 10) + ' more cities</em></li>';
    }
    cityBreakdown.innerHTML = breakdownHTML || '<li>No anonymous submissions yet</li>';
  }

  if (situationBreakdown) {
    situationBreakdown.innerHTML = Object.entries(byCategoryMap)
      .map(([cat, count]) => '<div><strong>' + labelize(cat) + ':</strong> ' + count + '</div>')
      .join('');
  }
  if (durationBreakdown) {
    durationBreakdown.innerHTML = Object.entries(durationMap)
      .map(([dur, count]) => '<div><strong>' + labelize(dur) + ':</strong> ' + count + '</div>')
      .join('');
  }

  if (countryFilter) {
    const countries = [...new Set(records.map(r => (r.city.split(',').pop() || r.city).trim()))];
    const prev = countryFilter.value;
    countryFilter.innerHTML = '<option value="">All</option>';
    countries.forEach(country => {
      const opt = document.createElement('option');
      opt.value = country;
      opt.textContent = country;
      countryFilter.appendChild(opt);
    });
    countryFilter.value = prev;
  }
  if (cityFilter) updateCityFilter(Object.keys(byCityMap));
}

function updateCityFilter(cities) {
  if (!cityFilter) return;
  const prev = cityFilter.value;
  cityFilter.innerHTML = '<option value="">All Cities</option>';
  cities.forEach(city => {
    const opt = document.createElement('option');
    opt.value = city;
    opt.textContent = city;
    cityFilter.appendChild(opt);
  });
  cityFilter.value = prev;
}

async function loadWorldStats() {
  if (!worldList) return;
  try {
    const res = await fetch('data/homelessness-worldwide.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    worldList.innerHTML = (data.countries || []).map(c => {
      const change = c.change >= 0 ? '+' + c.change : String(c.change);
      return '<li><strong>' + c.name + '</strong>: ' +
        Number(c.count).toLocaleString() + ' <span class="muted">(' + change + ')</span></li>';
    }).join('') || '<li>No world data</li>';
  } catch (e) {
    worldList.innerHTML = '<li class="muted">World snapshot unavailable</li>';
  }
}

loadRecords();
loadWorldStats();
