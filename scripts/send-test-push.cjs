#!/usr/bin/env node
/**
 * Script para enviar push de prueba directamente
 * Uso: node scripts/send-test-push.js <anonymous_id> [mensaje]
 */

const https = require('https');
const http = require('http');

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TARGET_ID = process.argv[2] || 'e009f2a4-9860-4fbb-8de0-4321b9ae97ea';
const MESSAGE = process.argv[3] || 'Test push desde script';

console.log(`🔔 Enviando push a: ${TARGET_ID}`);
console.log(`📡 API: ${API_URL}`);
console.log('');

const data = JSON.stringify({
  anonymousId: TARGET_ID,
  message: MESSAGE
});

const url = new URL(`${API_URL}/api/diagnostics/push-test`);
const client = url.protocol === 'https:' ? https : http;

const options = {
  hostname: url.hostname,
  port: url.port || (url.protocol === 'https:' ? 443 : 80),
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = client.request(options, (res) => {
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    try {
      const parsed = JSON.parse(responseData);
      console.log('Respuesta:');
      console.log(JSON.stringify(parsed, null, 2));
      
      if (parsed.status === 'SUCCESS') {
        console.log('\n✅ Push enviado exitosamente');
      } else if (parsed.error === 'Authentication Required') {
        console.log('\n❌ Error de autenticación - El servidor necesita reiniciarse para tomar los cambios');
        console.log('   Ejecuta: cd server && npm run dev (reinicia el servidor)');
      } else {
        console.log('\n⚠️ El push no se pudo enviar');
      }
    } catch (e) {
      console.log('Respuesta raw:', responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
  console.log('\n❌ No se pudo conectar al servidor');
  console.log('   Verifica que el servidor esté corriendo: cd server && npm run dev');
});

req.write(data);
req.end();
