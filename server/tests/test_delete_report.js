import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api';
const REPORT_ID = 'un-uuid-existente-o-test'; // Idealmente crear uno antes
const ANONYMOUS_ID = '00000000-0000-0000-0000-000000000001';

async function testDelete() {
    console.log('🚀 Iniciando prueba de DELETE /api/reports/:id');

    try {
        const response = await fetch(`${API_URL}/reports/${REPORT_ID}`, {
            method: 'DELETE',
            headers: {
                'X-Anonymous-Id': ANONYMOUS_ID,
                'Content-Type': 'application/json'
            }
        });

        const status = response.status;
        const data = await response.json();

        console.log(`Status: ${status}`);
        console.log('Response:', JSON.stringify(data, null, 2));

        if (status === 200 || status === 404) {
            console.log('✅ Prueba superada: El servidor respondió correctamente sin ReferenceError.');
        } else {
            console.error('❌ Prueba fallida: Respuesta inesperada.');
        }
    } catch (error) {
        console.error('❌ Error fatal al conectar con el servidor:', error.message);
    }
}

testDelete();
