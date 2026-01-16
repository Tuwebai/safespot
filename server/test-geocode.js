
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api/geocode';

async function testEndpoints() {
    console.log('--- Testing Geocode Endpoints ---');

    // 1. Test IP Fallback (Localhost handling)
    console.log('\n1. Testing /ip (Localhost/Dev)...');
    try {
        const res = await fetch(`${BASE_URL}/ip`);
        const data = await res.json();
        console.log('Status:', res.status);
        if (res.ok) {
            console.log('Data:', JSON.stringify(data, null, 2));
        } else {
            console.error('Error:', data);
        }
    } catch (e) {
        console.error('Fetch failed:', e.message);
    }

    // 2. Test Reverse Geocode (Buenos Aires Obelisk)
    console.log('\n2. Testing /reverse (Buenos Aires - -34.6037, -58.3816)...');
    try {
        const res = await fetch(`${BASE_URL}/reverse?lat=-34.6037&lon=-58.3816`);
        const data = await res.json();
        console.log('Status:', res.status);
        if (res.ok) {
            console.log('Data:', JSON.stringify(data, null, 2));
        } else {
            console.error('Error:', data);
        }
    } catch (e) {
        console.error('Fetch failed:', e.message);
    }

    // 3. Test Reverse Geocode (Remote/Rural - Somewhere in Cordoba)
    // -32.1664426, -64.1200276 (Almafuerte approx)
    console.log('\n3. Testing /reverse (Almafuerte/Rural)...');
    try {
        const res = await fetch(`${BASE_URL}/reverse?lat=-32.18&lon=-64.26`);
        const data = await res.json();
        console.log('Status:', res.status);
        if (res.ok) {
            console.log('Data:', JSON.stringify(data, null, 2));
        } else {
            console.error('Error:', data);
        }
    } catch (e) {
        console.error('Fetch failed:', e.message);
    }
}

testEndpoints();
