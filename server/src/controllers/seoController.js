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
 * Convert a string to a URL-friendly slug
 */
const slugify = (text) => {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD') // Remove accents
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
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
/**
 * Serve HTML with Open Graph tags for a specific report.
 * Consumed by social bots to show rich previews.
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
      return res.status(404).send('SEO: Reporte No Encontrado [DB]');
    }

    const report = result.rows[0];

    // Normalize images (parsed from JSON array)
    let images = [];
    if (report.image_urls) {
      if (Array.isArray(report.image_urls)) images = report.image_urls;
      else if (typeof report.image_urls === 'string') {
        try { images = JSON.parse(report.image_urls); } catch (e) { }
      }
    }

    // Image logic: First report image or professional fallback
    const ogImage = images.length > 0 ? images[0] : `${frontendUrl}/og-default.png`;

    const humanDate = formatHumanDate(report.created_at);
    const location = report.zone || report.address || 'Ubicación desconocida';

    // Data for Meta Tags
    const ogTitle = escapeHtml(`Robo de ${report.category}`);
    const ogDescription = escapeHtml(`${location} · ${humanDate} · Ayudá compartiendo`);
    const targetUrl = `${frontendUrl}/reporte/${id}`;

    // Professional HTML response for crawlers
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${ogTitle}</title>

  <!-- Canonical and Dynamic Meta -->
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="SafeSpot" />
  <meta property="og:url" content="${targetUrl}" />
  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="${ogDescription}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${ogTitle}" />
  <meta name="twitter:description" content="${ogDescription}" />
  <meta name="twitter:image" content="${ogImage}" />

  <!-- Meta Refresh for Browsers -->
  <meta http-equiv="refresh" content="0; url=${targetUrl}">
</head>
<body>
  <p>Redirigiendo a <a href="${targetUrl}">SafeSpot</a>...</p>
</body>
</html>`;

    res.status(200).set('Content-Type', 'text/html').send(html);

  } catch (error) {
    logError(error, req);
    res.status(500).send('Error interno');
  }
};

/**
 * Get all active zones from the reports table for programmatic SEO
 */
export const getZones = async (req, res) => {
  try {
    const db = DB.public();

    // Aggregate unique zones and localities
    // We prioritize 'zone' but fallback to 'address' components if needed.
    // However, the schema has a 'zone' column which is populated during report creation.
    const result = await db.query(`
      SELECT 
        zone as name,
        COUNT(*) as report_count,
        MAX(updated_at) as last_updated
      FROM reports 
      WHERE is_hidden = false AND zone IS NOT NULL AND zone != ''
      GROUP BY zone
      HAVING COUNT(*) > 0
      ORDER BY report_count DESC
    `);

    const zones = result.rows.map(z => ({
      name: z.name,
      slug: slugify(z.name),
      report_count: parseInt(z.report_count, 10),
      last_updated: z.last_updated
    }));

    res.json({ success: true, data: zones });

  } catch (error) {
    logError(error, req);
    res.status(500).json({ error: 'Error al obtener las zonas' });
  }
};
/**
 * Serve HTML with Open Graph tags for a specific zone/neighborhood
 * This is consumed ONLY by social bots via Netlify redirection.
 */
export const getZonePreview = async (req, res) => {
  try {
    const { slug } = req.params;
    const frontendUrl = 'https://safespot.tuweb-ai.com';

    // 1. Find the zone name from the slug
    // Since we don't have a zones table, we infer it from existing reports or slug transformation
    const db = DB.public();
    const zoneResult = await db.query(`
      SELECT zone as name, COUNT(*) as report_count
      FROM reports 
      WHERE is_hidden = false AND zone IS NOT NULL AND zone != ''
      GROUP BY zone
    `);

    const zones = zoneResult.rows;
    const currentZone = zones.find(z => slugify(z.name) === slug);

    // Fallback if zone not found in DB yet
    const zoneName = currentZone ? currentZone.name : slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const reportCount = currentZone ? parseInt(currentZone.report_count, 10) : 0;

    // 2. Intelligent Indexation Control (Fixing Thin Content)
    // If 0 reports, we emit noindex to avoid indexing empty hub pages.
    const robots = reportCount > 0 ? 'index, follow' : 'noindex, follow';

    // 3. Dynamic Meta Tags
    const ogTitle = escapeHtml(`Alertas de seguridad en ${zoneName} | SafeSpot`);
    // Dynamic description (140-160 chars)
    const rawDesc = reportCount > 0
      ? `Alertas de seguridad en ${zoneName}: ${reportCount} incidentes y reportes ciudadanos en tiempo real. Colaborá con tu barrio para estar más seguro en SafeSpot.`
      : `Alertas de seguridad en ${zoneName}: robos, incidentes y reportes comunitarios anónimos. Uníte a la red de SafeSpot para proteger a tu barrio.`;
    const ogDescription = escapeHtml(rawDesc.substring(0, 160));

    const targetUrl = `${frontendUrl}/alertas/${slug}`;
    const ogImage = `${frontendUrl}/og-default.png`;

    // 4. JSON-LD Structured Data (BreadcrumbList & Place)
    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "BreadcrumbList",
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Inicio",
              "item": frontendUrl
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": "Alertas",
              "item": `${frontendUrl}/reportes`
            },
            {
              "@type": "ListItem",
              "position": 3,
              "name": zoneName,
              "item": targetUrl
            }
          ]
        },
        {
          "@type": "Place",
          "name": zoneName,
          "address": {
            "@type": "PostalAddress",
            "addressLocality": zoneName,
            "addressRegion": "Argentina"
          },
          "publicAccess": true
        }
      ]
    };

    // 5. Senior SEO Content Block (Shared with Frontend)
    const seoContentHeader = `Estado actual de la seguridad en ${zoneName}`;
    const seoContentBody = `La seguridad en ${zoneName} es una preocupación constante para quienes transitan y viven en el barrio. En SafeSpot, entendemos que la prevención comienza con la información compartida. Al monitorear en tiempo real las alertas de robos e incidentes en esta zona, nuestra comunidad identifica patrones críticos.`;

    // Professional HTML response for crawlers
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${ogTitle}</title>
  <meta name="description" content="${ogDescription}" />
  <meta name="robots" content="${robots}" />
  <link rel="canonical" href="${targetUrl}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="SafeSpot" />
  <meta property="og:url" content="${targetUrl}" />
  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="${ogDescription}" />
  <meta property="og:image" content="${ogImage}" />

  <!-- Structured Data -->
  <script type="application/ld+json">
    ${JSON.stringify(jsonLd)}
  </script>

  <!-- Meta Refresh for Browsers -->
  <meta http-equiv="refresh" content="0; url=${targetUrl}">
</head>
<body>
  <header>
    <h1>${ogTitle}</h1>
  </header>
  <main>
    <section>
      <h2>${seoContentHeader}</h2>
      <p>${seoContentBody}</p>
      <p>Se han detectado ${reportCount} incidentes en esta ubicación.</p>
    </section>
    <p>Redirigiendo a <a href="${targetUrl}">SafeSpot App</a>...</p>
  </main>
</body>
</html>`;

    res.status(200).set('Content-Type', 'text/html').send(html);

  } catch (error) {
    logError(error, req);
    res.status(500).send('Error interno');
  }
};
