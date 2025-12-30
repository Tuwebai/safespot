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
 * This is consumed ONLY by social bots via Netlify redirection.
 */
export const getReportPreview = async (req, res) => {
  try {
    const { id } = req.params;
    const frontendUrl = 'https://safespot.tuweb-ai.com';

    // Fetch report data
    const db = DB.public();
    const result = await db.query(`
      SELECT category, zone, address, created_at, image_urls
      FROM reports 
      WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).send('Reporte no encontrado');
    }

    const report = result.rows[0];

    // Normalize images
    let images = [];
    if (report.image_urls) {
      if (Array.isArray(report.image_urls)) images = report.image_urls;
      else if (typeof report.image_urls === 'string') {
        try { images = JSON.parse(report.image_urls); } catch (e) { }
      }
    }

    // Lógica de imagen: primera foto o fallback estático
    const ogImage = images.length > 0 ? images[0] : `${frontendUrl}/og-default.png`;

    const humanDate = formatHumanDate(report.created_at);
    const location = report.zone || report.address || 'Ubicación desconocida';

    // Título y descripción formateados
    const ogTitle = escapeHtml(`Robo de ${report.category}`);
    const ogDescription = escapeHtml(`${location} · ${humanDate} · Ayudá compartiendo`);
    const targetUrl = `${frontendUrl}/reporte/${id}`;

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${ogTitle}</title>

  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="SafeSpot" />
  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="${ogDescription}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${targetUrl}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${ogTitle}" />
  <meta name="twitter:description" content="${ogDescription}" />
  <meta name="twitter:image" content="${ogImage}" />
</head>
<body></body>
</html>`;

    res.status(200).set('Content-Type', 'text/html').send(html);

  } catch (error) {
    logError(error, req);
    res.status(500).send('Error interno');
  }
};
