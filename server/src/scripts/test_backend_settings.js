// Native fetch is available in Node 18+

async function testBackend() {
    console.log('Testing Backend Settings API...');

    // Use a unique valid UUID v4 to simulate a fresh user
    // This is a static valid UUID
    const ANONYMOUS_ID = '123e4567-e89b-12d3-a456-426614174000';

    try {
        console.log(`Making GET request with ID: ${ANONYMOUS_ID}`);
        const response = await fetch('http://localhost:3000/api/notifications/settings', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Anonymous-Id': ANONYMOUS_ID
            }
        });

        const data = await response.json();
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(data, null, 2));

        if (response.status === 200 && data.success) {
            console.log('✅ Backend test PASSED: Settings retrieved/created.');
            process.exit(0);
        } else {
            console.error('❌ Backend test FAILED: Invalid response.');
            process.exit(1);
        }
    } catch (err) {
        console.error('❌ Backend test FAILED: Network error', err);
        process.exit(1);
    }
}

testBackend();
