import axios from 'axios';

const BASE_URL = 'http://localhost:3000/api';

const client = axios.create({
    baseURL: BASE_URL,
    headers: {
        'X-Anonymous-Id': '11111111-1111-1111-1111-111111111111',
        'X-Client-ID': 'verifier-script'
    }
});

async function verifyContract() {
    console.log('🔍 Starting Enterprise Contract Verification...');

    try {
        // 1. Fetch Reports List
        // 1. Fetch Reports List
        console.log('\n[TEST 1] Fetching Reports (GET /reports)...');
        const response = await client.get('/reports?limit=5');

        // Check strict structure
        if (!response.data.success) throw new Error('Missing success flag');
        if (!Array.isArray(response.data.data)) throw new Error('Data is not an array');

        console.log('✅ Reports Contract Validated!');
        console.log('   Stats:', response.data.meta);

        // 2. Fetch Single Report
        if (response.data.data.length > 0) {
            const reportId = response.data.data[0].id;
            console.log(`\n[TEST 2] Fetching Single Report (GET /reports/${reportId})...`);

            const detailResponse = await client.get(`/reports/${reportId}`);
            if (!detailResponse.data.success) throw new Error('Missing success flag');
            if (!detailResponse.data.data.id) throw new Error('Missing data.id');

            console.log('✅ Single Report Contract Validated!');
        }

        console.log('\n🎉 ALL TESTS PASSED. The Contract is Enforced.');

    } catch (error) {
        console.error('\n❌ CONTRACT VERIFICATION FAILED');
        console.error('Full Error:', error.toJSON ? error.toJSON() : (error.stack || error));
        if (error.response) {
            console.error(`HTTP ${error.response.status}:`, JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
        process.exit(1);
    }
}

verifyContract();
