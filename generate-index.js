// generate-index.js
// Reads data/records.json and generates public index.html with aggregate counts only

const fs = require('fs');
const path = require('path');

// Paths
const DATA_PATH = path.join(__dirname, 'data', 'records.json');
const OUTPUT_PATH = path.join(__dirname, 'index.html');

// Read records
let records;
try {
  const data = fs.readFileSync(DATA_PATH, 'utf8');
  records = JSON.parse(data);
} catch (e) {
  records = [];
}

// Calculate aggregates
const totalRecords = records.length;

// Count by city (aggregated)
const byCityMap = {};
const byCategory = { rough_sleeping: 0, vehicle: 0, couch: 0, other: 0 };
const byDuration = { less_than_week: 0, '1_4_weeks': 0, '1_3_months': 0, '3_plus_months': 0 };

records.forEach(record => {
  const cityKey = record.city.toLowerCase().trim();
  if (!byCityMap[cityKey]) {
    byCityMap[cityKey] = 0;
  }
  byCityMap[cityKey]++;

  if (byCategory[record.category] !== undefined) {
    byCategory[record.category]++;
  }
  if (byDuration[record.duration] !== undefined) {
    byDuration[record.duration]++;
  }
});

// Count unique cities
const uniqueCities = Object.keys(byCityMap).length;

// Generate index.html
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Anonymous Homeless Registry - Live Counts</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header>
    <h1>Anonymous Homeless Registry</h1>
    <p>Live aggregate counts of homelessness by city and situation</p>
  </header>

  <main>
    <section class="aggregate-view">
      <div class="counts">
        <div class="count-card">
          <h3>Total Records</h3>
          <div class="number">${totalRecords}</div>
        </div>
        <div class="count-card">
          <h3>Unique Cities</h3>
          <div class="number">${uniqueCities}</div>
        </div>
        <div class="count-card">
          <h3>Active Situations</h3>
          <div class="number">${records.reduce((sum, r) => sum + 1, 0)}</div>
        </div>
      </div>

      <div class="city-breakdown">
        <h4>By City</h4>
        <ul>
          ${Object.entries(byCityMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([city, count]) => `<li><strong>${city}</strong>: ${count} people</li>`)
            .join('')}
          ${uniqueCities > 15 ? `<li><em>... and ${uniqueCities - 15} more cities</em></li>` : ''}
        </ul>
      </div>

      <div class="counts" style="margin-top: 2rem;">
        <div class="count-card">
          <h3>By Situation</h3>
          ${Object.entries(byCategory)
            .map(([cat, count]) => `<div><strong>${cat.replace(/_/g, ' ')}:</strong> ${count}</div>`)
            .join('')}
        </div>
        <div class="count-card">
          <h3>By Duration</h3>
          ${Object.entries(byDuration)
            .map(([dur, count]) => `<div><strong>${dur.replace(/_/g, ' ')}:</strong> ${count}</div>`)
            .join('')}
        </div>
      </div>
    </section>
  </main>

  <footer>
    &copy; 2026 Anonymous Homeless Registry | <a href="privacy-policy.html">Privacy Policy</a> | <a href="terms.html">Terms of Service</a>
  </footer>

  <script src="app.js"></script>
</body>
</html>`;

// Write output
fs.writeFileSync(OUTPUT_PATH, html);
console.log(`Generated index.html with ${totalRecords} records, ${uniqueCities} cities`);