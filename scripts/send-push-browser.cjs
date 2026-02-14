#!/usr/bin/env node
/**
 * Script para enviar push desde el browser (usando el backend)
 * Uso: node scripts/send-push-browser.cjs <anonymous_id> [mensaje]
 */

const http = require('http');

const TARGET_ID = process.argv[2];
const MESSAGE = process.argv[3] || 'Test desde browser script';

if (!TARGET_ID) {
    console.error('❌ Error: Debes proporcionar el anonymousId');
    console.log('Uso: node scripts/send-push-browser.cjs <anonymous_id> [mensaje]');
    console.log('\nPara obtener tu ID, en el navegador ejecutá:');
    console.log('JSON.parse(localStorage.getItem(\'safespot_session_v3\')).anonymousId');
    process.exit(1);
}

console.log(`🔔 Enviando push a: ${TARGET_ID.substring(0, 8)}...`);
console.log(`💬 Mensaje: ${MESSAGE}\n`);

const data = JSON.stringify({
    anonymousId: TARGET_ID,
    message: MESSAGE
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/diagnostics/push-test',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        try {
            const result = JSON.parse(body);
            console.log('📊 Resultado:');
            console.log(JSON.stringify(result, null, 2));
            
            if (result.status === 'SUCCESS') {
                console.log('\n✅ Push enviado correctamente');
                console.log('📱 Revisá el navegador por la notificación');
            } else if (result.error?.includes('No push subscriptions')) {
                console.log('\n❌ El usuario no tiene suscripción de push');
                console.log('💡 Solución: Permitir notificaciones en el navegador');
            } else {
                console.log('\n⚠️ El push no se pudo enviar');
            }
        } catch (e) {
            console.log('Respuesta:', body);
        }
    });
});

req.on('error', (err) => {
    console.error('❌ Error de conexión:', err.message);
    console.log('💡 Asegurate de que el servidor esté corriendo en localhost:3000');
});

req.write(data);
req.end();
