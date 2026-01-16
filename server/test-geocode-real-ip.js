
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api/geocode';

async function testRealIp() {
    console.log('--- Testing IP Geolocation with Real IP ---');
    // Random Argentine IP (Telecom Argentina)
    const TEST_IP = '181.9.1.1';

    try {
        const res = await fetch(`${BASE_URL}/ip`, {
            headers: {
                'X-Forwarded-For': TEST_IP
            }
        });
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

testRealIp();
