#!/usr/bin/env node
/**
 * Script manual de push con payload exacto
 */

const http = require('http');
const webpush = require('web-push');

// Configurar VAPID
webpush.setVapidDetails(
  'mailto:admin@safespot.app',
  'BGFGz5PM_-yeKOzERt3Tz-ykVwbHgE_nl1xk95aTXelN4KN0rDJeY3xSOY70AGC57fi-Hakodq-lKKJ_m6pjMfs',
  'HtsSVfF1iPW0f9He8RConaXBJUxv27BKVL91yGbXmq8'
);

const TARGET_ID = 'e009f2a4-9860-4fbb-8de0-4321b9ae97ea';

async function sendPush() {
  // Obtener suscripción de la DB
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.womkvonfiwjzzatsowkl:Safespot2024Dev@aws-0-us-west-2.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });

  const result = await pool.query(
    'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE anonymous_id = $1 AND is_active = true LIMIT 1',
    [TARGET_ID]
  );

  if (result.rows.length === 0) {
    console.log('❌ No hay suscripciones activas');
    await pool.end();
    return;
  }

  const sub = result.rows[0];
  
  // Payload exacto que espera el SW
  const payload = JSON.stringify({
    title: '🔔 Test Manual',
    body: 'Mensaje de prueba',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'test-' + Date.now(),
    requireInteraction: true,
    data: {
      url: '/notifications',
      test: true
    }
  });

  console.log('Payload:', payload);
  console.log('Endpoint:', sub.endpoint.substring(0, 50) + '...');

  try {
    const result = await webpush.sendNotification({
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth
      }
    }, payload);

    console.log('✅ Push enviado:', result.statusCode);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  await pool.end();
}

sendPush();
