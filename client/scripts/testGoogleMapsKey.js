/**
 * Test Google Maps API Key from .env
 * Usage: node scripts/testGoogleMapsKey.js
 */
const fs = require('fs');
const path = require('path');

// Read EXPO_PUBLIC_GOOGLE_MAPS_API_KEY from client/.env
const envPath = path.join(__dirname, '..', '.env');
let apiKey = '';

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  const match = content.match(/EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=([^\r\n]+)/);
  if (match) apiKey = match[1].trim();
}

if (!apiKey) {
  console.error('❌ EXPO_PUBLIC_GOOGLE_MAPS_API_KEY not found in client/.env');
  process.exit(1);
}

console.log(`\n🔑 Testing API Key: ${apiKey.slice(0, 10)}...${apiKey.slice(-5)}`);
console.log('='.repeat(60));

async function runTests() {
  // 1. Places Autocomplete
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=Dubai&key=${apiKey}`);
    const data = await res.json();
    if (data.status === 'OK') {
      console.log('✅ Places Autocomplete: WORKING (Found ' + data.predictions.length + ' suggestions)');
    } else {
      console.log('❌ Places Autocomplete: FAILED [' + data.status + ']');
      console.log('   Reason:', data.error_message || 'Unknown error');
    }
  } catch (err) {
    console.log('❌ Places Autocomplete Network Error:', err.message);
  }

  // 2. Geocoding
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=Dubai&key=${apiKey}`);
    const data = await res.json();
    if (data.status === 'OK') {
      console.log('✅ Geocoding API: WORKING (Found ' + data.results.length + ' results)');
    } else {
      console.log('❌ Geocoding API: FAILED [' + data.status + ']');
      console.log('   Reason:', data.error_message || 'Unknown error');
    }
  } catch (err) {
    console.log('❌ Geocoding Network Error:', err.message);
  }

  // 3. Places Text Search
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=Dubai&key=${apiKey}`);
    const data = await res.json();
    if (data.status === 'OK') {
      console.log('✅ Places Text Search: WORKING (Found ' + data.results.length + ' places)');
    } else {
      console.log('❌ Places Text Search: FAILED [' + data.status + ']');
      console.log('   Reason:', data.error_message || 'Unknown error');
    }
  } catch (err) {
    console.log('❌ Places Text Search Network Error:', err.message);
  }

  console.log('='.repeat(60) + '\n');
}

runTests();
