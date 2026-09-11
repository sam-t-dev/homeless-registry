// Anonymous Homeless Registry - Application Logic

// DOM Elements
const submissionForm = document.getElementById('submissionForm');
const aggregateView = document.getElementById('aggregateView');
const submissionFormSection = document.querySelector('.submission-form');
const successMessage = document.querySelector('.success-message');
const totalCount = document.getElementById('totalCount');
const byCity = document.getElementById('byCity');
const bySituation = document.getElementById('bySituation');
const cityBreakdown = document.getElementById('cityBreakdown');
const countryFilter = document.getElementById('countryFilter');
const cityFilter = document.getElementById('cityFilter');

// In-memory data store (in production, this would be a backend API)
let records = [];

// Load existing records from localStorage if available
function loadRecords() {
  const stored = localStorage.getItem('registryRecords');
  if (stored) {
    records = JSON.parse(stored);
    renderAggregates();
  }
}

// Save records to localStorage
function saveRecords() {
  localStorage.setItem('registryRecords', JSON.stringify(records));
}

// Generate one-time anonymous token (UUID v4 simplified)
function generateToken() {
  return 'token-' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

// Submit form handler
submissionForm.addEventListener('submit', function(e) {
  e.preventDefault();

  // Get form values
  const city = document.getElementById('city').value.trim();
  const category = document.getElementById('category').value;
  const duration = document.getElementById('duration').value;
  const needs = [];

  const checkboxes = document.querySelectorAll('input[name="need"]:checked');
  checkboxes.forEach(cb => needs.push(cb.value));

  // Basic validation
  if (!city) {
    alert('Please enter a city');
    return;
  }

  if (!category) {
    alert('Please select a sleeping situation');
    return;
  }

  if (!duration) {
    alert('Please select a duration');
    return;
  }

  // Create record object (no PII)
  const record = {
    id: generateToken(),
    city: city,
    category: category,
    duration: duration,
    needs: needs.length > 0 ? needs : null,
    timestamp: new Date().toISOString()
  };

  // Add to records
  records.push(record);
  saveRecords();

  // Show token to user
  successMessage.style.display = 'block';
  successMessage.innerHTML = `
    <strong>Your anonymous token:</strong> <code>${record.id}</code><br>
    <strong>Keep this token safe.</strong><br>
    You can use it to <a href="?token=${record.id}">delete your record</a> later.
  `;

  // Reset form
  submissionForm.reset();

  // Re-render aggregates
  renderAggregates();
});

// Render aggregate counts
function renderAggregates() {
  if (records.length === 0) {
    // Hide view, show form
    aggregateView.style.display = 'none';
    submissionFormSection.style.display = 'block';
    return;
  }

  // Show aggregate view, hide form
  aggregateView.style.display = 'block';
  submissionFormSection.style.display = 'none';

  // Calculate counts
  const total = records.length;
  const byCityMap = {};
  const byCategoryMap = {
    rough_sleeping: 0,
    vehicle: 0,
    couch: 0,
    other: 0
  };
  const durationMap = {
    less_than_week: 0,
    '1_4_weeks': 0,
    '1_3_months': 0,
    '3_plus_months': 0
  };

  // City breakdown
  const cityData = {};

  records.forEach(record => {
    // By city
    const cityKey = record.city.toLowerCase().trim();
    if (!byCityMap[cityKey]) {
      byCityMap[cityKey] = 0;
      cityData[cityKey] = { count: 0, categories: {} };
    }
    byCityMap[cityKey]++;
    cityData[cityKey].count++;

    // By category
    byCategoryMap[record.category] = (byCategoryMap[record.category] || 0) + 1;

    // By duration
    durationMap[record.duration] = (durationMap[record.duration] || 0) + 1;

    // City data for detailed breakdown
    if (!cityData[cityKey].categories[record.category]) {
      cityData[cityKey].categories[record.category] = 0;
    }
    cityData[cityKey].categories[record.category]++;
  });

  // Update DOM
  totalCount.textContent = total;
  byCity.textContent = Object.keys(byCityMap).length;
  bySituation.textContent = Object.values(byCategoryMap).reduce((a, b) => a + b, 0);

  // City breakdown HTML
  let breakdownHTML = '';
  const sortedCities = Object.entries(cityData).sort((a, b) => b[1].count - a[1].count);
  
  sortedCities.slice(0, 10).forEach(([city, data]) => {
    const totalInCity = data.count;
    breakdownHTML += `
      <li>
        <strong>${city}</strong>: ${totalInCity} people
        ${Object.entries(data.categories).length > 0 ? 
          ` (${Object.entries(data.categories).map(([cat, count]) => `${cat}: ${count}`).join(', ')})` : ''}
      </li>
    `;
  });

  if (sortedCities.length > 10) {
    breakdownHTML += `<li><em>... and ${sortedCities.length - 10} more cities</em></li>`;
  }

  cityBreakdown.innerHTML = breakdownHTML || '<p>No data yet</p>';

  // Populate filters
  const countries = [...new Set(records.map(r => r.city.split(' ').pop() || 'Unknown'))];
  countryFilter.innerHTML = '<option value="">All Countries</option>';
  countries.forEach(country => {
    const opt = document.createElement('option');
    opt.value = country;
    opt.textContent = country;
    countryFilter.appendChild(opt);
  });

  // Populate city filter initially
  updateCityFilter(Object.keys(byCityMap));
}

// Update city filter options
function updateCityFilter(cities) {
  cityFilter.innerHTML = '<option value="">All Cities</option>';
  cities.forEach(city => {
    const opt = document.createElement('option');
    opt.value = city;
    opt.textContent = city;
    cityFilter.appendChild(opt);
  });
}

// Initialize on load
loadRecords();