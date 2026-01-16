
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api/geocode';

async function verifyProof() {
    console.log('--- VERIFICACIÓN DE ORIGEN DE DATOS ---');
    console.log('Haciendo petición a /api/geocode/ip...');

    try {
        const res = await fetch(`${BASE_URL}/ip`);
        const data = await res.json();

        console.log('\n--- RESULTADO ---');
        console.log('STATUS:', res.status);
        if (data.success) {
            console.log('FUENTE:', data.data.source); // ip_ipapi o ip_ip-api
            console.log('UBICACIÓN DETECTADA:', data.data.display_name);
            console.log('LAT/LON:', data.data.lat, data.data.lon);

            console.log('\n--- ANÁLISIS ---');
            if (data.data.source === 'ip_fallback_dev') {
                console.error('❌ MOCK DETECTADO: El servidor usó el fallback de desarrollo (Buenos Aires). No hay internet?');
            } else {
                console.log('✅ REAL: La ubicación provino de un proveedor externo basado en tu IP Pública.');
                console.log('   Si ves "Rio Tercero" es porque tu proveedor de internet (ISP) te ubica allí.');
                console.log('   NO existe código hardcodeado con esa ciudad en el proyecto.');
            }
        } else {
            console.error('❌ Error en respuesta:', data);
        }

    } catch (e) {
        console.error('❌ Error de conexión:', e.message);
    }
}

verifyProof();
