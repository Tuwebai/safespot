import { DB } from '../utils/db.js';
import { logError } from '../utils/logger.js';

// Helper to escape HTML special characters in meta tags
const escapeHtml = (text) => {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

/**
 * Generate a static map URL for reports without images
 * Uses Yandex Static Maps as a reliable fallback
 */
const getStaticMapUrl = (lat, lng) => {
  // Using Yandex Static Maps 1.x (Free, no key required for basic usage)
  // l=map (schema), z=15 (zoom), size=600,400, pt=lng,lat,pm2rdm (red pushpin)
  // lang=es_ES for Spanish labels
  return `https://static-maps.yandex.ru/1.x/?lang=es_ES&ll=${lng},${lat}&z=15&l=map&size=600,400&pt=${lng},${lat},pm2rdm`;
};

/**
 * Format date in a human-friendly way: "Hoy 12:40", "Ayer 15:00", or "20 de Oct 10:30"
 */
const formatHumanDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const timeStr = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  if (diffDays === 0 && date.getDate() === now.getDate()) {
    return `Hoy ${timeStr}`;
  } else if (diffDays === 1 || (diffDays === 0 && date.getDate() !== now.getDate())) {
    return `Ayer ${timeStr}`;
  } else {
    const dayMonth = date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
    return `${dayMonth} ${timeStr}`;
  }
};

/**
 * Serve HTML with Open Graph tags for a specific report
 * RESPOND 200 OK (no redirect) with dynamic meta tags for crawlers.
 */
export const getReportPreview = async (req, res) => {
  try {
    const { id } = req.params;
    const frontendUrl = process.env.FRONTEND_URL || 'https://safespot.tuweb-ai.com';

    // Fetch report data
    const db = DB.public();
    const result = await db.query(`
            SELECT category, zone, address, latitude, longitude, created_at, image_urls, description
            FROM reports 
            WHERE id = $1
        `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).send('Reporte no encontrado');
    }

    const report = result.rows[0];

    // Normalizar imágenes
    let images = [];
    if (report.image_urls) {
      if (Array.isArray(report.image_urls)) images = report.image_urls;
      else if (typeof report.image_urls === 'string') {
        try { images = JSON.parse(report.image_urls); } catch (e) { }
      }
    }

    // Lógica de og:image (1200x630 para mejor compatibilidad)
    let ogImage = '';
    if (images.length > 0) {
      ogImage = images[0];
    } else if (report.latitude && report.longitude) {
      // Yandex Static Maps con tamaño 1200x600 (aprox a 1200x630)
      ogImage = `https://static-maps.yandex.ru/1.x/?lang=es_ES&ll=${report.longitude},${report.latitude}&z=15&l=map&size=600,300&pt=${report.longitude},${report.latitude},pm2rdm`;
    } else {
      ogImage = `${frontendUrl}/og-default.png`;
    }

    const humanDate = formatHumanDate(report.created_at);
    const location = report.zone || report.address || 'Ubicación desconocida';

    // og:title -> "Robo de Bicicleta"
    const ogTitle = escapeHtml(`Robo de ${report.category}`);

    // og:description -> "Av. Colón, Córdoba · Hoy 12:40 👉 Ayudá compartiendo este reporte"
    const ogDescription = escapeHtml(`${location} · ${humanDate} 👉 Ayudá compartiendo este reporte`);

    const targetUrl = `${frontendUrl}/reporte/${id}`;

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- SEO Meta Tags -->
  <title>${ogTitle}</title>
  <meta name="description" content="${ogDescription}">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="${ogDescription}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:url" content="${targetUrl}" />
  <meta property="og:site_name" content="SafeSpot" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${ogTitle}" />
  <meta name="twitter:description" content="${ogDescription}" />
  <meta name="twitter:image" content="${ogImage}" />

  <!-- Meta Refresh & Redirect -->
  <meta http-equiv="refresh" content="0;url=${targetUrl}" />
  
  <style>
    body { font-family: system-ui, sans-serif; background: #121212; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
  </style>
</head>
<body>
  <div style="text-align: center;">
    <p>Redirigiendo a SafeSpot...</p>
    <script>
      window.location.href = "${targetUrl}";
    </script>
  </div>
</body>
</html>`;

    res.status(200).set('Content-Type', 'text/html').send(html);

  } catch (error) {
    logError(error, req);
    res.status(500).send('Error interno');
  }
};
